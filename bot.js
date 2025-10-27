const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Environment variables - DEBUG VERSION
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const AUTHORIZED_USER_ID = process.env.AUTHORIZED_USER_ID;
const PORT = process.env.PORT || 8000;

// DEBUG: Print all environment variables (values hidden for security)
console.log('🔧 DEBUG - Environment Variables:');
console.log('BOT_TOKEN:', BOT_TOKEN ? '✅ SET' : '❌ MISSING');
console.log('AUTHORIZED_USER_ID:', AUTHORIZED_USER_ID ? '✅ SET' : '❌ MISSING');
console.log('GEMINI_API_KEY:', GEMINI_API_KEY ? '✅ SET' : '❌ MISSING');
console.log('HUGGINGFACE_API_KEY:', HUGGINGFACE_API_KEY ? '✅ SET' : '❌ MISSING');
console.log('PORT:', PORT);

// Check only the absolutely required variables
if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is required');
    process.exit(1);
}

if (!AUTHORIZED_USER_ID) {
    console.error('❌ AUTHORIZED_USER_ID is required');
    process.exit(1);
}

console.log('🚀 All required variables are set! Starting bot...');

const bot = new Telegraf(BOT_TOKEN);
const ROSES = ["🌹", "💐", "🌸", "💮", "🏵️", "🌺", "🌷", "🥀"];

// ... rest of the code remains the same as previous working version ...
// (အောက်က code တွေကို မပြင်ပါနဲ့)
