const { bot, ROSES, isGroup, AUTHORIZED_USER_ID } = require('./config');

console.log('🛡️ ADMIN FEATURES - Loading FIRST...');

// ==================== SPECIAL ADMINS CONFIG ====================
const SPECIAL_ADMINS = [
    AUTHORIZED_USER_ID,  // Owner
    "123456789",         // Add other special admin IDs here
    "987654321"          // Add more admins as needed
];

// ==================== ADMIN SYSTEM ====================
function isSpecialAdmin(userId) {
    return SPECIAL_ADMINS.includes(userId.toString());
}

async function isAdmin(ctx) {
    try {
        // In private chats, no admin rights
        if (ctx.chat.type === 'private') {
            return false;
        }
        
        // Check if user is special admin (including owner)
        if (isSpecialAdmin(ctx.from.id)) {
            console.log(`⭐ Special Admin: ${ctx.from.id}`);
            return true;
        }
        
        // For groups, check if user is admin in the group
        const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
        const userIsAdmin = admins.some(admin => admin.user.id === ctx.from.id);
        
        return userIsAdmin;
        
    } catch (error) {
        console.error('❌ Admin check error:', error);
        return false;
    }
}

async function isBotAdmin(ctx) {
    try {
        if (ctx.chat.type === 'private') {
            return false;
        }
        
        const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
        const botIsAdmin = admins.some(admin => admin.user.id === ctx.botInfo.id);
        
        return botIsAdmin;
        
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
        
        // Check if user is admin OR special admin
        const userIsAdmin = await isAdmin(ctx);
        
        if (!userIsAdmin) {
            await ctx.reply("❌ Admins only!");
            return;
        }
        
        // Check if bot is admin in the group
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

// ==================== BASIC ADMIN COMMANDS ====================
bot.command('mute', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user's message to mute them.");
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
        console.log('✅ Messages deleted by admin');
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
    
    // Skip commands
    if (message.startsWith('/')) {
        return;
    }

    // Group chat - respond to mentions and keywords
    if (isGroup(ctx)) {
        const text = message.toLowerCase();
        const botUsername = ctx.botInfo.username.toLowerCase();
        const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
        
        // Check if bot is mentioned
        if (text.includes(`@${botUsername}`)) {
            await ctx.reply(`💖 Hello! I'm Rose. My heart belongs to my special someone.`);
            return;
        }
        
        // Keywords for auto-reply in groups
        const greetingKeywords = [
            'good morning', 'good night', 'good evening', 'good afternoon',
            'hello', 'hi', 'hey', 'morning', 'night',
            'thank you', 'thanks', 'bye', 'goodbye',
            'rose', 'rose bot', 'i love you', 'love you',
            'ချစ်လား', 'အာဘွား'
        ];
        
        // Check if message contains any greeting keywords
        const containsKeyword = greetingKeywords.some(keyword => 
            text.includes(keyword)
        );
        
        if (containsKeyword) {
            // Auto-reply based on the keyword
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

console.log('✅ Admin Features loaded - READY FOR GROUPS');
