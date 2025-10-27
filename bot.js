const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ==================== ENVIRONMENT ====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const AUTHORIZED_USER_IDS = process.env.AUTHORIZED_USER_ID ? process.env.AUTHORIZED_USER_ID.split(',') : [];
const PORT = process.env.PORT || 8000;

// ==================== VALIDATION ====================
if (!BOT_TOKEN || AUTHORIZED_USER_IDS.length === 0) {
    console.error('❌ BOT_TOKEN and AUTHORIZED_USER_ID are required');
    process.exit(1);
}

console.log('🌹 Starting Rose AI Bot...');

const bot = new Telegraf(BOT_TOKEN);
const ROSES = ["🌹", "💐", "🌸", "💮", "🏵️", "🌺", "🌷", "🥀"];

// ==================== AUTH ====================
function isAuthorizedAIUser(ctx) {
    return ctx.chat.type === 'private' && AUTHORIZED_USER_IDS.includes(ctx.from.id.toString());
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

// ==================== GEMINI AI ====================
async function askGemini(question) {
    if (!GEMINI_API_KEY) return "❌ Gemini API Key မရှိပါ။";

    try {
        const res = await axios.post(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: `မြန်မာလို ရင်းနှီးစွာ ဖြေပါ: ${question}` }] }]
            },
            { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
        );
        return res.data.candidates?.[0]?.content?.parts?.[0]?.text || "🤖 No response.";
    } catch (e) {
        console.error('Gemini Error:', e.response?.data || e.message);
        return `❌ Error: ${e.response?.data?.error?.message || e.message}`;
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
/ai [question] - Ask anything  
/img [prompt] - Generate image

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

// ==================== AI COMMANDS ====================
bot.command('ai', aiAuthorizedRequired(async (ctx) => {
    const q = ctx.message.text.split(' ').slice(1).join(' ');
    if (!q) return ctx.reply("🧠 Usage: /ai [question]");

    const msg = await ctx.reply(`🧠 Thinking...`);
    const ans = await askGemini(q);
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `🤖 *Answer:*\n\n${ans}`, { parse_mode: "Markdown" });
}));

bot.command('img', aiAuthorizedRequired(async (ctx) => {
    const prompt = ctx.message.text.split(' ').slice(1).join(' ');
    if (!prompt) return ctx.reply("🖼️ Usage: /img [prompt]");

    const msg = await ctx.reply(`🎨 Generating image... This may take 1–2 minutes.`);
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

// ==================== ADMIN COMMANDS ====================
bot.command('mute', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply("❌ Reply to a user to mute them.");

    const input = ctx.message.text.split(' ')[1] || "1h";
    const match = input.match(/^(\d+)([mhd])$/);
    const user = ctx.message.reply_to_message.from;

    const duration = match ? parseInt(match[1]) * { m: 60, h: 3600, d: 86400 }[match[2]] : 3600;
    const until = Math.floor(Date.now() / 1000) + duration;

    await ctx.restrictChatMember(user.id, { can_send_messages: false, until_date: until });
    await ctx.reply(`🔇 Muted ${user.first_name} for ${input}.`);
}));

bot.command('ban', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) return ctx.reply("❌ Reply to a user to ban.");
    const user = ctx.message.reply_to_message.from;
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
        features: ["AI Chat", "Image Generation", "Group Moderation"],
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
