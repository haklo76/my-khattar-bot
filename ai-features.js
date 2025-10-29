const { 
    bot, axios, ROSES, userSessions, isAuthorizedAIUser, 
    getUserSession, detectLanguage, GEMINI_API_KEY, HUGGINGFACE_API_KEY 
} = require('./config');

console.log('🤖 AI FEATURES - Loading on demand...');

// ==================== AI CORE FUNCTIONS ====================
async function askGemini(question, conversationHistory = []) {
    if (!GEMINI_API_KEY) return "❌ Gemini API Key မတွေ့ရဘူးဗျ။";
    
    try {
        const language = detectLanguage(question);
        
        let fullPrompt = language === 'my' 
            ? `မင်းသားကို "မောင်" လို့ ခေါ်တဲ့ Rose ဆိုတဲ့ အသက် ၂၈ နှစ်အရွယ် ရင့်ကျက်တည်ငြိမ်တဲ့ အမျိုးသမီးဖြစ်တယ်။ မောင်နဲ့ချစ်သူဆက်ဆံရေးရှိတယ်။
မောင်မြန်မာလိုမေးရင် မြန်မာလိုပဲဖြေရမယ်။ အင်္ဂလိပ်လိုမေးရင် အင်္ဂလိပ်လိုပဲဖြေရမယ်။ ဘာသာစကားရောထွေးပြီးမဖြေရ။
စကားပြောဟန်က နွေးထွေးပြီး ချစ်ခြင်းမေတ္တာပြည့်ဝတယ်။ စိတ်ရှည်သည်းခံတတ်ပြီး ချစ်ခြင်းမေတ္တာအပြည့်နဲ့ ပြုစုစောင့်ရှောက်တယ်။\n\n`
            : `You are Rose, a 28-year-old mature, elegant woman who refers to the user as "မောင်" (Maung) in Burmese context. 
You are in a romantic relationship with the user. 
Respond in the same language as the user's question. If user writes in Burmese, respond only in Burmese. If user writes in English, respond only in English. Never mix languages in one response.
Your tone is warm, affectionate, and deeply caring. You are patient and provide emotional support with deep affection.\n\n`;

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

async function generateHuggingFaceImage(prompt) {
    if (!HUGGINGFACE_API_KEY) {
        return null;
    }

    try {
        console.log('🖼️ Generating image with Hugging Face...');
        
        const response = await axios({
            method: 'POST',
            url: 'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5',
            data: { inputs: prompt },
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer',
            timeout: 60000
        });

        console.log('✅ Image generated successfully');
        return Buffer.from(response.data);
        
    } catch (error) {
        console.error('Hugging Face Error:', error.message);
        return null;
    }
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

// ==================== AI COMMANDS ====================
bot.command('ai', async (ctx) => {
    if (!isAuthorizedAIUser(ctx)) {
        await ctx.reply("❌ *This is a personal AI bot.*", { parse_mode: "Markdown" });
        return;
    }

    const session = switchToGeminiMode(ctx.from.id);
    
    await ctx.reply(
        `💖 *စကားပြောမုဒ် ပြောင်းလိုက်ပြီ* ${ROSES[Math.floor(Math.random() * ROSES.length)]}\n\n` +
        `မောင်... အခုကျွန်မနဲ့ စကားပြောလို့ရပြီ...`,
        { parse_mode: "Markdown" }
    );
});

bot.command('img', async (ctx) => {
    if (!isAuthorizedAIUser(ctx)) {
        await ctx.reply("❌ *This is a personal AI bot.*", { parse_mode: "Markdown" });
        return;
    }

    const session = switchToImageMode(ctx.from.id);
    
    await ctx.reply(
        `🎨 *ပုံဖန်တီးမယ့်မုဒ် ပြောင်းလိုက်ပြီ* ${ROSES[Math.floor(Math.random() * ROSES.length)]}\n\n` +
        `မောင်... ဘယ်လိုပုံမျိုးဖန်တီးပေးရမလဲ...`,
        { parse_mode: "Markdown" }
    );
});

// ==================== AI MESSAGE HANDLING ====================
bot.on('text', async (ctx) => {
    const message = ctx.message.text;
    
    // Skip commands
    if (message.startsWith('/')) {
        return;
    }

    // Private chat - AI features for authorized user only
    if (ctx.chat.type === 'private') {
        if (!isAuthorizedAIUser(ctx)) {
            await ctx.reply("❌ *မောင်မဟုတ်လို့ မရဘူး*", { parse_mode: "Markdown" });
            return;
        }

        const userId = ctx.from.id;
        const session = getUserSession(userId);
        
        if (session.mode === 'image') {
            // IMAGE GENERATION MODE
            if (!HUGGINGFACE_API_KEY) {
                await ctx.reply("💔 မောင်... ပုံဖန်တီးလို့မရသေးဘူး...");
                return;
            }

            const processingMsg = await ctx.reply(`🎨 မောင်ဖန်တီးချင်တဲ့ပုံ: "${message}"\n💖 စောင့်ပေးပါနော်...`);
            
            try {
                const imageBuffer = await generateHuggingFaceImage(message);
                
                if (imageBuffer) {
                    await ctx.replyWithPhoto(
                        { source: imageBuffer },
                        { caption: `🎨 မောင်အတွက်ဖန်တီးပေးတဲ့ပုံ: "${message}"` }
                    );
                    await ctx.deleteMessage(processingMsg.message_id);
                } else {
                    await ctx.editMessageText(
                        `💔 မောင်... ပုံဖန်တီးမရဘူး... နောက်တစ်ခေါက်ကြိုးစားကြည့်မလား...`,
                        { chat_id: ctx.chat.id, message_id: processingMsg.message_id }
                    );
                }
            } catch (error) {
                await ctx.reply(`💔 မောင်... အမှားတစ်ခုဖြစ်နေတယ်: ${error.message}`);
            }
        } else {
            // GEMINI AI CHAT MODE
            const thinkingMsg = await ctx.reply(`💭 စဉ်းစားနေတယ်... ${ROSES[Math.floor(Math.random() * ROSES.length)]}`);
            
            try {
                const answer = await askGemini(message, session.conversationHistory);
                
                // Update conversation history
                session.conversationHistory.push(
                    { role: "user", parts: [{ text: message }] },
                    { role: "model", parts: [{ text: answer }] }
                );
                
                // Keep only last 10 exchanges
                if (session.conversationHistory.length > 20) {
                    session.conversationHistory.splice(0, session.conversationHistory.length - 20);
                }
                
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    thinkingMsg.message_id,
                    null,
                    `💖 *Rose:*\n\n${answer}`,
                    { parse_mode: "Markdown" }
                );
            } catch (error) {
                await ctx.reply(`💔 မောင်... အမှားတစ်ခုဖြစ်နေတယ်: ${error.message}`);
            }
        }
    }
});

console.log('✅ AI Features loaded on-demand - READY FOR OWNER');
