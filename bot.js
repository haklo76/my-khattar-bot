const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Environment variables - Koyeb will provide these
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AUTHORIZED_USER_ID = process.env.AUTHORIZED_USER_ID;
const PORT = process.env.PORT || 8000;

// Validate required environment variables
if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is required');
    console.log('💡 Get it from: @BotFather on Telegram');
    process.exit(1);
}

if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is required');
    console.log('💡 Get it from: https://aistudio.google.com/app/apikey');
    process.exit(1);
}

if (!AUTHORIZED_USER_ID) {
    console.error('❌ AUTHORIZED_USER_ID is required');
    console.log('💡 Get your ID from: @userinfobot on Telegram');
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
            await ctx.reply(
                "❌ *This is a personal AI bot.*\nOnly the owner can use AI features.",
                { parse_mode: "Markdown" }
            );
            return;
        }
        return func(ctx);
    };
}

// ==================== GEMINI AI SYSTEM ====================

async function askGemini(question) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
            contents: [{
                parts: [{ text: `မြန်မာလိုရင်းနှီးစွာ ဖြေပါ။\n\nQuestion: ${question}` }]
            }]
        };

        const response = await axios.post(url, payload, { timeout: 30000 });
        
        if (response.status === 200) {
            return response.data.candidates[0].content.parts[0].text;
        } else {
            return `❌ Error: API returned status ${response.status}`;
        }
    } catch (error) {
        return `❌ Connection error: ${error.message}`;
    }
}

async function generateImage(prompt) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
            contents: [{ parts: [{ text: `ပုံဖန်တီးဖော်ပြပါ: ${prompt}` }] }]
        };

        const response = await axios.post(url, payload, { timeout: 30000 });
        
        if (response.status === 200) {
            const text = response.data.candidates[0].content.parts[0].text;
            return `🎨 *Generated Description:*\n${text}`;
        }
        return `❌ Error: API returned status ${response.status}`;
    } catch (error) {
        return `❌ Connection error: ${error.message}`;
    }
}

// ==================== ADMIN SYSTEM ====================

async function isAdmin(ctx) {
    try {
        const member = await ctx.getChatMember(ctx.from.id);
        return member.status === "administrator" || member.status === "creator";
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
        
        if (!await isAdmin(ctx)) {
            await ctx.reply("❌ Admins only!");
            return;
        }
        return func(ctx);
    };
}

// ==================== COMMANDS ====================

bot.command('start', async (ctx) => {
    const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
    
    if (ctx.chat.type === 'private') {
        if (isAuthorizedAIUser(ctx)) {
            const msg = `
${randomRose} *Your Personal Rose AI Bot* ${randomRose}

🤖 **AI Commands:**
/ai [question] - Ask me anything
/image [prompt] - Generate image descriptions

🛡️ **Group Admin:**
/mute - Mute users
/ban - Ban users  
/warn - Warn users
/del - Delete messages

📍 Hosted on Koyeb • Free Tier
`;
            await ctx.reply(msg, { parse_mode: "Markdown" });
        } else {
            await ctx.reply(
                `${randomRose} Hello! I'm a personal AI assistant. ` +
                `AI features are private to the owner.`,
                { parse_mode: "Markdown" }
            );
        }
    } else {
        await ctx.reply("🌹 Group Admin Mode - Use /mute /warn /ban /del");
    }
});

// AI Commands
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

bot.command('image', aiAuthorizedRequired(async (ctx) => {
    const prompt = ctx.message.text.split(' ').slice(1).join(' ');
    if (!prompt) {
        await ctx.reply("🎨 Usage: /image [description]");
        return;
    }
    
    const result = await generateImage(prompt);
    await ctx.reply(result, { parse_mode: "Markdown" });
}));

// Admin Commands
bot.command('mute', adminRequired(async (ctx) => {
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
}));

bot.command('ban', adminRequired(async (ctx) => {
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
}));

bot.command('del', adminRequired(async (ctx) => {
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
}));

bot.command('warn', adminRequired(async (ctx) => {
    if (!ctx.message.reply_to_message) {
        await ctx.reply("❌ Reply to a user to warn them.");
        return;
    }
    
    const user = ctx.message.reply_to_message.from;
    await ctx.reply(`⚠️ ${user.first_name}, please follow group rules! ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
}));

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
        platform: 'Koyeb',
        uptime: Math.floor(process.uptime()),
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
    
    bot.launch().then(() => {
        console.log('✅ Bot is now running!');
    }).catch(error => {
        console.error('❌ Bot failed to start:', error);
        process.exit(1);
    });
});
