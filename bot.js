const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Environment variables - Koyeb will provide these
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const AUTHORIZED_USER_ID = process.env.AUTHORIZED_USER_ID;
const PORT = process.env.PORT || 8000;

// Validate only the absolutely required variables
if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is required');
    console.log('💡 Get it from: @BotFather on Telegram');
    process.exit(1);
}

if (!AUTHORIZED_USER_ID) {
    console.error('❌ AUTHORIZED_USER_ID is required');
    console.log('💡 Get your ID from: @userinfobot on Telegram');
    process.exit(1);
}

// Optional APIs - just warn but don't exit
if (!GEMINI_API_KEY) {
    console.log('⚠️  GEMINI_API_KEY not set - AI features disabled');
}

if (!HUGGINGFACE_API_KEY) {
    console.log('⚠️  HUGGINGFACE_API_KEY not set - Image generation disabled');
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
    
    if (!GEMINI_API_KEY) {
        await ctx.reply("❌ Gemini API Key မရှိသေးပါ။");
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

    if (!HUGGINGFACE_API_KEY) {
        await ctx.reply("❌ Hugging Face API Key မရှိသေးပါ။");
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

// Admin Commands (same as before)
bot.command('mute', async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user to mute them.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    try {
        await ctx.restrictChatMember(user.id, {
            can_send_messages: false,
            until_date: Math.floor(Date.now() / 1000) + 3600
        });
        await ctx.reply(`🔇 Muted ${user.first_name} for 1 hour ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
    } catch (error) {
        await ctx.reply(`❌ Mute failed: ${error.message}`);
    }
});

bot.command('ban', async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user to ban them.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    try {
        await ctx.banChatMember(user.id);
        await ctx.reply(`🔨 Banned ${user.first_name} ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
    } catch (error) {
        await ctx.reply(`❌ Ban failed: ${error.message}`);
    }
});

bot.command('del', async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a message to delete it.");
        return;
    }
    
    try {
        await ctx.deleteMessage(ctx.message.reply_to_message.message_id);
        await ctx.reply(`🗑️ Deleted ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
    } catch (error) {
        await ctx.reply(`❌ Delete failed: ${error.message}`);
    }
});

bot.command('warn', async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user to warn them.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    await ctx.reply(`⚠️ ${user.first_name}, please follow group rules! ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
});

// Auto Replies
bot.on('text', async (ctx) => {
    if (!ctx.message.text.startsWith('/')) {
        const text = ctx.message.text.toLowerCase();
        const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
        
        if (text.includes('hello') || text.includes('hi')) {
            await ctx.reply(`${randomRose} Hello!`);
        } else if (text.includes('thank')) {
            await ctx.reply(`${randomRose} You're welcome!`);
        } else if (text.includes('good morning')) {
            await ctx.reply(`🌅 Good morning! ${randomRose}`);
        } else if (text.includes('good night')) {
            await ctx.reply(`🌙 Good night! ${randomRose}`);
        }
    }
});

// Web Server
app.get('/', (req, res) => {
    res.json({
        status: '🌹 Rose AI Bot - Active',
        features: ['Gemini AI', 'Hugging Face Image Generation'],
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Error Handling
bot.catch((err, ctx) => {
    console.error(`Bot error:`, err);
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Rose AI Bot starting...`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`👤 Authorized User: ${AUTHORIZED_USER_ID}`);
    console.log(`🤖 Gemini AI: ${GEMINI_API_KEY ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`🎨 Hugging Face: ${HUGGINGFACE_API_KEY ? '✅ Enabled' : '❌ Disabled'}`);
    
    bot.launch().then(() => {
        console.log('✅ Bot is now running!');
    }).catch(error => {
        console.error('❌ Bot failed to start:', error);
        process.exit(1);
    });
});
