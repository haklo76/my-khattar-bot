const { Telegraf, session } = require('telegraf'); // 'session' ကို ထည့်သွင်းပါ
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ==================== ENVIRONMENT ====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// === IMPROVEMENT: ID တွေကို String အစား Number အဖြစ် သေချာပြောင်းပြီး သိမ်းဆည်းပါ ===
const AUTHORIZED_USER_IDS = process.env.AUTHORIZED_USER_ID
    ? process.env.AUTHORIZED_USER_ID.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
    : [];

const PORT = process.env.PORT || 8000;

// ==================== VALIDATION ====================
if (!BOT_TOKEN || AUTHORIZED_USER_IDS.length === 0) {
    console.error('❌ BOT_TOKEN and AUTHORIZED_USER_ID are required');
    process.exit(1);
}

console.log('🌹 Starting Rose AI Bot...');

const bot = new Telegraf(BOT_TOKEN);
const ROSES = ["🌹", "💐", "🌸", "💮", "🏵️", "🌺", "🌷", "🥀"];

// === IMPROVEMENT: Chat History သိမ်းဖို့ Session Middleware ကို သုံးပါ ===
bot.use(session({
    defaultSession: () => ({
        history: [] // Gemini chat history အတွက်
    })
}));

// ==================== AUTH ====================
function isAuthorizedAIUser(ctx) {
    // === IMPROVEMENT: Number type နဲ့ စစ်ဆေးပါ ===
    return ctx.chat.type === 'private' && AUTHORIZED_USER_IDS.includes(ctx.from.id);
}

function aiAuthorizedRequired(func) {
    return async (ctx) => {
        if (!isAuthorizedAIUser(ctx)) {
            await ctx.reply("❌ *This is a private AI bot for owner(s).*", { parse_mode: "Markdown" });
            return;
        }
        return func(ctx);
    };
}

// ==================== ADMIN ====================
async function isAdmin(ctx) {
    try {
        if (ctx.chat.type === 'private') return false;
        const member = await ctx.getChatMember(ctx.from.id);
        return ['administrator', 'creator'].includes(member.status);
    } catch (error) {
        console.error('Admin check error:', error);
        return false;
    }
}

function adminRequired(func) {
    return async (ctx) => {
        if (ctx.chat.type === "private") {
            return ctx.reply("❌ This command only works in groups.");
        }
        const userIsAdmin = await isAdmin(ctx);
        if (!userIsAdmin) {
            return ctx.reply("❌ Admins only!");
        }
        return func(ctx);
    };
}

// ==================== GEMINI AI (FIXED & IMPROVED) ====================
async function askGemini(question, history = []) {
    if (!GEMINI_API_KEY) {
        return { answer: "❌ Gemini API Key မရှိပါ။", history };
    }

    // === FIX: Model name ကို 'gemini-1.5-flash-latest' လို့ ပြောင်းပါ ===
    const MODEL_NAME = 'gemini-1.5-flash-latest';
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
    
    // မေးခွန်းအသစ်ကို history ထဲ ထည့်ပါ
    const newContents = [
        ...history,
        { role: "user", parts: [{ text: question }] }
    ];

    try {
        const res = await axios.post(
            API_URL,
            {
                contents: newContents,
                systemInstruction: {
                    parts: [{ text: "You are a helpful and friendly assistant. Always reply in Burmese (မြန်မာလို ရင်းနှီးစွာ ဖြေပါ)." }]
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                ],
            },
            { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
        );

        const newAnswer = res.data.candidates?.[0]?.content?.parts?.[0]?.text || "🤖 No response.";

        // History ကို update လုပ်ပါ
        const updatedHistory = [
            ...newContents, // User မေးခွန်း
            { role: "model", parts: [{ text: newAnswer }] } // Bot အဖြေ
        ];
        
        // History အရှည်ကြီး မဖြစ်သွားအောင် (ဥပမာ: နောက်ဆုံး စကား 20 ကြောင်း)
        if (updatedHistory.length > 20) {
            updatedHistory.splice(0, updatedHistory.length - 20);
        }

        return { answer: newAnswer, history: updatedHistory };

    } catch (e) {
        console.error('Gemini Error:', e.response?.data || e.message);
        const errorMsg = e.response?.data?.error?.message || e.message;
        // Error ဖြစ်ခဲ့ရင် history အဟောင်းကိုပဲ ပြန်ပေးပါ
        return { answer: `❌ Error: ${errorMsg}`, history: history };
    }
}

// ==================== HUGGING FACE IMAGE ====================
async function generateHuggingFaceImage(prompt) {
    if (!HUGGINGFACE_API_KEY) return null;

    try {
        const res = await axios.post(
            'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1',
            { inputs: prompt, options: { wait_for_model: true, use_cache: true } },
            {
                headers: { Authorization: `Bearer ${HUGGINGFACE_API_KEY}` },
                responseType: 'arraybuffer',
                timeout: 120000
            }
        );
        return Buffer.from(res.data);
    } catch (e) {
        if (e.response?.status === 503) return 'loading';
        console.error('Hugging Face Error:', e.response?.data || e.message);
        return null;
    }
}

// ==================== COMMANDS ====================
bot.start(async (ctx) => {
    const r = ROSES[Math.floor(Math.random() * ROSES.length)];
    const owner = isAuthorizedAIUser(ctx);

    const msg = owner ? `
${r} *Welcome to Your Personal Rose AI Bot* ${r}

🤖 **AI Commands**
/ai [question] - Ask anything (remembers chat)
/img [prompt] - Generate image
/clear - Clear AI chat history

🛡️ **Group Commands**
/mute [time] - Mute user (reply)  
/ban - Ban user (reply)  
/warn - Warn user  
/del - Delete message

📍 Hosted on Koyeb • Safe & Smart
` : `${r} Hello! I'm *Rose AI Bot*.
Add me to your group as admin 🌹`;

    await ctx.reply(msg, { parse_mode: "Markdown" });
});

// ==================== AI COMMANDS (IMPROVED) ====================
bot.command('ai', aiAuthorizedRequired(async (ctx) => {
    const q = ctx.message.text.split(' ').slice(1).join(' ');
    if (!q) return ctx.reply("🧠 Usage: /ai [question]");

    // === IMPROVEMENT: Session ကနေ history ကို ယူသုံးပါ ===
    const history = ctx.session.history || [];
    
    const msg = await ctx.reply(`🧠 Thinking...`);
    await ctx.sendChatAction('typing'); // === IMPROVEMENT: 'typing' action ပြပါ ===

    const { answer, history: newHistory } = await askGemini(q, history);

    // === IMPROVEMENT: History အသစ်ကို session မှာ ပြန်သိမ်းပါ ===
    ctx.session.history = newHistory; 

    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `🤖 *Answer:*\n\n${answer}`, { parse_mode: "Markdown" });
}));

// === IMPROVEMENT: AI history ရှင်းဖို့ command အသစ် ===
bot.command('clear', aiAuthorizedRequired(async (ctx) => {
    ctx.session.history = [];
    await ctx.reply("✨ AI chat history cleared.");
}));

bot.command('img', aiAuthorizedRequired(async (ctx) => {
    const prompt = ctx.message.text.split(' ').slice(1).join(' ');
    if (!prompt) return ctx.reply("🖼️ Usage: /img [prompt]");

    const msg = await ctx.reply(`🎨 Generating image... This may take 1–2 minutes.`);
    await ctx.sendChatAction('upload_photo'); // === IMPROVEMENT: 'upload_photo' action ပြပါ ===
    
    const result = await generateHuggingFaceImage(prompt);

    try {
        if (result === 'loading') {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, "⏳ Model loading... Try again in a few minutes.");
        } else if (result instanceof Buffer) {
            await ctx.replyWithPhoto({ source: result }, { caption: `✨ ${prompt}` });
            await ctx.deleteMessage(msg.message_id).catch(() => {});
        } else {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, "❌ Failed to generate image. Try again.");
        }
    } catch (e) {
        await ctx.reply(`❌ Error: ${e.message}`);
    }
}));

// ==================== ADMIN COMMANDS (IMPROVED) ====================
bot.command('mute', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply("❌ Reply to a user to mute them.");

    const user = ctx.message.reply_to_message.from;

    // === IMPROVEMENT: ကိုယ့်ကိုယ်ကို (သို့) Bot ကိုယ်တိုင်ကို mute မလုပ်မိအောင် စစ်ဆေးပါ ===
    if (user.id === ctx.botInfo.id) return ctx.reply("❌ I cannot mute myself.");
    if (user.id === ctx.from.id) return ctx.reply("❌ You cannot mute yourself.");
    
    const input = ctx.message.text.split(' ')[1] || "1h";
    const match = input.match(/^(\d+)([mhd])$/);

    const duration = match ? parseInt(match[1]) * { m: 60, h: 3600, d: 86400 }[match[2]] : 3600;
    const until = Math.floor(Date.now() / 1000) + duration;

    await ctx.restrictChatMember(user.id, { can_send_messages: false, until_date: until });
    await ctx.reply(`🔇 Muted ${user.first_name} for ${input}.`);
}));

bot.command('ban', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply("❌ Reply to a user to ban.");
    const user = ctx.message.reply_to_message.from;

    // === IMPROVEMENT: ကိုယ့်ကိုယ်ကို (သို့) Bot ကိုယ်တိုင်ကို ban မလုပ်မိအောင် စစ်ဆေးပါ ===
    if (user.id === ctx.botInfo.id) return ctx.reply("❌ I cannot ban myself.");
    if (user.id === ctx.from.id) return ctx.reply("❌ You cannot ban yourself.");

    await ctx.banChatMember(user.id);
    await ctx.reply(`🔨 Banned ${user.first_name}!`);
}));

bot.command('warn', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply("❌ Reply to a user to warn.");
    const user = ctx.message.reply_to_message.from;
    await ctx.reply(`⚠️ ${user.first_name}, please follow the group rules!`);
}));

bot.command('del', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply("❌ Reply to a message to delete.");
    await ctx.deleteMessage(ctx.message.reply_to_message.message_id).catch(() => ctx.reply("⚠️ Can't delete that message."));
}));

// ==================== AUTO REPLY ====================
bot.on('text', async (ctx) => {
    // === IMPROVEMENT: AI owner ဆိုရင် auto-reply မလုပ်ပါ ===
    if (isAuthorizedAIUser(ctx)) return; 
    
    const t = ctx.message.text.toLowerCase();
    if (t.startsWith('/')) return;
    const r = ROSES[Math.floor(Math.random() * ROSES.length)];

    if (t.includes('hello') || t.includes('hi')) return ctx.reply(`${r} Hello!`);
    if (t.includes('thank')) return ctx.reply(`${r} You're welcome!`);
    if (t.includes('good morning')) return ctx.reply(`🌅 Good morning! ${r}`);
    if (t.includes('good night')) return ctx.reply(`🌙 Good night! ${r}`);
});

// ==================== WEB SERVER ====================
app.get('/', (req, res) => {
    res.json({
        status: "✅ Rose AI Bot Active",
        owners: AUTHORIZED_USER_IDS,
        // === IMPROVEMENT: Feature list ကို update လုပ်ပါ ===
        features: ["AI Chat (with Context)", "Image Generation", "Group Moderation"],
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({
        ok: true,
        bot: 'running',
        gemini: !!GEMINI_API_KEY,
        huggingface: !!HUGGINGFACE_API_KEY
    });
});

// ==================== BOT START ====================
bot.catch((err, ctx) => console.error(`Bot error (${ctx.updateType}):`, err.message));

const startBot = async (retry = 0) => {
    try {
        await bot.launch();
        console.log('✅ Bot is running!');
    } catch (e) {
        if (e.response?.error_code === 409 && retry < 5) {
            console.log(`🔄 Retry in 10s (${retry + 1}/5)...`);
            setTimeout(() => startBot(retry + 1), 10000);
        } else {
            console.error('❌ Launch failed:', e.message);
            process.exit(1);
        }
    }
};

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌹 Server running on port ${PORT}`);
    console.log(`👑 Authorized Users: ${AUTHORIZED_USER_IDS.join(', ')}`);
    startBot();
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
