const { bot, app, PORT, AUTHORIZED_USER_ID, GEMINI_API_KEY, HUGGINGFACE_API_KEY } = require('./config');

console.log('=== 🚀 ROSE AI BOT STARTING ===');
console.log('🔍 Environment Check:');
console.log('AUTHORIZED_USER_ID:', AUTHORIZED_USER_ID);
console.log('GEMINI_API_KEY:', GEMINI_API_KEY ? '✅ Loaded' : '❌ Missing');
console.log('HUGGINGFACE_API_KEY:', HUGGINGFACE_API_KEY ? '✅ Loaded' : '❌ Missing');
console.log('PORT:', PORT);
console.log('BOT_TOKEN exists:', !!process.env.BOT_TOKEN ? '✅ Yes' : '❌ No');
console.log('==============================');

// ==================== LOAD ALL FEATURES ====================
console.log('📦 Loading features...');
try {
    require('./ai-features.js');      // AI features
    require('./admin-features.js');   // Group management features
    console.log('✅ All features loaded');
} catch (error) {
    console.error('❌ Error loading features:', error);
}

// ==================== SIMPLE START COMMAND ====================
const { ROSES, isAuthorizedAIUser, getUserSession } = require('./config');

bot.command('start', async (ctx) => {
    console.log(`✅ Start command received from: ${ctx.from.id} in ${ctx.chat.type}`);
    
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

// ==================== TEST COMMAND ====================
bot.command('test', async (ctx) => {
    console.log(`✅ Test command from: ${ctx.from.id}`);
    await ctx.reply('✅ Bot is working perfectly! 🎉');
});

// ==================== WEB SERVER ====================
app.get('/', (req, res) => {
    res.json({
        status: '💖 Rose AI Bot - Running',
        features: ['AI Chat', 'Image Generation', 'Group Moderation'],
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ==================== CONFLICT-FREE BOT START ====================
let botStarted = false;

async function startBotWithRetry(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Starting bot attempt ${attempt}/${maxRetries}...`);
            
            if (botStarted) {
                console.log('⏩ Bot already started, skipping...');
                return;
            }

            // Delete webhook first (important for conflict resolution)
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            console.log('✅ Webhook cleared');

            // Add small delay before starting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Start bot with polling
            await bot.launch({ 
                dropPendingUpdates: true,
                allowedUpdates: ['message', 'callback_query']
            });
            
            botStarted = true;
            console.log('🎉 Bot started successfully!');
            console.log('💖 Rose AI Bot is now running and ready!');
            break;
            
        } catch (error) {
            console.error(`❌ Attempt ${attempt} failed:`, error.message);
            
            if (error.response?.error_code === 409) {
                console.log('🔄 Conflict detected, waiting before retry...');
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                
                if (attempt === maxRetries) {
                    console.log('💡 Starting in webhook mode instead...');
                    await startWebhookMode();
                    break;
                }
            } else {
                console.error('❌ Unexpected error:', error);
                break;
            }
        }
    }
}

async function startWebhookMode() {
    try {
        console.log('🌐 Starting in webhook mode...');
        
        // For Koyeb, webhook might be better
        const webhookUrl = `https://${process.env.KOYEB_APP_NAME}.koyeb.app`;
        
        await bot.telegram.setWebhook(webhookUrl);
        console.log('✅ Webhook set:', webhookUrl);
        
        botStarted = true;
        console.log('🎉 Bot running in webhook mode!');
        
    } catch (error) {
        console.error('❌ Webhook mode also failed:', error);
    }
}

// ==================== ERROR HANDLING ====================
bot.catch((err, ctx) => {
    console.error('❌ Bot Error for', ctx.updateType, ':', err.message);
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
    
    // Start bot with delay to ensure server is ready
    setTimeout(() => {
        startBotWithRetry();
    }, 3000);
});

console.log('✅ Main bot file loaded successfully');