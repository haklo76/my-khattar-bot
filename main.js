const { bot, app, PORT, AUTHORIZED_USER_ID } = require('./config');

console.log('=== 🚀 ROSE AI BOT - SIMPLE ===');
console.log('AUTHORIZED_USER_ID:', AUTHORIZED_USER_ID);
console.log('==============================');

// Load all features
require('./admin-features.js');
require('./ai-features.js');
console.log('✅ ALL features loaded');

// Simple start command
bot.command('start', async (ctx) => {
    await ctx.reply('💖 Hello! I\'m Rose Bot - ALL FEATURES WORKING! 🎉');
});

// Web server
app.get('/', (req, res) => {
    res.json({ status: 'Bot is running', features: ['AI', 'Images', 'Group Management'] });
});

// SIMPLE BOT START - No webhook, just polling
async function startSimple() {
    try {
        await bot.telegram.deleteWebhook();
        console.log('⏳ Waiting 15 seconds to avoid conflict...');
        await new Promise(resolve => setTimeout(resolve, 15000));
        
        await bot.launch();
        console.log('🎉 Bot STARTED! All features ready!');
        
    } catch (error) {
        if (error.response?.error_code === 409) {
            console.log('💡 Another instance running. Exiting peacefully.');
            process.exit(0);
        }
        console.error('❌ Error:', error.message);
    }
}

app.listen(PORT, () => {
    console.log(`🌐 Server on port ${PORT}`);
    startSimple();
});
