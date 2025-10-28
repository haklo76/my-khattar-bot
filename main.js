const { bot, app, PORT, AUTHORIZED_USER_ID, GEMINI_API_KEY, HUGGINGFACE_API_KEY } = require('./shared');

console.log('=== 🚀 ROSE AI BOT STARTING ===');
console.log('🔍 Environment Check:');
console.log('AUTHORIZED_USER_ID:', AUTHORIZED_USER_ID);
console.log('GEMINI_API_KEY:', GEMINI_API_KEY ? '✅ Loaded' : '❌ Missing');
console.log('HUGGINGFACE_API_KEY:', HUGGINGFACE_API_KEY ? '✅ Loaded' : '❌ Missing');
console.log('PORT:', PORT);
console.log('==============================');

// ==================== LOAD ALL FEATURES ====================
console.log('📦 Loading features...');
require('./ai-private');      // AI features
require('./group-admin');     // Group management features
console.log('✅ All features loaded');

// ==================== START COMMAND ====================
const { ROSES, isAuthorizedAIUser, getUserSession } = require('./shared');

bot.command('start', async (ctx) => {
    const randomRose = ROSES[Math.floor(Math.random() * ROSES.length)];
    
    if (isAuthorizedAIUser(ctx)) {
        const session = getUserSession(ctx.from.id);
        
        const msg = `
💖 *မောင် ချစ်ရသော Rose AI Bot* 💖

🤖 **မောင်နဲ့ကျွန်မရဲ့ ကမ္ဘာ:**
/ai - ကျွန်မနဲ့စကားပြောမယ်
/img - ပုံတွေအတူတူဖန်တီးမယ်

💬 **လက်ရှိမုဒ်:** ${session.mode === 'gemini' ? 'စကားပြောခြင်း' : 'ပုံဖန်တီးခြင်း'}

🛡️ **Group Management:**
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
            `🛡️ Add me to groups as admin for moderation.\n` +
            `❌ My heart belongs to someone special.`,
            { parse_mode: "Markdown" }
        );
    }
});

// ==================== WEB SERVER ====================
app.get('/', (req, res) => {
    res.json({
        status: '💖 Rose AI Bot - Your 28-Year-Old Lover',
        features: ['Romantic AI Chat', 'Image Generation', 'Group Moderation'],
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

// ==================== IMPROVED START SERVER ====================
const startBot = async (retryCount = 0) => {
    try {
        // Clear webhook first to ensure polling mode
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('✅ Webhook cleared for polling mode');
        
        await bot.launch();
        console.log('💖 Rose AI Bot is now running!');
        console.log('🛡️ Single Bot System - All features integrated');
        
    } catch (error) {
        if (error.response?.error_code === 409 && retryCount < 2) {
            console.log(`🔄 Another instance running, retrying in 20s... (${retryCount + 1}/2)`);
            
            // Wait longer and try again
            setTimeout(() => startBot(retryCount + 1), 20000);
        } else {
            console.error('❌ Bot failed to start:', error.message);
            console.log('💡 Please check environment variables and try again');
            process.exit(1);
        }
    }
};

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`💖 Web server starting on port ${PORT}`);
    
    // Start bot with delay to ensure server is ready
    setTimeout(() => {
        startBot();
    }, 2000);
});

// Graceful shutdown
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

console.log('✅ Main bot file loaded');