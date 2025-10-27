const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY; // အသစ်ထပ်ထည့်
const AUTHORIZED_USER_ID = process.env.AUTHORIZED_USER_ID;
const PORT = process.env.PORT || 8000;

// Validate required environment variables
if (!BOT_TOKEN || !AUTHORIZED_USER_ID) {
    console.error('❌ BOT_TOKEN and AUTHORIZED_USER_ID are required');
    process.exit(1);
}

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
        return "❌ Hugging Face API Key မရှိသေးပါ။";
    }

    try {
        // Stable Diffusion model သုံးမယ်
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

        // Image buffer ကို base64 conversion
        const imageBuffer = Buffer.from(response.data);
        return imageBuffer;

    } catch (error) {
        console.error('Hugging Face Error:', error.response?.data || error.message);
        return null;
    }
}

// ==================== COMMANDS ====================
bot.command('start', async (ctx) => {
    const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
    
    if (ctx.chat.type === 'private' && isAuthorizedAIUser(ctx)) {
        const msg = `
${randomRose} *Your Personal Rose AI Bot* ${randomRose}

🤖 **AI Commands:**
/ai [question] - Ask me anything
/image [prompt] - Generate image (Gemini)
/hfimage [prompt] - Generate real image (Hugging Face)

🛡️ **Group Admin:**
/mute, /ban, /warn, /del

📍 Hosted on Koyeb • Free Tier
`;
        await ctx.reply(msg, { parse_mode: "Markdown" });
    } else {
        await ctx.reply(`${randomRose} Hello! I'm a personal AI assistant.`);
    }
});

// AI Chat Command
bot.command('ai', aiAuthorizedRequired(async (ctx) => {
    const question = ctx.message.text.split(' ').slice(1).join(' ');
    if (!question) {
        await ctx.reply("🧠 Usage: /ai [your question]");
        return;
    }
    
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

// Gemini Image Description Command
bot.command('image', aiAuthorizedRequired(async (ctx) => {
    const prompt = ctx.message.text.split(' ').slice(1).join(' ');
    if (!prompt) {
        await ctx.reply("🎨 Usage: /image [description]");
        return;
    }
    
    try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
            contents: [{ parts: [{ text: `ပုံဖန်တီးဖော်ပြပါ: ${prompt}` }] }]
        };

        const response = await axios.post(url, payload, { timeout: 30000 });
        const text = response.data.candidates[0].content.parts[0].text;
        await ctx.reply(`🎨 *Generated Description:*\n${text}`, { parse_mode: "Markdown" });
    } catch (error) {
        await ctx.reply(`❌ Error: ${error.message}`);
    }
}));

// Hugging Face Real Image Generation Command
bot.command('hfimage', aiAuthorizedRequired(async (ctx) => {
    const prompt = ctx.message.text.split(' ').slice(1).join(' ');
    if (!prompt) {
        await ctx.reply("🖼️ Usage: /hfimage [prompt]");
        return;
    }

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
                `❌ Image generation failed. Try again later.`,
                { chat_id: ctx.chat.id, message_id: processingMsg.message_id }
            );
        }
    } catch (error) {
        await ctx.reply(`❌ Image generation error: ${error.message}`);
    }
}));

// ... (Admin commands remain the same)

// Web Server
app.get('/', (req, res) => {
    res.json({
        status: '🌹 Rose AI Bot - Active',
        features: ['Gemini AI', 'Hugging Face Image Generation'],
        timestamp: new Date().toISOString()
    });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Rose AI Bot starting...`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`👤 Authorized User: ${AUTHORIZED_USER_ID}`);
    console.log(`🎨 Hugging Face: ${HUGGINGFACE_API_KEY ? '✅ Enabled' : '❌ Disabled'}`);
    
    bot.launch().then(() => {
        console.log('✅ Bot is now running!');
    }).catch(error => {
        console.error('❌ Bot failed to start:', error);
        process.exit(1);
    });
});
