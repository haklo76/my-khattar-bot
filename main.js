const { bot, app, PORT, AUTHORIZED_USER_ID } = require('./config');

console.log('=== 🚀 ROSE AI BOT - INSTANT START ===');
console.log('AUTHORIZED_USER_ID:', AUTHORIZED_USER_ID);
console.log('==============================');

// Load all features
require('./admin-features.js');
require('./ai-features.js');
console.log('✅ ALL features loaded');

// Start command
bot.command('start', async (ctx) => {
    await ctx.reply('💖 Hello! I\'m Rose Bot - ALL FEATURES WORKING! 🎉');
});

// Web server
app.get('/', (req, res) => {
    res.json({ status: 'Bot is running', features: ['AI', 'Images', 'Group Management'] });
});

// INSTANT START - No waiting, no delays
bot.launch()
  .then(() => {
      console.log('🎉 BOT STARTED INSTANTLY!');
      console.log('💖 All features READY: AI + Images + Group Management');
  })
  .catch(err => {
      console.error('❌ Start error:', err.message);
      if (err.response?.error_code === 409) {
          console.log('💡 Another bot instance is running');
      }
  });

app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});
