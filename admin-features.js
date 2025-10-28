const { bot, ROSES, isGroup, AUTHORIZED_USER_ID, userSessions } = require('./config');

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
        console.log(`🔍 Admin check - User: ${ctx.from.id}, Chat Type: ${ctx.chat.type}`);
        
        // In private chats, no admin rights (except for special commands)
        if (ctx.chat.type === 'private') {
            return false;
        }
        
        // Check if user is special admin (including owner)
        if (isSpecialAdmin(ctx.from.id)) {
            console.log(`✅ User ${ctx.from.id} is SPECIAL ADMIN/OWNER`);
            return true;
        }
        
        // For groups and supergroups, check if user is admin in the group
        const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
        const userIsAdmin = admins.some(admin => admin.user.id === ctx.from.id);
        
        console.log(`🔍 User ${ctx.from.id} is group admin: ${userIsAdmin}`);
        return userIsAdmin;
        
    } catch (error) {
        console.error('❌ Admin check error:', error);
        return false;
    }
}

async function isBotAdmin(ctx) {
    try {
        console.log(`🔍 Bot admin check - Chat: ${ctx.chat.id}, Type: ${ctx.chat.type}`);
        
        if (ctx.chat.type === 'private') {
            return false;
        }
        
        const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
        const botIsAdmin = admins.some(admin => admin.user.id === ctx.botInfo.id);
        
        console.log(`🔍 Bot ${ctx.botInfo.id} is admin: ${botIsAdmin}`);
        return botIsAdmin;
        
    } catch (error) {
        console.error('❌ Bot admin check error:', error);
        return false;
    }
}

function adminRequired(func) {
    return async (ctx) => {
        console.log(`🔍 Admin command received: ${ctx.message.text}`);
        
        // Only work in groups
        if (ctx.chat.type === "private") {
            await ctx.reply("❌ This command only works in groups.");
            return;
        }
        
        // Check if user is admin OR special admin
        const userIsAdmin = await isAdmin(ctx);
        console.log(`🔍 User ${ctx.from.id} admin check result: ${userIsAdmin}`);
        
        if (!userIsAdmin) {
            await ctx.reply("❌ Admins only!");
            return;
        }
        
        // Check if bot is admin in the group
        try {
            const botIsAdmin = await isBotAdmin(ctx);
            console.log(`🔍 Bot admin check result: ${botIsAdmin}`);
            
            if (!botIsAdmin) {
                await ctx.reply("❌ I need to be an admin to perform this action!");
                return;
            }
        } catch (error) {
            console.error('❌ Bot admin check error:', error);
            await ctx.reply("❌ Error checking bot permissions!");
            return;
        }
        
        console.log('✅ All admin checks passed - executing command');
        return func(ctx);
    };
}

function ownerRequired(func) {
    return async (ctx) => {
        console.log(`🔍 Owner command received: ${ctx.message.text}`);
        
        // Check if user is the owner
        if (!isSpecialAdmin(ctx.from.id) || ctx.from.id.toString() !== AUTHORIZED_USER_ID) {
            await ctx.reply("❌ Owner only command!");
            return;
        }
        
        console.log('✅ Owner verified - executing command');
        return func(ctx);
    };
}

// ==================== BASIC ADMIN COMMANDS ====================
bot.command('mute', adminRequired(async (ctx) => {
    console.log('🔇 Mute command executed');
    
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user's message to mute them.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    console.log(`🔇 Muting user: ${user.first_name} (${user.id})`);
    
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
        console.error('Mute error:', error);
        await ctx.reply(`❌ Mute failed: ${error.message}`);
    }
}));

bot.command('ban', adminRequired(async (ctx) => {
    console.log('🔨 Ban command executed');
    
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user's message to ban them.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    console.log(`🔨 Banning user: ${user.first_name} (${user.id})`);
    
    try {
        await ctx.telegram.banChatMember(ctx.chat.id, user.id);
        await ctx.reply(`🔨 Banned ${user.first_name} ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
    } catch (error) {
        console.error('Ban error:', error);
        await ctx.reply(`❌ Ban failed: ${error.message}`);
    }
}));

bot.command('del', adminRequired(async (ctx) => {
    console.log('🗑️ Delete command executed');
    
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a message to delete it.");
        return;
    }
    
    try {
        await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.reply_to_message.message_id);
        await ctx.deleteMessage(); // Delete the command message too
        console.log('✅ Messages deleted successfully');
    } catch (error) {
        console.error('Delete error:', error);
        await ctx.reply(`❌ Delete failed: ${error.message}`);
    }
}));

bot.command('warn', adminRequired(async (ctx) => {
    console.log('⚠️ Warn command executed');
    
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user to warn them.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    console.log(`⚠️ Warning user: ${user.first_name} (${user.id})`);
    
    await ctx.reply(`⚠️ ${user.first_name}, please follow group rules! ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
}));

// ==================== OWNER ONLY COMMANDS ====================
bot.command('broadcast', ownerRequired(async (ctx) => {
    console.log(`🔊 Broadcast command from owner: ${ctx.from.id}`);
    
    const message = ctx.message.text.replace('/broadcast', '').trim();
    if (!message) {
        await ctx.reply("❌ Usage: /broadcast <message>");
        return;
    }
    
    // Broadcast logic would go here (need to store group IDs)
    await ctx.reply(`📢 [BROADCAST] ${message}\n\n- Owner`);
    console.log(`✅ Broadcast sent by owner: ${message}`);
}));

bot.command('stats', ownerRequired(async (ctx) => {
    console.log(`📊 Stats command from owner: ${ctx.from.id}`);
    
    const stats = `
📊 *Bot Statistics - Owner Report*

👑 Owner: ${AUTHORIZED_USER_ID}
👥 Total Users: ${userSessions.size}
💬 Active Sessions: ${userSessions.size}
🕒 Uptime: ${process.uptime().toFixed(0)} seconds
💾 Memory: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB
⭐ Special Admins: ${SPECIAL_ADMINS.length}

${ROSES[Math.floor(Math.random() * ROSES.length)]} *Rose AI Bot - Owner Panel*
    `;
    
    await ctx.reply(stats, { parse_mode: "Markdown" });
}));

bot.command('restart', ownerRequired(async (ctx) => {
    console.log(`🔄 Restart command from owner: ${ctx.from.id}`);
    
    await ctx.reply("🔄 Restarting bot by owner command...");
    console.log("✅ Bot restarting by owner command");
    process.exit(0);
}));

// ==================== SPECIAL ADMIN COMMANDS ====================
bot.command('userinfo', adminRequired(async (ctx) => {
    console.log('👤 Userinfo command executed');
    
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to user to get info!");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    const isSpecial = isSpecialAdmin(user.id);
    
    const userInfo = `
👤 *User Information*

🆔 ID: \`${user.id}\`
📛 Name: ${user.first_name} ${user.last_name || ''}
📧 Username: @${user.username || 'N/A'}
🌐 Language: ${user.language_code || 'N/A'}
👑 Is Bot: ${user.is_bot ? 'Yes' : 'No'}
⭐ Special Admin: ${isSpecial ? 'Yes' : 'No'}
👑 Is Owner: ${user.id.toString() === AUTHORIZED_USER_ID ? 'Yes' : 'No'}

💬 In chat: ${ctx.chat.title || 'Private'}
🆔 Chat ID: \`${ctx.chat.id}\`
    `;
    
    await ctx.reply(userInfo, { parse_mode: "Markdown" });
}));

bot.command('adminlist', adminRequired(async (ctx) => {
    console.log('📋 Adminlist command executed');
    
    try {
        const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
        let adminList = "👑 *Group Admins*\n\n";
        
        admins.forEach(admin => {
            const status = admin.status === 'creator' ? '👑 Owner' : '⭐ Admin';
            adminList += `${status}: ${admin.user.first_name}`;
            if (admin.user.username) {
                adminList += ` (@${admin.user.username})`;
            }
            adminList += `\n🆔 ID: \`${admin.user.id}\`\n\n`;
        });
        
        await ctx.reply(adminList, { parse_mode: "Markdown" });
    } catch (error) {
        console.error('Admin list error:', error);
        await ctx.reply("❌ Failed to get admin list");
    }
}));

// ==================== GROUP AUTO RESPONSES ====================
bot.on('text', async (ctx) => {
    const message = ctx.message.text;
    
    console.log(`🔍 Message received: "${message}" in ${ctx.chat.type}`);
    
    // Skip commands
    if (message.startsWith('/')) {
        console.log('⏩ Skipping command');
        return;
    }

    // Group chat - respond to mentions and keywords
    if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
        console.log('🏠 Group message detected');
        const text = message.toLowerCase();
        const botUsername = ctx.botInfo.username.toLowerCase();
        const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
        
        console.log(`🔍 Bot username: @${botUsername}`);
        console.log(`🔍 Message contains bot mention: ${text.includes(`@${botUsername}`)}`);
        
        // Check if bot is mentioned
        if (text.includes(`@${botUsername}`)) {
            console.log('✅ Bot mentioned - responding');
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
        
        console.log(`🔍 Contains keyword: ${containsKeyword}`);
        
        if (containsKeyword) {
            console.log('✅ Keyword detected - responding');
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
                // General response for other rose-related keywords
                await ctx.reply(`${randomRose} Hi there!`);
            }
        } else {
            console.log('⏩ No keyword found - skipping');
        }
    }
});

console.log('✅ Admin Features loaded successfully');
console.log(`⭐ Special Admins: ${SPECIAL_ADMINS.join(', ')}`);
console.log(`👑 Owner: ${AUTHORIZED_USER_ID}`);