const { bot, ROSES, isGroup, AUTHORIZED_USER_ID } = require('./shared');

// ==================== ADMIN SYSTEM ====================
async function isAdmin(ctx) {
    try {
        if (ctx.chat.type === 'private') return false;
        
        // Check if user is the owner
        if (ctx.from.id.toString() === AUTHORIZED_USER_ID) {
            console.log(`🔍 User ${ctx.from.id} is the OWNER`);
            return true;
        }
        
        // For private groups
        if (ctx.chat.type === 'group') {
            const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
            const userIsAdmin = admins.some(admin => admin.user.id === ctx.from.id);
            return userIsAdmin;
        }
        
        // For supergroups
        const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
        return member.status === "administrator" || member.status === "creator";
    } catch (error) {
        console.error('❌ Admin check error:', error);
        return false;
    }
}

async function isBotAdmin(ctx) {
    try {
        if (ctx.chat.type === 'private') return false;
        
        if (ctx.chat.type === 'group') {
            const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
            const botIsAdmin = admins.some(admin => admin.user.id === ctx.botInfo.id);
            return botIsAdmin;
        }
        
        const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
        return botMember.status === "administrator" || botMember.status === "creator";
    } catch (error) {
        console.error('❌ Bot admin check error:', error);
        return false;
    }
}

function adminRequired(func) {
    return async (ctx) => {
        if (ctx.chat.type === "private") {
            await ctx.reply("❌ This command only works in groups.");
            return;
        }
        
        const userIsAdmin = await isAdmin(ctx);
        if (!userIsAdmin) {
            await ctx.reply("❌ Admins only!");
            return;
        }
        
        try {
            const botIsAdmin = await isBotAdmin(ctx);
            if (!botIsAdmin) {
                await ctx.reply("❌ I need to be an admin to perform this action!");
                return;
            }
        } catch (error) {
            await ctx.reply("❌ Error checking bot permissions!");
            return;
        }
        
        return func(ctx);
    };
}

// ==================== ADMIN COMMANDS ====================
bot.command('mute', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user's message to mute them.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    try {
        const untilDate = Math.floor(Date.now() / 1000) + 3600;
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
        await ctx.reply(`🔇 Muted ${user.first_name} for 1 hour ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
    } catch (error) {
        await ctx.reply(`❌ Mute failed: ${error.message}`);
    }
}));

bot.command('ban', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user's message to ban them.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    try {
        await ctx.telegram.banChatMember(ctx.chat.id, user.id);
        await ctx.reply(`🔨 Banned ${user.first_name} ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
    } catch (error) {
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
        await ctx.deleteMessage();
    } catch (error) {
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

// ==================== GROUP AUTO RESPONSES ====================
bot.on('text', async (ctx) => {
    const message = ctx.message.text;
    
    if (message.startsWith('/')) return;

    if (isGroup(ctx)) {
        const text = message.toLowerCase();
        const botUsername = ctx.botInfo.username.toLowerCase();
        const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
        
        if (text.includes(`@${botUsername}`)) {
            await ctx.reply(`💖 Hello! I'm Rose. My heart belongs to my special someone.`);
            return;
        }
        
        const greetingKeywords = [
            'good morning', 'good night', 'good evening', 'good afternoon',
            'hello', 'hi', 'hey', 'morning', 'night',
            'thank you', 'thanks', 'bye', 'goodbye',
            'rose', 'rose bot', 'i love you', 'love you',
            'ချစ်လား', 'အာဘွား'
        ];
        
        const containsKeyword = greetingKeywords.some(keyword => 
            text.includes(keyword)
        );
        
        if (containsKeyword) {
            if (text.includes('good morning')) {
                await ctx.reply(`🌅 Good morning! ${randomRose}`);
            } else if (text.includes('good night')) {
                await ctx.reply(`🌙 Good night! ${randomRose}`);
            } else if (text.includes('good evening')) {
                await ctx.reply(`🌆 Good evening! ${randomRose}`);
            } else if (text.includes('good afternoon')) {
                await ctx.reply(`☀️ Good afternoon! ${randomRose}`);
            } else if (text.includes('thank')) {
                await ctx.reply(`${randomRose} You're welcome!`);
            } else if (text.includes('bye') || text.includes('goodbye')) {
                await ctx.reply(`👋 Goodbye! ${randomRose}`);
            } else if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
                await ctx.reply(`${randomRose} Hello!`);
            } else if (text.includes('i love you') || text.includes('love you')) {
                await ctx.reply(`💗 Love you too! ${randomRose}`);
            } else if (text.includes('ချစ်လား')) {
                await ctx.reply(`ချစ်တယ် 💗 ${randomRose}`);
            } else if (text.includes('အာဘွား')) {
                await ctx.reply(`အာဘွားပါရှင့် 😘 ${randomRose}`);
            } else {
                await ctx.reply(`${randomRose} Hi there!`);
            }
        }
    }
});

console.log('✅ Group Admin Features loaded successfully');