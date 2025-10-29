const { bot, app, PORT, AUTHORIZED_USER_ID } = require('./config');

console.log('=== 🚀 ROSE AI BOT - POLLING MODE ===');
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
    res.json({ status: 'Bot is running in POLLING mode' });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ==================== POLLING MODE WITH CONFLICT HANDLING ====================
async function startBotWithPolling() {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        attempts++;
        console.log(`🔄 Start attempt ${attempts}/${maxAttempts}...`);
        
        try {
            // Clear any existing webhook
            await bot.telegram.deleteWebhook({ drop_pending_updates: true });
            console.log('✅ Webhook cleared');
            
            // Wait before starting (avoid conflict)
            const waitTime = attempts * 10000; // 10, 20, 30 seconds
            console.log(`⏳ Waiting ${waitTime/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Start bot with polling
            await bot.launch({
                dropPendingUpdates: true,
                allowedUpdates: ['message', 'callback_query']
            });
            
            console.log('🎉 Bot STARTED in POLLING mode!');
            console.log('💖 ALL FEATURES READY: AI + Group Management');
            return; // Success - exit function
            
        } catch (error) {
            if (error.response?.error_code === 409) {
                console.log('💡 Conflict detected, will retry...');
                if (attempts === maxAttempts) {
                    console.log('🛑 Max attempts reached. Bot will stay alive for health checks.');
                    break;
                }
            } else {
                console.error('❌ Unexpected error:', error.message);
                break;
            }
        }
    }
}

// Start server and bot
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server running on port ${PORT}`);
    startBotWithPolling();
});

// Keep process alive for Koyeb
process.on('SIGINT', () => {
    console.log('🛑 SIGINT - Keeping alive for Koyeb');
});

process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM - Keeping alive for Koyeb');
});

console.log('✅ Bot configured for POLLING mode');
