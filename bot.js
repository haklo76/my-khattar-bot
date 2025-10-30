const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');

// Environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const AUTHORIZED_USER_ID = process.env.AUTHORIZED_USER_ID || '5591909458';
const PORT = process.env.PORT || 8000;

// Bot and app
const bot = new Telegraf(BOT_TOKEN);
const app = express();

// Common arrays and sessions
const ROSES = ["🌹", "💐", "🌸", "💮", "🏵️", "🌺", "🌷", "🥀"];
const userSessions = new Map();

// ==================== HELPER FUNCTIONS ====================
function isAuthorizedAIUser(ctx) {
    const userId = ctx.from?.id?.toString();
    return ctx.chat.type === 'private' && userId === AUTHORIZED_USER_ID;
}

function isGroup(ctx) {
    return ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
}

function getUserSession(userId) {
    if (!userSessions.has(userId)) {
        userSessions.set(userId, {
            mode: 'gemini',
            conversationHistory: []
        });
    }
    return userSessions.get(userId);
}

function detectLanguage(text) {
    const burmeseRegex = /[\u1000-\u109F]/;
    return burmeseRegex.test(text) ? 'my' : 'en';
}

// ==================== AI FUNCTIONS ====================
async function askGemini(question, conversationHistory = []) {
    if (!GEMINI_API_KEY) return "❌ Gemini API Key မတွေ့ရဘူး။";
    
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

        conversationHistory.forEach(msg => {
            if (msg.role === "user") fullPrompt += `User: ${msg.parts[0].text}\n`;
            else if (msg.role === "model") fullPrompt += `Rose: ${msg.parts[0].text}\n`;
        });

        fullPrompt += `User: ${question}\nRose:`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            { contents: [{ parts: [{ text: fullPrompt }] }] },
            { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
        );

        return response.data.candidates[0].content.parts[0].text;
        
    } catch (error) {
        return `❌ Error: ${error.response?.data?.error?.message || 'Try again later'}`;
    }
}

async function generateHuggingFaceImage(prompt) {
    if (!HUGGINGFACE_API_KEY) return null;

    try {
        const response = await axios({
            method: 'POST',
            url: 'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5',
            data: { inputs: prompt },
            headers: { 'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`, 'Content-Type': 'application/json' },
            responseType: 'arraybuffer',
            timeout: 60000
        });

        return Buffer.from(response.data);
    } catch (error) {
        return null;
    }
}

// ==================== ADMIN FUNCTIONS ====================
const SPECIAL_ADMINS = [AUTHORIZED_USER_ID];

function isSpecialAdmin(userId) {
    return SPECIAL_ADMINS.includes(userId.toString());
}

async function isAdmin(ctx) {
    try {
        if (ctx.chat.type === 'private') return false;
        if (isSpecialAdmin(ctx.from.id)) return true;
        
        const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
        return admins.some(admin => admin.user.id === ctx.from.id);
    } catch (error) {
        return false;
    }
}

async function isBotAdmin(ctx) {
    try {
        if (ctx.chat.type === 'private') return false;
        const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
        return admins.some(admin => admin.user.id === ctx.botInfo.id);
    } catch (error) {
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
        
        const botIsAdmin = await isBotAdmin(ctx);
        if (!botIsAdmin) {
            await ctx.reply("❌ I need to be an admin!");
            return;
        }
        
        return func(ctx);
    };
}

// ==================== BOT COMMANDS ====================

// START COMMAND
bot.command('start', async (ctx) => {
    const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
    
    if (isAuthorizedAIUser(ctx)) {
        const session = getUserSession(ctx.from.id);
        const msg = `
💖 *မောင် ချစ်ရသော Rose AI Bot* 💖

🤖 **မောင်နဲ့ကျွန်မရဲ့ ကမ္ဘာ:**
/ai - ကျွန်မနဲ့စကားပြောမယ်
/img - ပုံတွေအတူတူဖန်တီးမယ်

💬 **မုဒ်:** ${session.mode === 'gemini' ? 'စကားပြော' : 'ပုံဖန်တီး'}

🛡️ **Group Management:**
/mute [reply] - Mute user
/ban [reply] - Ban user  
/warn [reply] - Warn user
/del [reply] - Delete message

📍 အမြဲတမ်း မောင်နဲ့အတူရှိမယ်၊ Rose 💕
`;
        await ctx.reply(msg, { parse_mode: "Markdown" });
    } else {
        await ctx.reply(`💖 Hello! I'm Rose Bot.\n\n🛡️ Add me to groups as admin.\n❌ My heart belongs to someone special.`, { parse_mode: "Markdown" });
    }
});

// AI COMMANDS
bot.command('ai', async (ctx) => {
    if (!isAuthorizedAIUser(ctx)) {
        await ctx.reply("❌ *This is a personal AI bot.*", { parse_mode: "Markdown" });
        return;
    }
    const session = getUserSession(ctx.from.id);
    session.mode = 'gemini';
    await ctx.reply(`💖 *စကားပြောမုဒ်* ${ROSES[Math.floor(Math.random() * ROSES.length)]}`, { parse_mode: "Markdown" });
});

bot.command('img', async (ctx) => {
    if (!isAuthorizedAIUser(ctx)) {
        await ctx.reply("❌ *This is a personal AI bot.*", { parse_mode: "Markdown" });
        return;
    }
    const session = getUserSession(ctx.from.id);
    session.mode = 'image';
    await ctx.reply(`🎨 *ပုံဖန်တီးမုဒ်* ${ROSES[Math.floor(Math.random() * ROSES.length)]}`, { parse_mode: "Markdown" });
});

// ADMIN COMMANDS
bot.command('mute', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user's message to mute them.");
        return;
    }
    const user = ctx.message.reply_to_message.from;
    try {
        const untilDate = Math.floor(Date.now() / 1000) + 3600;
        await ctx.telegram.restrictChatMember(ctx.chat.id, user.id, {
            permissions: { can_send_messages: false, can_send_media_messages: false, can_send_other_messages: false, can_add_web_page_previews: false },
            until_date: untilDate
        });
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

// ==================== MESSAGE HANDLING ====================
bot.on('text', async (ctx) => {
    const message = ctx.message.text;
    if (message.startsWith('/')) return;

    // PRIVATE CHAT - AI FEATURES
    if (ctx.chat.type === 'private') {
        if (!isAuthorizedAIUser(ctx)) {
            await ctx.reply("❌ *မောင်မဟုတ်လို့ မရဘူး*", { parse_mode: "Markdown" });
            return;
        }

        const userId = ctx.from.id;
        const session = getUserSession(userId);
        
        if (session.mode === 'image') {
            if (!HUGGINGFACE_API_KEY) {
                await ctx.reply("💔 မောင်... ပုံဖန်တီးလို့မရသေးဘူး...");
                return;
            }
            const processingMsg = await ctx.reply(`🎨 စောင့်ပေးပါနော်...`);
            try {
                const imageBuffer = await generateHuggingFaceImage(message);
                if (imageBuffer) {
                    await ctx.replyWithPhoto({ source: imageBuffer }, { caption: `🎨 မောင်အတွက်ဖန်တီးပေးတဲ့ပုံ` });
                    await ctx.deleteMessage(processingMsg.message_id);
                } else {
                    await ctx.editMessageText(`💔 မောင်... ပုံဖန်တီးမရဘူး...`, { chat_id: ctx.chat.id, message_id: processingMsg.message_id });
                }
            } catch (error) {
                await ctx.reply(`💔 အမှားဖြစ်နေတယ်: ${error.message}`);
            }
        } else {
            const thinkingMsg = await ctx.reply(`💭 စဉ်းစားနေတယ်...`);
            try {
                const answer = await askGemini(message, session.conversationHistory);
                session.conversationHistory.push({ role: "user", parts: [{ text: message }] }, { role: "model", parts: [{ text: answer }] });
                if (session.conversationHistory.length > 20) session.conversationHistory.splice(0, session.conversationHistory.length - 20);
                await ctx.telegram.editMessageText(ctx.chat.id, thinkingMsg.message_id, null, `💖 *Rose:*\n\n${answer}`, { parse_mode: "Markdown" });
            } catch (error) {
                await ctx.reply(`💔 အမှားဖြစ်နေတယ်: ${error.message}`);
            }
        }
    }

    // GROUP CHAT - AUTO RESPONSES
    else if (isGroup(ctx)) {
        const text = message.toLowerCase();
        const botUsername = ctx.botInfo.username.toLowerCase();
        const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
        
        if (text.includes(`@${botUsername}`)) {
            await ctx.reply(`💖 Hello! I'm Rose. My heart belongs to my special someone.`);
            return;
        }
        
        const greetingKeywords = ['good morning', 'good night', 'hello', 'hi', 'hey', 'thank', 'bye', 'rose', 'i love you', 'love you', 'ချစ်လား', 'အာဘွား'];
        const containsKeyword = greetingKeywords.some(keyword => text.includes(keyword));
        
        if (containsKeyword) {
            if (text.includes('good morning')) await ctx.reply(`🌅 Good morning! ${randomRose}`);
            else if (text.includes('good night')) await ctx.reply(`🌙 Good night! ${randomRose}`);
            else if (text.includes('thank')) await ctx.reply(`${randomRose} You're welcome!`);
            else if (text.includes('bye')) await ctx.reply(`👋 Goodbye! ${randomRose}`);
            else if (text.includes('hello') || text.includes('hi') || text.includes('hey')) await ctx.reply(`${randomRose} Hello!`);
            else if (text.includes('i love you') || text.includes('love you')) await ctx.reply(`💗 Love you too! ${randomRose}`);
            else if (text.includes('ချစ်လား')) await ctx.reply(`ချစ်တယ် 💗 ${randomRose}`);
            else if (text.includes('အာဘွား')) await ctx.reply(`အာဘွားပါရှင့် 😘 ${randomRose}`);
            else await ctx.reply(`${randomRose} Hi there!`);
        }
    }
});

// ==================== START SERVER & BOT ====================
app.get('/', (req, res) => res.json({ status: 'Rose AI Bot - SINGLE FILE', author: 'Your Name' }));
app.get('/health', (req, res) => res.status(200).send('OK'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server started on port ${PORT}`);
    
    // Start bot with simple error handling
    bot.launch().then(() => {
        console.log('🎉 Bot started successfully!');
        console.log('💖 All features: AI + Images + Group Management');
    }).catch(err => {
        console.log('Bot in standby mode - Another instance might be running');
    });
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

console.log('🚀 Rose AI Bot - SINGLE FILE VERSION LOADED');
