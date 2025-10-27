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
        // Use the available model from the debug output
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
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

        return Buffer.from(response.data);
    } catch (error) {
        console.error('Hugging Face Error:', error.response?.data || error.message);
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

// ==================== ADMIN COMMANDS ====================
bot.command('mute', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user's message to mute them.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    try {
        const untilDate = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        await ctx.restrictChatMember(user.id, {
            can_send_messages: false,
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
        await ctx.banChatMember(user.id);
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
        await ctx.deleteMessage(ctx.message.reply_to_message.message_id);
        // Don't send confirmation message to avoid spam
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

// ==================== AUTO REPLIES ====================
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

// ==================== WEB SERVER ====================
app.get('/', (req, res) => {
    res.json({
        status: '🌹 Rose AI & Admin Bot - Active',
        features: ['AI Chat', 'Image Generation', 'Group Moderation'],
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌹 Bot starting on port ${PORT}`);
    console.log(`👤 Authorized User: ${AUTHORIZED_USER_ID}`);
    console.log(`🤖 Gemini: ${GEMINI_API_KEY ? '✅ gemini-2.0-flash' : '❌'}`);
    console.log(`🎨 Hugging Face: ${HUGGINGFACE_API_KEY ? '✅' : '❌'}`);
    
    // Use webhook to avoid multiple instances conflict
    bot.launch({ 
        webhook: {
            domain: process.env.KOYEB_APP_URL, // Koyeb provides this
            port: PORT
        }
    }).then(() => {
        console.log('✅ Bot is now running with webhook!');
    }).catch(error => {
        console.error('❌ Bot failed to start:', error);
        // Try polling as fallback
        bot.launch().then(() => {
            console.log('✅ Bot is now running with polling!');
        }).catch(pollingError => {
            console.error('❌ Bot failed with polling too:', pollingError);
            process.exit(1);
        });
    });
});

// Keep the bot running
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
