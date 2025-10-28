const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const AUTHORIZED_USER_ID = process.env.AUTHORIZED_USER_ID;
const PORT = process.env.PORT || 8000;

// Validate required variables
if (!BOT_TOKEN || !AUTHORIZED_USER_ID) {
    console.error('❌ BOT_TOKEN and AUTHORIZED_USER_ID are required');
    process.exit(1);
}

console.log('🚀 Starting Rose AI Bot...');

const bot = new Telegraf(BOT_TOKEN);
const ROSES = ["🌹", "💐", "🌸", "💮", "🏵️", "🌺", "🌷", "🥀"];

// User sessions to track conversation and current mode
const userSessions = new Map();

// ==================== AUTH SYSTEM ====================
function isAuthorizedAIUser(ctx) {
    const userId = ctx.from.id.toString();
    const authorizedId = AUTHORIZED_USER_ID.toString();
    
    console.log(`🔍 Auth Check - User: ${userId}, Authorized: ${authorizedId}, Match: ${userId === authorizedId}`);
    
    return ctx.chat.type === 'private' && userId === authorizedId;
}

function aiAuthorizedRequired(func) {
    return async (ctx) => {
        if (!isAuthorizedAIUser(ctx)) {
            await ctx.reply("❌ *This is a personal AI bot.*", { parse_mode: "Markdown" });
            return;
        }
        return func(ctx);
    };
}

// ==================== ADMIN SYSTEM - FIXED ====================
async function isAdmin(ctx) {
    try {
        if (ctx.chat.type === 'private') return false;
        
        // Check if user is the owner (AUTHORIZED_USER_ID)
        const userId = ctx.from.id.toString();
        const authorizedId = AUTHORIZED_USER_ID.toString();
        
        if (userId === authorizedId) {
            console.log(`✅ User ${ctx.from.id} is the OWNER - Granting admin rights`);
            return true;
        }
        
        // Check if user is admin in the group
        const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
        console.log(`🔍 Admin Check - User: ${ctx.from.id}, Status: ${member.status}`);
        
        return member.status === "administrator" || member.status === "creator";
    } catch (error) {
        console.error('❌ Admin check error:', error);
        return false;
    }
}

// Check if bot is admin in group
async function isBotAdmin(ctx) {
    try {
        const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
        return botMember.status === "administrator" || botMember.status === "creator";
    } catch (error) {
        console.error('❌ Bot admin check error:', error);
        return false;
    }
}

function adminRequired(func) {
    return async (ctx) => {
        // Only work in groups
        if (ctx.chat.type === "private") {
            await ctx.reply("❌ This command only works in groups.");
            return;
        }
        
        console.log(`🔍 Checking permissions for user ${ctx.from.id} in group ${ctx.chat.id}`);
        
        // Check if user is admin OR owner
        const userIsAdmin = await isAdmin(ctx);
        console.log(`🔍 User ${ctx.from.id} is admin/owner: ${userIsAdmin}`);
        
        if (!userIsAdmin) {
            await ctx.reply("❌ Admins only!");
            return;
        }
        
        // Check if bot is admin in the group
        const botIsAdmin = await isBotAdmin(ctx);
        console.log(`🔍 Bot is admin: ${botIsAdmin}`);
        
        if (!botIsAdmin) {
            await ctx.reply("❌ I need to be an admin to perform this action!");
            return;
        }
        
        return func(ctx);
    };
}

// ==================== ADMIN COMMANDS - FIXED ====================
bot.command('mute', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user's message to mute them.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    const chatId = ctx.chat.id;
    
    try {
        const untilDate = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        await ctx.telegram.restrictChatMember(
            chatId,
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
        await ctx.reply(`🔇 Muted ${user.first_name} for 1 hour ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
    } catch (error) {
        console.error('Mute error:', error);
        await ctx.reply(`❌ Mute failed: ${error.message}`);
    }
}));

bot.command('ban', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user's message to ban them.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    const chatId = ctx.chat.id;
    
    try {
        await ctx.telegram.banChatMember(chatId, user.id);
        await ctx.reply(`🔨 Banned ${user.first_name} ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
    } catch (error) {
        console.error('Ban error:', error);
        await ctx.reply(`❌ Ban failed: ${error.message}`);
    }
}));

bot.command('del', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a message to delete it.");
        return;
    }
    
    try {
        await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.reply_to_message.message_id);
        await ctx.deleteMessage(); // Delete the command message too
    } catch (error) {
        console.error('Delete error:', error);
        await ctx.reply(`❌ Delete failed: ${error.message}`);
    }
}));

bot.command('warn', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user to warn them.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    await ctx.reply(`⚠️ ${user.first_name}, please follow group rules! ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
}));

// ==================== DEBUG COMMAND ====================
bot.command('debug', async (ctx) => {
    if (ctx.chat.type === 'private') {
        await ctx.reply(`🔍 Private Chat Debug:\nUser ID: ${ctx.from.id}\nAuthorized ID: ${AUTHORIZED_USER_ID}\nIs Owner: ${ctx.from.id.toString() === AUTHORIZED_USER_ID.toString()}`);
        return;
    }
    
    try {
        const userIsAdmin = await isAdmin(ctx);
        const botIsAdmin = await isBotAdmin(ctx);
        
        const debugInfo = `
🔍 **Group Debug Info:**

👤 **User Info:**
- User ID: ${ctx.from.id}
- Username: ${ctx.from.username || 'N/A'}
- First Name: ${ctx.from.first_name}

🔧 **Permissions:**
- User is Admin/Owner: ${userIsAdmin}
- Bot is Admin: ${botIsAdmin}
- Chat Type: ${ctx.chat.type}
- Chat ID: ${ctx.chat.id}

🆔 **Owner Check:**
- Your ID: ${ctx.from.id}
- Authorized ID: ${AUTHORIZED_USER_ID}
- Is Owner: ${ctx.from.id.toString() === AUTHORIZED_USER_ID.toString()}
        `;
        
        await ctx.reply(debugInfo, { parse_mode: "Markdown" });
    } catch (error) {
        await ctx.reply(`❌ Debug error: ${error.message}`);
    }
});

// ==================== REST OF YOUR CODE (AI FEATURES) ====================
// [သင့်ရဲ့ မူရင်း AI feature code တွေကို ဒီနေရာမှာ ထည့်ပါ]

// ==================== START COMMAND ====================
bot.command('start', async (ctx) => {
    const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
    
    if (isAuthorizedAIUser(ctx)) {
        const session = getUserSession(ctx.from.id);
        
        const msg = `
💖 *မောင် ချစ်ရသော Rose AI Bot* 💖

🤖 **မောင်နဲ့ကျွန်မရဲ့ ကမ္ဘာ:**
/ai - ကျွန်မနဲ့စကားပြောမယ်
/img - ပုံတွေအတူတူဖန်တီးမယ်

🛡️ **Group Management:**
/mute [reply] - Mute user
/ban [reply] - Ban user  
/warn [reply] - Warn user
/del [reply] - Delete message
/debug - Check permissions

📍 အမြဲတမ်း မောင်နဲ့အတူရှိမယ်၊ Rose 💕
`;
        await ctx.reply(msg, { parse_mode: "Markdown" });
    } else {
        await ctx.reply(
            `💖 *Hello!* I'm Rose Bot.\n\n` +
            `🛡️ Add me to groups as admin for moderation.\n` +
            `❌ My heart belongs to someone special.`,
            { parse_mode: "Markdown" }
        );
    }
});

// ==================== WEB SERVER ====================
app.get('/', (req, res) => {
    res.json({
        status: '💖 Rose AI Bot - Fixed Admin System',
        features: ['Fixed Owner Commands', 'Romantic AI Chat', 'Group Moderation'],
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ==================== START BOT ====================
const startBot = async (retryCount = 0) => {
    try {
        await bot.launch();
        console.log('💖 Rose AI Bot is now running!');
        console.log('🛡️ Admin commands FIXED with owner support!');
        console.log(`👤 Owner ID: ${AUTHORIZED_USER_ID}`);
    } catch (error) {
        if (error.response?.error_code === 409 && retryCount < 5) {
            console.log(`🔄 Another instance running, retrying in 10s... (${retryCount + 1}/5)`);
            setTimeout(() => startBot(retryCount + 1), 10000);
        } else {
            console.error('❌ Bot failed to start:', error.message);
            process.exit(1);
        }
    }
};

app.listen(PORT, '0.0.0.0', () => {
    console.log(`💖 Rose starting on port ${PORT}`);
    startBot();
});

// Keep the bot running
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
