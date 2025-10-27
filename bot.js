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

// ==================== AUTH SYSTEM ====================
function isAuthorizedAIUser(ctx) {
    return ctx.chat.type === 'private' && ctx.from.id.toString() === AUTHORIZED_USER_ID;
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

// ==================== GEMINI AI SYSTEM ====================
async function askGemini(question) {
    if (!GEMINI_API_KEY) return "❌ Gemini API Key မတွေ့ရဘူးဗျ။";
    
    try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
            contents: [{
                parts: [{ text: `မြန်မာလိုရင်းနှီးစွာ ဖြေပါ။\n\nQuestion: ${question}` }]
            }]
        };

        const response = await axios.post(url, payload, { timeout: 30000 });
        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        return `❌ Error: ${error.message}`;
    }
}

// ==================== HUGGING FACE IMAGE GENERATION ====================
async function generateHuggingFaceImage(prompt) {
    if (!HUGGINGFACE_API_KEY) {
        return null;
    }

    try {
        const response = await axios.post(
            'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5',
            { inputs: prompt },
            {
                headers: {
                    'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer',
                timeout: 60000
            }
        );

        return Buffer.from(response.data);
    } catch (error) {
        console.error('Hugging Face Error:', error.message);
        return null;
    }
}

// ==================== COMMANDS ====================
bot.command('start', async (ctx) => {
    const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
    
    if (isAuthorizedAIUser(ctx)) {
        const msg = `
${randomRose} *Your Personal Rose AI Bot* ${randomRose}

🤖 **AI Commands:**
/ai [question] - Ask me anything
/image [prompt] - Generate image description
/hfimage [prompt] - Generate real image 🆕

🛡️ **Group Admin:**
/mute, /ban, /warn, /del

📍 Hosted on Koyeb • Free Tier
`;
        await ctx.reply(msg, { parse_mode: "Markdown" });
    } else {
        await ctx.reply(`${randomRose} Hello! I'm a personal AI assistant.`);
    }
});

// AI Commands
bot.command('ai', aiAuthorizedRequired(async (ctx) => {
    const question = ctx.message.text.split(' ').slice(1).join(' ');
    if (!question) return await ctx.reply("🧠 Usage: /ai [question]");
    
    const thinkingMsg = await ctx.reply(`🧠 Thinking... ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
    const answer = await askGemini(question);
    
    await ctx.telegram.editMessageText(
        ctx.chat.id,
        thinkingMsg.message_id,
        null,
        `🤖 *Answer:*\n\n${answer}`,
        { parse_mode: "Markdown" }
    );
}));

bot.command('hfimage', aiAuthorizedRequired(async (ctx) => {
    const prompt = ctx.message.text.split(' ').slice(1).join(' ');
    if (!prompt) return await ctx.reply("🖼️ Usage: /hfimage [prompt]");

    const processingMsg = await ctx.reply(`🖼️ Generating image... ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
    
    try {
        const imageBuffer = await generateHuggingFaceImage(prompt);
        
        if (imageBuffer) {
            await ctx.replyWithPhoto(
                { source: imageBuffer },
                { caption: `🎨 Generated: "${prompt}"` }
            );
            await ctx.deleteMessage(processingMsg.message_id);
        } else {
            await ctx.editMessageText(
                `❌ Image generation failed.`,
                { chat_id: ctx.chat.id, message_id: processingMsg.message_id }
            );
        }
    } catch (error) {
        await ctx.reply(`❌ Error: ${error.message}`);
    }
}));

// Admin Commands (simplified)
bot.command('mute', async (ctx) => {
    if (!ctx.message.reply_to_message) return await ctx.reply("❌ Reply to a user to mute.");
    // ... rest of admin commands
});

// Web Server & Start
app.get('/', (req, res) => {
    res.json({ status: '🌹 Bot Active', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌹 Bot starting on port ${PORT}`);
    
    bot.launch().then(() => {
        console.log('✅ Bot is now running!');
    }).catch(error => {
        console.error('❌ Bot failed:', error);
    });
});

// Keep the bot running
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
