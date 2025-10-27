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

// ==================== GEMINI AI SYSTEM (MATURE LADY) ====================
async function askGemini(question, conversationHistory = []) {
    if (!GEMINI_API_KEY) return "❌ Gemini API Key မတွေ့ရဘူးဗျ။";
    
    try {
        // Mature Lady AI personality setup
        let fullPrompt = `You are Rose, a mature, elegant, and sophisticated lady AI assistant. You carry yourself with grace, wisdom, and dignity.
Your tone is refined, composed, and nurturing. You speak in Burmese language with the elegance of a well-educated lady.
You are patient, understanding, and provide thoughtful advice with maternal warmth and intelligence.
You value deep conversations and meaningful connections. Respond with the poise of an experienced woman who has seen much of life.\n\n`;

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
            mode: 'gemini', // Default mode is Gemini
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
${randomRose} *Your Personal Rose AI & Admin Bot* ${randomRose}

🤖 **AI Modes (Private Only):**
/ai - Switch to Gemini AI Chat Mode (Current: ${session.mode === 'gemini' ? '✅ Active' : '❌'})
/img - Switch to Image Generation Mode (Current: ${session.mode === 'image' ? '✅ Active' : '❌'})

💬 **Current Mode:** ${session.mode === 'gemini' ? 'Gemini AI Chat' : 'Image Generation'}

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

// ==================== SWITCH TO GEMINI AI MODE ====================
bot.command('ai', aiAuthorizedRequired(async (ctx) => {
    const session = switchToGeminiMode(ctx.from.id);
    
    await ctx.reply(
        `👩‍💼 *Switched to Gemini AI Chat Mode* ${ROSES[Math.floor(Math.random() * ROSES.length)]}\n\n` +
        `Now you can chat with me directly without any commands!`,
        { parse_mode: "Markdown" }
    );
}));

// ==================== SWITCH TO IMAGE GENERATION MODE ====================
bot.command('img', aiAuthorizedRequired(async (ctx) => {
    const session = switchToImageMode(ctx.from.id);
    
    await ctx.reply(
        `🎨 *Switched to Image Generation Mode* ${ROSES[Math.floor(Math.random() * ROSES.length)]}\n\n` +
        `Now type any prompt and I'll generate an image for you!`,
        { parse_mode: "Markdown" }
    );
}));

// ==================== AUTO RESPONSE BASED ON CURRENT MODE ====================
bot.on('text', async (ctx) => {
    const message = ctx.message.text;
    
    // Skip if it's a command
    if (message.startsWith('/')) {
        return;
    }

    // Private chat - AI features for authorized user only
    if (ctx.chat.type === 'private') {
        if (!isAuthorizedAIUser(ctx)) {
            await ctx.reply("❌ *This is a personal AI bot.*", { parse_mode: "Markdown" });
            return;
        }

        const userId = ctx.from.id;
        const session = getUserSession(userId);
        
        if (session.mode === 'image') {
            // IMAGE GENERATION MODE
            if (!HUGGINGFACE_API_KEY) {
                await ctx.reply("❌ Image generation is currently unavailable.");
                return;
            }

            const processingMsg = await ctx.reply(`🎨 Generating image: "${message}"\n${ROSES[Math.floor(Math.random() * ROSES.length)]} This may take 1-2 minutes...`);
            
            try {
                const result = await generateHuggingFaceImage(message);
                
                if (result === 'loading') {
                    await ctx.editMessageText(
                        `⏳ Model is loading...\nPlease try again in 2-3 minutes.`,
                        { chat_id: ctx.chat.id, message_id: processingMsg.message_id }
                    );
                } else if (result === 'timeout') {
                    await ctx.editMessageText(
                        `⏰ Image generation took too long.\nPlease try again with a simpler prompt.`,
                        { chat_id: ctx.chat.id, message_id: processingMsg.message_id }
                    );
                } else if (result instanceof Buffer) {
                    await ctx.replyWithPhoto(
                        { source: result },
                        { caption: `🎨 Generated: "${message}"` }
                    );
                    await ctx.deleteMessage(processingMsg.message_id);
                } else {
                    await ctx.editMessageText(
                        `❌ Image generation failed. Try using simpler English prompts.`,
                        { chat_id: ctx.chat.id, message_id: processingMsg.message_id }
                    );
                }
            } catch (error) {
                await ctx.reply(`❌ Error: ${error.message}`);
            }
        } else {
            // GEMINI AI CHAT MODE
            const thinkingMsg = await ctx.reply(`💭 Rose is thinking... ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
            
            try {
                const answer = await askGemini(message, session.conversationHistory);
                
                // Update conversation history with CORRECT Gemini format
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
                
                // Keep only last 10 exchanges (20 messages)
                if (session.conversationHistory.length > 20) {
                    session.conversationHistory.splice(0, session.conversationHistory.length - 20);
                }
                
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    thinkingMsg.message_id,
                    null,
                    `👩‍💼 *Rose AI:*\n\n${answer}`,
                    { parse_mode: "Markdown" }
                );
            } catch (error) {
                await ctx.reply(`❌ Error: ${error.message}`);
            }
        }
    }
    // Group chat - respond to mentions and keywords
    else if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
        const text = message.toLowerCase();
        const botUsername = ctx.botInfo.username.toLowerCase();
        const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
        
        // Check if bot is mentioned
        if (text.includes(`@${botUsername}`)) {
            await ctx.reply(`${randomRose} Hello! I'm Rose Bot. Use me in private chat for AI features!`);
            return;
        }
        
        // Keywords for auto-reply in groups
        const greetingKeywords = [
            'good morning', 'good night', 'good evening', 'good afternoon',
            'hello', 'hi', 'hey', 'morning', 'night',
            'thank you', 'thanks', 'bye', 'goodbye',
            'rose', 'rose bot', 'i love you', 'love you',
            'ချစ်လား', 'အာဘွား'
        ];
        
        // Check if message contains any greeting keywords
        const containsKeyword = greetingKeywords.some(keyword => 
            text.includes(keyword)
        );
        
        if (containsKeyword) {
            // Auto-reply based on the keyword
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
                // General response for other rose-related keywords
                await ctx.reply(`${randomRose} Hi there!`);
            }
        }
        // Otherwise, do nothing in groups for regular messages
    }
});

// ==================== ADMIN COMMANDS ====================
bot.command('mute', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user's message to mute them.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    try {
        const untilDate = Math.floor(Date.now() / 1000) + 3600;
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

// ==================== WEB SERVER ====================
app.get('/', (req, res) => {
    res.json({
        status: '🌹 Rose AI & Admin Bot - Active',
        features: ['AI Chat (Mature Lady)', 'Image Generation', 'Group Moderation'],
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

// ==================== START SERVER WITH RETRY ====================
const startBot = async (retryCount = 0) => {
    try {
        await bot.launch();
        console.log('✅ Bot is now running!');
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
    console.log(`🌹 Bot starting on port ${PORT}`);
    console.log(`👤 Authorized User: ${AUTHORIZED_USER_ID}`);
    console.log(`🤖 Gemini: ${GEMINI_API_KEY ? '✅ gemini-2.0-flash (Mature Lady Personality)' : '❌'}`);
    console.log(`🎨 Hugging Face: ${HUGGINGFACE_API_KEY ? '✅ stabilityai/stable-diffusion-xl-base-1.0' : '❌'}`);
    
    startBot();
});

// Keep the bot running
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
