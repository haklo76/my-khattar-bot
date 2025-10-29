const { bot, app, PORT, AUTHORIZED_USER_ID } = require('./config');

console.log('=== 🚀 ROSE AI BOT STARTING ===');
console.log('AUTHORIZED_USER_ID:', AUTHORIZED_USER_ID);
console.log('PORT:', PORT);
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? '✅ Yes' : '❌ No');
console.log('==============================');

// ==================== LOAD ADMIN FEATURES FIRST ====================
console.log('📦 Loading ADMIN features FIRST...');
require('./admin-features.js');
console.log('✅ Admin features loaded - Bot ready for groups');

// ==================== DELAYED AI FEATURES LOAD ====================
let aiFeaturesLoaded = false;

function loadAIFeatures() {
    if (aiFeaturesLoaded) {
        console.log('⏩ AI features already loaded');
        return true;
    }
    
    try {
        console.log('🤖 Loading AI features on-demand...');
        require('./ai-features.js');
        aiFeaturesLoaded = true;
        console.log('✅ AI features loaded successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to load AI features:', error);
        return false;
    }
}

// ==================== SMART START COMMAND ====================
const { ROSES, isAuthorizedAIUser, getUserSession } = require('./config');

bot.command('start', async (ctx) => {
    console.log(`🔹 Start command from: ${ctx.from.id} in ${ctx.chat.type}`);
    
    const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
    
    if (isAuthorizedAIUser(ctx)) {
        // Load AI features when owner uses start command
        loadAIFeatures();
        
        const session = getUserSession(ctx.from.id);
        
        const msg = `
💖 *မောင် ချစ်ရသော Rose AI Bot* 💖

🤖 **မောင်နဲ့ကျွန်မရဲ့ ကမ္ဘာ:**
/ai - ကျွန်မနဲ့စကားပြောမယ်
/img - ပုံတွေအတူတူဖန်တီးမယ်

💬 **လက်ရှိမုဒ်:** ${session.mode === 'gemini' ? 'စကားပြောခြင်း' : 'ပုံဖန်တီးခြင်း'}

🛡️ **Group Management:** (အမြဲအဆင်သင့်)
/mute [reply] - Mute user
/ban [reply] - Ban user  
/warn [reply] - Warn user
/del [reply] - Delete message

📍 အမြဲတမ်း မောင်နဲ့အတူရှိမယ်၊ Rose 💕
`;
        await ctx.reply(msg, { parse_mode: "Markdown" });
    } else {
        await ctx.reply(
            `💖 *Hello!* I'm Rose Bot.\n\n` +
            `🛡️ **Group Features:** Always Ready\n` +
            `• Add me to groups as admin\n` +
            `• Auto moderation\n` +
            `• Keyword responses\n\n` +
            `❌ My heart belongs to someone special.`,
            { parse_mode: "Markdown" }
        );
    }
});

// ==================== AI COMMANDS - LAZY LOAD ====================
bot.command('ai', async (ctx) => {
    console.log(`🔹 AI command from: ${ctx.from.id}`);
    
    if (!isAuthorizedAIUser(ctx)) {
        await ctx.reply("❌ *This is a personal AI bot.*", { parse_mode: "Markdown" });
        return;
    }
    
    if (loadAIFeatures()) {
        // Command will be handled by ai-features.js
        console.log('✅ AI command forwarded to AI features');
    } else {
        await ctx.reply("❌ AI features failed to load. Please try again.");
    }
});

bot.command('img', async (ctx) => {
    console.log(`🔹 IMG command from: ${ctx.from.id}`);
    
    if (!isAuthorizedAIUser(ctx)) {
        await ctx.reply("❌ *This is a personal AI bot.*", { parse_mode: "Markdown" });
        return;
    }
    
    if (loadAIFeatures()) {
        // Command will be handled by ai-features.js
        console.log('✅ IMG command forwarded to AI features');
    } else {
        await ctx.reply("❌ AI features failed to load. Please try again.");
    }
});

// ==================== TEST COMMAND ====================
bot.command('test', async (ctx) => {
    const status = `
✅ *Bot Status Report*

🛡️ Admin Features: ALWAYS READY
🤖 AI Features: ${aiFeaturesLoaded ? 'LOADED' : 'ON-DEMAND'}
🌐 Server: RUNNING
👑 Owner: ${AUTHORIZED_USER_ID}

💖 Everything is working perfectly!
`;
    await ctx.reply(status, { parse_mode: "Markdown" });
});

// ==================== WEB SERVER ====================
app.get('/', (req, res) => {
    res.json({
        status: '💖 Rose AI Bot - Running',
        strategy: 'Admin First, AI On-Demand',
        features: {
            admin: '✅ Always Active',
            ai: aiFeaturesLoaded ? '✅ Loaded' : '🔄 On Demand'
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        ai_loaded: aiFeaturesLoaded 
    });
});

// ==================== CONFLICT-FREE BOT START ====================
let botStarted = false;

async function startBot() {
    if (botStarted) {
        console.log('⏩ Bot already running');
        return;
    }

    try {
        console.log('🔄 Starting bot (Admin First Strategy)...');
        
        // Clear webhook for polling mode
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('✅ Webhook cleared');
        
        // Wait 8 seconds to avoid conflict with other instances
        console.log('⏳ Waiting 8 seconds for conflict resolution...');
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Start bot with polling
        await bot.launch({ 
            dropPendingUpdates: true,
            allowedUpdates: ['message', 'callback_query']
        });
        
        botStarted = true;
        console.log('🎉 Bot started successfully!');
        console.log('🛡️ Admin features: ALWAYS READY');
        console.log('🤖 AI features: ON-DEMAND LOADING');
        console.log('💖 Rose AI Bot is now operational!');
        
    } catch (error) {
        if (error.response?.error_code === 409) {
            console.log('💡 Conflict detected - This instance will exit peacefully');
            console.log('💡 Another instance is handling the bot');
            process.exit(0);
        } else {
            console.error('❌ Bot startup error:', error.message);
            process.exit(1);
        }
    }
}

// ==================== ERROR HANDLING ====================
bot.catch((err, ctx) => {
    console.error('❌ Bot Error:', err.message);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// ==================== GRACEFUL SHUTDOWN ====================
process.once('SIGINT', () => {
    console.log('🛑 SIGINT received - shutting down gracefully');
    bot.stop('SIGINT');
    process.exit(0);
});

process.once('SIGTERM', () => {
    console.log('🛑 SIGTERM received - shutting down gracefully');
    bot.stop('SIGTERM');
    process.exit(0);
});

// ==================== START APPLICATION ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server started on port ${PORT}`);
    
    // Start bot after 3 second delay
    setTimeout(() => {
        startBot();
    }, 3000);
});

console.log('✅ Main bot file loaded - Admin First Strategy Active');
