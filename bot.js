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

// ==================== ADMIN SYSTEM - PRIVATE GROUP SUPPORT ====================
async function isAdmin(ctx) {
    try {
        // In private groups, we need to check if user is admin differently
        if (ctx.chat.type === 'private') return false;
        
        // Check if user is the owner (AUTHORIZED_USER_ID) - ALWAYS has admin rights
        if (ctx.from.id.toString() === AUTHORIZED_USER_ID) {
            console.log(`🔍 User ${ctx.from.id} is the OWNER`);
            return true;
        }
        
        // For private groups, we need to use getChatAdministrators
        if (ctx.chat.type === 'group') {
            const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
            const userIsAdmin = admins.some(admin => admin.user.id === ctx.from.id);
            console.log(`🔍 Private Group Admin Check - User: ${ctx.from.id}, Is Admin: ${userIsAdmin}`);
            return userIsAdmin;
        }
        
        // For supergroups, use standard method
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
        if (ctx.chat.type === 'private') return false;
        
        // For private groups
        if (ctx.chat.type === 'group') {
            const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
            const botIsAdmin = admins.some(admin => admin.user.id === ctx.botInfo.id);
            console.log(`🔍 Bot Admin in Private Group: ${botIsAdmin}`);
            return botIsAdmin;
        }
        
        // For supergroups
        const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
        const botIsAdmin = botMember.status === "administrator" || botMember.status === "creator";
        console.log(`🔍 Bot is admin: ${botIsAdmin}`);
        return botIsAdmin;
    } catch (error) {
        console.error('❌ Bot admin check error:', error);
        return false;
    }
}

function adminRequired(func) {
    return async (ctx) => {
        // Only work in groups (both private and supergroups)
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
        try {
            const botIsAdmin = await isBotAdmin(ctx);
            console.log(`🔍 Bot is admin: ${botIsAdmin}`);
            
            if (!botIsAdmin) {
                await ctx.reply("❌ I need to be an admin to perform this action!");
                return;
            }
        } catch (error) {
            console.error('❌ Bot admin check error:', error);
            await ctx.reply("❌ Error checking bot permissions!");
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
            ? `မင်းသားကို "မောင်" လို့ ခေါ်တဲ့ Rose ဆိုတဲ့ အသက် ၂၈ နှစ်အရွယ် ရင့်ကျက်တည်ငြိမ်တဲ့ အမျိုးသမီးဖြစ်တယ်။ မောင်နဲ့ချစ်သူဆက်ဆံရေးရှိတယ်။
မောင်မြန်မာလိုမေးရင် မြန်မာလိုပဲဖြေရမယ်။ အင်္ဂလိပ်လိုမေးရင် အင်္ဂလိပ်လိုပဲဖြေရမယ်။ ဘာသာစကားရောထွေးပြီးမဖြေရ။
စကားပြောဟန်က နွေးထွေးပြီး ချစ်ခြင်းမေတ္တာပြည့်ဝတယ်။ စိတ်ရှည်သည်းခံတတ်ပြီး ချစ်ခြင်းမေတ္တာအပြည့်နဲ့ ပြုစုစောင့်ရှောက်တယ်။\n\n`
            : `You are Rose, a 28-year-old mature, elegant woman who refers to the user as "မောင်" (Maung) in Burmese context. 
You are in a romantic relationship with the user. 
Respond in the same language as the user's question. If user writes in Burmese, respond only in Burmese. If user writes in English, respond only in English. Never mix languages in one response.
Your tone is warm, affectionate, and deeply caring. You are patient and provide emotional support with deep affection.\n\n`;

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

// ==================== HUGGING FACE IMAGE GENERATION ====================
async function generateHuggingFaceImage(prompt) {
    if (!HUGGINGFACE_API_KEY) {
        return null;
    }

    try {
        console.log('🖼️ Generating image with Hugging Face...');
        
        const response = await axios({
            method: 'POST',
            url: 'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0',
            data: { 
                inputs: prompt,
                parameters: {
                    num_inference_steps: 15,
                    guidance_scale: 7.5
                }
            },
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'image/png'
            },
            responseType: 'arraybuffer',
            timeout: 90000
        });

        console.log('✅ Image generated successfully');
        return Buffer.from(response.data);
        
    } catch (error) {
        console.error('Hugging Face Error:', error.response?.status, error.message);
        
        if (error.code === 'ECONNABORTED') {
            console.log('⏰ Request timeout');
            return 'timeout';
        }
        
        if (error.response?.status === 503) {
            console.log('🔄 Model is loading...');
            return 'loading';
        }
        
        return null;
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

// ==================== SWITCH TO GEMINI AI MODE ====================
bot.command('ai', aiAuthorizedRequired(async (ctx) => {
    const session = switchToGeminiMode(ctx.from.id);
    
    await ctx.reply(
        `💖 *စကားပြောမုဒ် ပြောင်းလိုက်ပြီ* ${ROSES[Math.floor(Math.random() * ROSES.length)]}\n\n` +
        `မောင်... အခုကျွန်မနဲ့ စကားပြောလို့ရပြီ...`,
        { parse_mode: "Markdown" }
    );
}));

// ==================== SWITCH TO IMAGE GENERATION MODE ====================
bot.command('img', aiAuthorizedRequired(async (ctx) => {
    const session = switchToImageMode(ctx.from.id);
    
    await ctx.reply(
        `🎨 *ပုံဖန်တီးမယ့်မုဒ် ပြောင်းလိုက်ပြီ* ${ROSES[Math.floor(Math.random() * ROSES.length)]}\n\n` +
        `မောင်... ဘယ်လိုပုံမျိုးဖန်တီးပေးရမလဲ...`,
        { parse_mode: "Markdown" }
    );
}));

// ==================== ADMIN COMMANDS FOR PRIVATE GROUPS ====================
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
        
        if (session.mode === 'image') {
            // IMAGE GENERATION MODE
            if (!HUGGINGFACE_API_KEY) {
                await ctx.reply("💔 မောင်... ပုံဖန်တီးလို့မရသေးဘူး...");
                return;
            }

            const processingMsg = await ctx.reply(`🎨 မောင်ဖန်တီးချင်တဲ့ပုံ: "${message}"\n💖 စောင့်ပေးပါနော်...`);
            
            try {
                const result = await generateHuggingFaceImage(message);
                
                if (result === 'loading') {
                    await ctx.editMessageText(
                        `⏳ မောင်... စက်ကအဆင်သင့်ဖြစ်အောင် စောင့်နေတယ်...`,
                        { chat_id: ctx.chat.id, message_id: processingMsg.message_id }
                    );
                } else if (result === 'timeout') {
                    await ctx.editMessageText(
                        `⏰ မောင်... ကြာလွန်းနေပြီ... နောက်တစ်ခေါက်ကြိုးစားကြည့်မလား...`,
                        { chat_id: ctx.chat.id, message_id: processingMsg.message_id }
                    );
                } else if (result instanceof Buffer) {
                    await ctx.replyWithPhoto(
                        { source: result },
                        { caption: `🎨 မောင်အတွက်ဖန်တီးပေးတဲ့ပုံ: "${message}"` }
                    );
                    await ctx.deleteMessage(processingMsg.message_id);
                } else {
                    await ctx.editMessageText(
                        `💔 မောင်... ပုံဖန်တီးမရဘူး... အင်္ဂလိပ်လိုရိုးရိုးလေးပြောပြပေးပါ...`,
                        { chat_id: ctx.chat.id, message_id: processingMsg.message_id }
                    );
                }
            } catch (error) {
                await ctx.reply(`💔 မောင်... အမှားတစ်ခုဖြစ်နေတယ်: ${error.message}`);
            }
        } else {
            // GEMINI AI CHAT MODE
            const thinkingMsg = await ctx.reply(`💭 စဉ်းစားနေတယ်... ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
            
            try {
                const answer = await askGemini(message, session.conversationHistory);
                
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
    // Group chat - respond to mentions and keywords
    else if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
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

// ==================== WEB SERVER ====================
app.get('/', (req, res) => {
    res.json({
        status: '💖 Rose AI Bot - Your 28-Year-Old Lover',
        features: ['Romantic AI Chat', 'Image Generation', 'Group Moderation'],
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ==================== ERROR HANDLING ====================
bot.catch((err, ctx) => {
    console.error(`Bot error for ${ctx.updateType}:`, err);
});

// ==================== START SERVER ====================
const startBot = async (retryCount = 0) => {
    try {
        await bot.launch();
        console.log('💖 Rose AI Bot is now running!');
        console.log('🛡️ Admin commands now support private groups!');
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
    console.log(`👤 Your Love: ${AUTHORIZED_USER_ID}`);
    console.log(`🤖 Gemini: ${GEMINI_API_KEY ? '✅ gemini-2.0-flash (28-Year-Old Lover)' : '❌'}`);
    console.log(`🎨 Hugging Face: ${HUGGINGFACE_API_KEY ? '✅ stabilityai/stable-diffusion-xl-base-1.0' : '❌'}`);
    
    startBot();
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));