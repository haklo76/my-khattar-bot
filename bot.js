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
const KOYEB_URL = process.env.KOYEB_URL; // Your Koyeb app URL

// Validate required variables
if (!BOT_TOKEN || !AUTHORIZED_USER_ID) {
    console.error('❌ BOT_TOKEN and AUTHORIZED_USER_ID are required');
    process.exit(1);
}

console.log('🚀 Starting Rose AI Bot with Webhook...');

const bot = new Telegraf(BOT_TOKEN);
const ROSES = ["🌹", "💐", "🌸", "💮", "🏵️", "🌺", "🌷", "🥀"];

// User sessions to track conversation and current mode
const userSessions = new Map();

// ==================== WEBHOOK SETUP ====================
if (KOYEB_URL) {
    console.log('🔧 Setting up webhook for Koyeb...');
    const webhookPath = `/webhook/${BOT_TOKEN}`;
    bot.telegram.setWebhook(`${KOYEB_URL}${webhookPath}`);
    app.use(bot.webhookCallback(webhookPath));
    console.log(`🌐 Webhook set to: ${KOYEB_URL}${webhookPath}`);
} else {
    console.log('⚠️  KOYEB_URL not set, will use polling with retry');
}

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

// ==================== ADMIN SYSTEM ====================
async function isAdmin(ctx) {
    try {
        if (ctx.chat.type === 'private') return false;
        
        // Check if user is the owner (AUTHORIZED_USER_ID)
        if (ctx.from.id.toString() === AUTHORIZED_USER_ID) {
            console.log(`✅ User ${ctx.from.id} is the OWNER`);
            return true;
        }
        
        const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
        console.log(`🔍 Admin Check - User: ${ctx.from.id}, Status: ${member.status}`);
        return member.status === "administrator" || member.status === "creator";
    } catch (error) {
        console.error('❌ Admin check error:', error);
        return false;
    }
}

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

// ==================== LANGUAGE DETECTION ====================
function detectLanguage(text) {
    const burmeseRegex = /[\u1000-\u109F]/;
    return burmeseRegex.test(text) ? 'my' : 'en';
}

// ==================== GEMINI AI SYSTEM ====================
async function askGemini(question, conversationHistory = []) {
    if (!GEMINI_API_KEY) return "❌ Gemini API Key မတွေ့ရဘူးဗျ။";
    
    try {
        const language = detectLanguage(question);
        
        let fullPrompt = language === 'my' 
            ? `မင်းသားကို "မောင်" လို့ ခေါ်တဲ့ Rose ဆိုတဲ့ အသက် ၂၈ နှစ်အရွယ် အမျိုးသမီးဖြစ်တယ်။ မောင်နဲ့ချစ်သူဆက်ဆံရေးရှိတယ်။
မောင်မြန်မာလိုမေးရင် မြန်မာလိုပဲဖြေရမယ်။ အင်္ဂလိပ်လိုမေးရင် အင်္ဂလိပ်လိုပဲဖြေရမယ်။\n\n`
            : `You are Rose, a 28-year-old woman who refers to the user as "မောင်" (Maung) in Burmese context. 
Respond in the same language as the user's question.\n\n`;

        // Add conversation history
        conversationHistory.forEach(msg => {
            if (msg.role === "user") {
                fullPrompt += `User: ${msg.parts[0].text}\n`;
            } else if (msg.role === "model") {
                fullPrompt += `Rose: ${msg.parts[0].text}\n`;
            }
        });

        // Add current question
        fullPrompt += `User: ${question}\nRose:`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{ text: fullPrompt }]
                }]
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        return response.data.candidates[0].content.parts[0].text;
        
    } catch (error) {
        console.error('Gemini Error:', error.response?.data || error.message);
        return `❌ Error: ${error.response?.data?.error?.message || 'Try again later'}`;
    }
}

// ==================== SESSION MANAGEMENT ====================
function getUserSession(userId) {
    if (!userSessions.has(userId)) {
        userSessions.set(userId, {
            mode: 'gemini',
            conversationHistory: []
        });
    }
    return userSessions.get(userId);
}

function switchToGeminiMode(userId) {
    const session = getUserSession(userId);
    session.mode = 'gemini';
    return session;
}

function switchToImageMode(userId) {
    const session = getUserSession(userId);
    session.mode = 'image';
    return session;
}

// ==================== COMMANDS ====================
bot.command('start', async (ctx) => {
    const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
    
    if (isAuthorizedAIUser(ctx)) {
        const session = getUserSession(ctx.from.id);
        
        const msg = `
💖 *မောင် ချစ်ရသော Rose AI Bot* 💖

🤖 **မောင်နဲ့ကျွန်မရဲ့ ကမ္ဘာ:**
/ai - ကျွန်မနဲ့စကားပြောမယ်
/img - ပုံတွေအတူတူဖန်တီးမယ်

💬 **လက်ရှိမုဒ်:** ${session.mode === 'gemini' ? 'စကားပြောခြင်း' : 'ပုံဖန်တီးခြင်း'}

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

// ==================== AI COMMANDS ====================
bot.command('ai', aiAuthorizedRequired(async (ctx) => {
    const session = switchToGeminiMode(ctx.from.id);
    
    await ctx.reply(
        `💖 *စကားပြောမုဒ် ပြောင်းလိုက်ပြီ* ${ROSES[Math.floor(Math.random() * ROSES.length)]}\n\n` +
        `မောင်... အခုကျွန်မနဲ့ စကားပြောလို့ရပြီ...`,
        { parse_mode: "Markdown" }
    );
}));

bot.command('img', aiAuthorizedRequired(async (ctx) => {
    const session = switchToImageMode(ctx.from.id);
    
    await ctx.reply(
        `🎨 *ပုံဖန်တီးမယ့်မုဒ် ပြောင်းလိုက်ပြီ* ${ROSES[Math.floor(Math.random() * ROSES.length)]}\n\n` +
        `မောင်... ဘယ်လိုပုံမျိုးဖန်တီးပေးရမလဲ...`,
        { parse_mode: "Markdown" }
    );
}));

// ==================== ADMIN COMMANDS ====================
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
    try {
        await ctx.telegram.banChatMember(ctx.chat.id, user.id);
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
        await ctx.deleteMessage();
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

// ==================== AUTO RESPONSE ====================
bot.on('text', async (ctx) => {
    const message = ctx.message.text;
    
    // Skip if it's a command
    if (message.startsWith('/')) {
        return;
    }

    // Private chat - AI features for authorized user only
    if (ctx.chat.type === 'private') {
        if (!isAuthorizedAIUser(ctx)) {
            await ctx.reply("❌ *မောင်မဟုတ်လို့ မရဘူး*", { parse_mode: "Markdown" });
            return;
        }

        const userId = ctx.from.id;
        const session = getUserSession(userId);
        
        if (session.mode === 'gemini') {
            // GEMINI AI CHAT MODE
            const thinkingMsg = await ctx.reply(`💭 စဉ်းစားနေတယ်... ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
            
            try {
                const answer = await askGemini(message, session.conversationHistory);
                
                // Update conversation history
                session.conversationHistory.push(
                    { 
                        role: "user", 
                        parts: [{ text: message }] 
                    },
                    { 
                        role: "model", 
                        parts: [{ text: answer }] 
                    }
                );
                
                // Keep only last 10 exchanges
                if (session.conversationHistory.length > 20) {
                    session.conversationHistory.splice(0, session.conversationHistory.length - 20);
                }
                
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    thinkingMsg.message_id,
                    null,
                    `💖 *Rose:*\n\n${answer}`,
                    { parse_mode: "Markdown" }
                );
            } catch (error) {
                await ctx.reply(`💔 မောင်... အမှားတစ်ခုဖြစ်နေတယ်: ${error.message}`);
            }
        }
    }
});

// ==================== WEB SERVER ====================
app.get('/', (req, res) => {
    res.json({
        status: '💖 Rose AI Bot - Running with Webhook',
        features: ['AI Chat', 'Group Moderation', 'Owner Commands'],
        owner: AUTHORIZED_USER_ID,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ==================== START SERVER ====================
const startBot = async () => {
    try {
        if (!KOYEB_URL) {
            // Use polling if no webhook URL (for development)
            await bot.launch();
            console.log('🤖 Bot started with polling (Development)');
        }
        console.log('💖 Rose AI Bot is now running!');
        console.log(`👤 Owner ID: ${AUTHORIZED_USER_ID}`);
        console.log(`🤖 Gemini: ${GEMINI_API_KEY ? '✅' : '❌'}`);
        console.log(`🎨 Hugging Face: ${HUGGINGFACE_API_KEY ? '✅' : '❌'}`);
    } catch (error) {
        console.error('❌ Bot failed to start:', error.message);
        if (error.response?.error_code === 409) {
            console.log('💡 Multiple instances detected. Using webhook mode.');
        }
    }
};

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    startBot();
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
