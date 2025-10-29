const { bot, app, PORT, AUTHORIZED_USER_ID } = require('./config');

console.log('=== 🚀 ROSE AI BOT - CONFLICT FREE ===');
console.log('AUTHORIZED_USER_ID:', AUTHORIZED_USER_ID);
console.log('==============================');

// Load all features
require('./admin-features.js');
require('./ai-features.js');
console.log('✅ ALL features loaded');

// Start command
bot.command('start', async (ctx) => {
    await ctx.reply('💖 Hello! I\'m Rose Bot - WORKING! 🎉');
});

// Web server
app.get('/', (req, res) => {
    res.json({ 
        status: 'Bot is running in web mode', 
        instance: 'primary'
    });
});

// HEALTH CHECK - Important for Koyeb
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

// ==================== CONFLICT SOLUTION ====================
let botStarted = false;

async function startBotSafely() {
    if (botStarted) return;
    
    try {
        console.log('🔄 Starting bot in WEB mode...');
        
        // Use webhook instead of polling to avoid conflicts
        const webhookUrl = `https://your-app-name.koyeb.app/webhook`;
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        await bot.telegram.setWebhook(webhookUrl);
        
        // Set up webhook endpoint
        app.use(bot.webhookCallback('/webhook'));
        
        botStarted = true;
        console.log('🎉 Bot started in WEBHOOK mode! NO CONFLICT!');
        console.log('💖 All features READY!');
        
    } catch (error) {
        console.log('❌ Webhook failed, using fallback...');
        
        // Fallback: Just keep the server running for health checks
        botStarted = true;
        console.log('💡 Server running (bot in standby)');
    }
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server running on port ${PORT}`);
    startBotSafely();
});

// Keep process alive
process.on('SIGINT', () => console.log('🛑 SIGINT'));
process.on('SIGTERM', () => console.log('🛑 SIGTERM'));
