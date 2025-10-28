const { Telegraf } = require('telegraf');
const express = require('express');

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = process.env.AUTHORIZED_USER_ID; // Your Telegram User ID
const PORT = process.env.PORT || 8000;

if (!BOT_TOKEN || !OWNER_ID) {
    console.error('❌ BOT_TOKEN and AUTHORIZED_USER_ID are required');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ==================== SIMPLE ADMIN CHECK ====================
async function isAdmin(ctx) {
    try {
        // Always return true for owner in ANY chat
        if (ctx.from.id.toString() === OWNER_ID) {
            console.log(`✅ Owner ${ctx.from.id} detected`);
            return true;
        }
        
        // For groups, check admin status
        if (ctx.chat.type !== 'private') {
            const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
            return member.status === "administrator" || member.status === "creator";
        }
        
        return false;
    } catch (error) {
        console.error('Admin check error:', error);
        return false;
    }
}

async function isBotAdmin(ctx) {
    try {
        const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
        return botMember.status === "administrator" || botMember.status === "creator";
    } catch (error) {
        console.error('Bot admin check error:', error);
        return false;
    }
}

// ==================== ADMIN COMMANDS ====================
bot.command('mute', async (ctx) => {
    console.log(`🔍 Mute command from ${ctx.from.id} in ${ctx.chat.type}`);
    
    // Check if user is admin
    const userIsAdmin = await isAdmin(ctx);
    console.log(`User is admin: ${userIsAdmin}`);
    
    if (!userIsAdmin) {
        await ctx.reply("❌ Admins only!");
        return;
    }
    
    // Check if bot is admin
    const botIsAdmin = await isBotAdmin(ctx);
    console.log(`Bot is admin: ${botIsAdmin}`);
    
    if (!botIsAdmin) {
        await ctx.reply("❌ I need to be an admin!");
        return;
    }
    
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user's message to mute.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    try {
        const untilDate = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        await ctx.telegram.restrictChatMember(
            ctx.chat.id,
            user.id,
            {
                permissions: {
                    can_send_messages: false,
                    can_send_media_messages: false,
                    can_send_other_messages: false,
                    can_add_web_page_previews: false
                },
                until_date: untilDate
            }
        );
        await ctx.reply(`🔇 Muted ${user.first_name} for 1 hour`);
    } catch (error) {
        console.error('Mute error:', error);
        await ctx.reply(`❌ Mute failed: ${error.message}`);
    }
});

bot.command('ban', async (ctx) => {
    console.log(`🔍 Ban command from ${ctx.from.id}`);
    
    const userIsAdmin = await isAdmin(ctx);
    if (!userIsAdmin) {
        await ctx.reply("❌ Admins only!");
        return;
    }
    
    const botIsAdmin = await isBotAdmin(ctx);
    if (!botIsAdmin) {
        await ctx.reply("❌ I need to be an admin!");
        return;
    }
    
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user's message to ban.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    try {
        await ctx.telegram.banChatMember(ctx.chat.id, user.id);
        await ctx.reply(`🔨 Banned ${user.first_name}`);
    } catch (error) {
        console.error('Ban error:', error);
        await ctx.reply(`❌ Ban failed: ${error.message}`);
    }
});

bot.command('del', async (ctx) => {
    console.log(`🔍 Del command from ${ctx.from.id}`);
    
    const userIsAdmin = await isAdmin(ctx);
    if (!userIsAdmin) {
        await ctx.reply("❌ Admins only!");
        return;
    }
    
    const botIsAdmin = await isBotAdmin(ctx);
    if (!botIsAdmin) {
        await ctx.reply("❌ I need to be an admin!");
        return;
    }
    
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a message to delete.");
        return;
    }
    
    try {
        await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.reply_to_message.message_id);
        await ctx.deleteMessage();
    } catch (error) {
        console.error('Delete error:', error);
        await ctx.reply(`❌ Delete failed: ${error.message}`);
    }
});

// ==================== DEBUG COMMAND ====================
bot.command('debug', async (ctx) => {
    const userIsAdmin = await isAdmin(ctx);
    const botIsAdmin = await isBotAdmin(ctx);
    
    const debugInfo = `
🔍 **Debug Information:**

👤 **User Info:**
- User ID: ${ctx.from.id}
- Username: ${ctx.from.username || 'N/A'}
- First Name: ${ctx.from.first_name}

🏷️ **Chat Info:**
- Chat Type: ${ctx.chat.type}
- Chat ID: ${ctx.chat.id}

🔐 **Permissions:**
- User is Admin/Owner: ${userIsAdmin}
- Bot is Admin: ${botIsAdmin}
- Owner ID: ${OWNER_ID}
- Is Owner: ${ctx.from.id.toString() === OWNER_ID}

💡 **BotFather Settings:**
- Privacy Mode: DISABLED (must be)
- Group Permissions: Admin (must be)
    `;
    
    await ctx.reply(debugInfo, { parse_mode: "Markdown" });
});

// ==================== START COMMAND ====================
bot.command('start', async (ctx) => {
    if (ctx.chat.type === 'private') {
        await ctx.reply(`
💖 Welcome to Rose Bot!

🛡️ **Admin Commands for Groups:**
/mute [reply] - Mute user for 1 hour
/ban [reply] - Ban user
/del [reply] - Delete message
/debug - Check permissions

📍 Add me to groups as admin to use moderation commands.
        `, { parse_mode: "Markdown" });
    } else {
        await ctx.reply(`
💖 Rose Bot is here!

🛡️ **Available Commands:**
/mute [reply] - Mute user
/ban [reply] - Ban user  
/del [reply] - Delete message
/debug - Check permissions
        `, { parse_mode: "Markdown" });
    }
});

// ==================== ERROR HANDLING ====================
bot.catch((err, ctx) => {
    console.error(`Bot error for ${ctx.updateType}:`, err);
});

// ==================== START BOT ====================
app.get('/', (req, res) => {
    res.json({ 
        status: 'Bot is running',
        owner: OWNER_ID,
        timestamp: new Date().toISOString()
    });
});

const startBot = async () => {
    try {
        await bot.launch();
        console.log('🤖 Bot started successfully!');
        console.log(`👤 Owner ID: ${OWNER_ID}`);
        console.log('🔧 Testing simple admin system...');
    } catch (error) {
        console.error('❌ Bot failed to start:', error);
        process.exit(1);
    }
};

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    startBot();
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
