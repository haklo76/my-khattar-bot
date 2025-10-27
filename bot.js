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

// ==================== CHECK AVAILABLE MODELS ====================
async function checkGeminiModels() {
    if (!GEMINI_API_KEY) {
        console.log('❌ No Gemini API Key to check models');
        return;
    }
    
    try {
        const response = await axios.get(
            `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`
        );
        
        console.log('🔍 Available Gemini Models:');
        response.data.models.forEach(model => {
            console.log(`- ${model.name} (${model.supportedGenerationMethods?.join(', ') || 'no methods'})`);
        });
    } catch (error) {
        console.error('❌ Failed to fetch models:', error.message);
    }
}

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

// ==================== ADMIN SYSTEM ====================
async function isAdmin(ctx) {
    try {
        if (ctx.chat.type === 'private') return false;
        
        const member = await ctx.getChatMember(ctx.from.id);
        return member.status === "administrator" || member.status === "creator";
    } catch (error) {
        console.error('Admin check error:', error);
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
        return func(ctx);
    };
}

// ==================== GEMINI AI SYSTEM ====================
async function askGemini(question) {
    if (!GEMINI_API_KEY) return "❌ Gemini API Key မတွေ့ရဘူးဗျ။";
    
    try {
        // Try different model combinations
        const models = [
            'models/gemini-1.5-pro',
            'models/gemini-pro', 
            'models/gemini-1.0-pro',
            'models/text-bison-001'
        ];
        
        let lastError = '';
        
        for (const model of models) {
            try {
                console.log(`Trying model: ${model}`);
                const response = await axios.post(
                    `https://generativelanguage.googleapis.com/v1/${model}:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        contents: [{
                            parts: [{ text: `မြန်မာလိုရင်းနှီးစွာ ဖြေပါ: ${question}` }]
                        }]
                    },
                    {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 30000
                    }
                );

                return response.data.candidates[0].content.parts[0].text;
                
            } catch (error) {
                lastError = error.response?.data?.error?.message || error.message;
                console.log(`❌ ${model} failed: ${lastError}`);
                continue;
            }
        }
        
        return `❌ All models failed. Last error: ${lastError}`;
        
    } catch (error) {
        console.error('Gemini Error:', error.response?.data || error.message);
        return `❌ Error: ${error.response?.data?.error?.message || 'Try again later'}`;
    }
}

// ==================== HUGGING FACE IMAGE GENERATION ====================
async function generateHuggingFaceImage(prompt) {
    if (!HUGGINGFACE_API_KEY) {
        console.log('❌ No Hugging Face API Key');
        return null;
    }

    try {
        console.log('🖼️ Generating image with Hugging Face...');
        const response = await axios.post(
            'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5',
            { inputs: prompt },
            {
                headers: {
                    'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer',
                timeout: 90000
            }
        );

        console.log('✅ Image generated successfully');
        return Buffer.from(response.data);
    } catch (error) {
        console.error('Hugging Face Error:', error.response?.status, error.response?.data || error.message);
        return null;
    }
}

// ==================== COMMANDS ====================
bot.command('start', async (ctx) => {
    const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
    
    if (isAuthorizedAIUser(ctx)) {
        const msg = `
${randomRose} *Your Personal Rose AI & Admin Bot* ${randomRose}

🤖 **AI Commands (Private Only):**
/ai [question] - Ask me anything
/img [prompt] - Generate real image

🛡️ **Group Admin Commands:**
/mute - Mute user (reply to user)
/ban - Ban user (reply to user)  
/warn - Warn user (reply to user)
/del - Delete message (reply to message)

📍 Hosted on Koyeb • Free Tier
`;
        await ctx.reply(msg, { parse_mode: "Markdown" });
    } else {
        await ctx.reply(
            `${randomRose} *Hello!* I'm Rose Bot.\n\n` +
            `🛡️ Add me to groups as admin for moderation.\n` +
            `❌ AI features are private to the owner.`,
            { parse_mode: "Markdown" }
        );
    }
});

// ==================== AI COMMANDS ====================
bot.command('ai', aiAuthorizedRequired(async (ctx) => {
    const question = ctx.message.text.split(' ').slice(1).join(' ');
    if (!question) return await ctx.reply("🧠 Usage: /ai [your question]");
    
    const thinkingMsg = await ctx.reply(`🧠 Thinking... ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
    
    try {
        const answer = await askGemini(question);
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            thinkingMsg.message_id,
            null,
            `🤖 *Answer:*\n\n${answer}`,
            { parse_mode: "Markdown" }
        );
    } catch (error) {
        await ctx.reply(`❌ Error: ${error.message}`);
    }
}));

bot.command('img', aiAuthorizedRequired(async (ctx) => {
    const prompt = ctx.message.text.split(' ').slice(1).join(' ');
    if (!prompt) return await ctx.reply("🖼️ Usage: /img [prompt]");

    if (!HUGGINGFACE_API_KEY) {
        await ctx.reply("❌ Image generation is currently unavailable.");
        return;
    }

    const processingMsg = await ctx.reply(`🖼️ Generating image... ${ROSES[Math.floor(Math.random() * ROSES.length)]}\nThis may take 30-60 seconds.`);
    
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
                `❌ Image generation failed. The model might be loading. Try again in 1 minute.`,
                { chat_id: ctx.chat.id, message_id: processingMsg.message_id }
            );
        }
    } catch (error) {
        await ctx.reply(`❌ Image generation error: ${error.message}`);
    }
}));

// ... Admin commands remain the same ...

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🌹 Bot starting on port ${PORT}`);
    console.log(`👤 Authorized User: ${AUTHORIZED_USER_ID}`);
    console.log(`🤖 Gemini API Key: ${GEMINI_API_KEY ? '✅' : '❌'}`);
    console.log(`🎨 Hugging Face API Key: ${HUGGINGFACE_API_KEY ? '✅' : '❌'}`);
    
    // Check available models
    await checkGeminiModels();
    
    bot.launch().then(() => {
        console.log('✅ Bot is now running!');
    }).catch(error => {
        console.error('❌ Bot failed to start:', error);
        process.exit(1);
    });
});

// Keep the bot running
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
