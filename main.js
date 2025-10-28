const { bot, app, PORT, AUTHORIZED_USER_ID, GEMINI_API_KEY, HUGGINGFACE_API_KEY } = require('./config');

console.log('=== 🚀 ROSE AI BOT STARTING ===');
console.log('🔍 Environment Check:');
console.log('AUTHORIZED_USER_ID:', AUTHORIZED_USER_ID);
console.log('GEMINI_API_KEY:', GEMINI_API_KEY ? '✅ Loaded' : '❌ Missing');
console.log('HUGGINGFACE_API_KEY:', HUGGINGFACE_API_KEY ? '✅ Loaded' : '❌ Missing');
console.log('PORT:', PORT);
console.log('BOT_TOKEN exists:', !!process.env.BOT_TOKEN ? '✅ Yes' : '❌ No');
console.log('==============================');

// ==================== SIMPLE START COMMAND ====================
bot.command('start', async (ctx) => {
    console.log(`✅ Start command received from: ${ctx.from.id}`);
    
    const welcomeMsg = `
💖 *Hello! I'm Rose AI Bot* 🌹

🤖 **My Features:**
/ai - Chat with AI
/img - Generate images
/mute - Mute users (admin)
/ban - Ban users (admin)

🔧 **Status:** ✅ Online and Working
👑 **Owner:** ${AUTHORIZED_USER_ID}

*Bot is responding correctly!* 🎉
    `;
    
    await ctx.reply(welcomeMsg, { parse_mode: "Markdown" });
    console.log('✅ Start message sent successfully');
});

// ==================== TEST COMMAND ====================
bot.command('test', async (ctx) => {
    console.log(`✅ Test command from: ${ctx.from.id}`);
    await ctx.reply('✅ Bot is working! Test successful! 🎉');
});

bot.on('text', async (ctx) => {
    console.log(`📝 Message received: "${ctx.message.text}" from ${ctx.from.id}`);
    
    // Simple echo for testing
    if (ctx.message.text.toLowerCase().includes('hello')) {
        await ctx.reply('Hello there! 👋');
    }
});

// ==================== ERROR HANDLING ====================
bot.catch((err, ctx) => {
    console.error('❌ Bot Error:', err);
    console.error('❌ Update that caused error:', ctx.update);
});

// ==================== START BOT ====================
async function startBot() {
    try {
        console.log('🔄 Starting bot...');
        
        // Test bot info
        const botInfo = await bot.telegram.getMe();
        console.log('✅ Bot Info:', botInfo);
        
        // Delete webhook for polling
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('✅ Webhook deleted');
        
        // Start bot
        await bot.launch();
        console.log('🎉 Bot started successfully!');
        console.log('🤖 Bot username:', botInfo.username);
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error.message);
        console.error('❌ Full error:', error);
        process.exit(1);
    }
}

// Start web server
app.get('/', (req, res) => {
    res.json({ 
        status: 'Bot is running',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server started on port ${PORT}`);
    startBot();
});