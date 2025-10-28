const { Telegraf } = require('telegraf');
const express = require('express');
const axios = require('axios');

// Environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const AUTHORIZED_USER_ID = process.env.AUTHORIZED_USER_ID;
const PORT = process.env.PORT || 8000;

// Validate
if (!BOT_TOKEN || !AUTHORIZED_USER_ID) {
    console.error('❌ BOT_TOKEN and AUTHORIZED_USER_ID are required');
    process.exit(1);
}

console.log('🚀 Starting Rose AI Bot...');

// Single bot instance
const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());

// Common arrays
const ROSES = ["🌹", "💐", "🌸", "💮", "🏵️", "🌺", "🌷", "🥀"];

// User sessions
const userSessions = new Map();

// Common functions
function isAuthorizedAIUser(ctx) {
    const userId = ctx.from.id.toString();
    const authorizedId = AUTHORIZED_USER_ID.toString();
    return ctx.chat.type === 'private' && userId === authorizedId;
}

function isGroup(ctx) {
    return ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
}

function getUserSession(userId) {
    if (!userSessions.has(userId)) {
        userSessions.set(userId, {
            mode: 'gemini',
            conversationHistory: []
        });
    }
    return userSessions.get(userId);
}

// Language Detection
function detectLanguage(text) {
    const burmeseRegex = /[\u1000-\u109F]/;
    return burmeseRegex.test(text) ? 'my' : 'en';
}

// Export everything
module.exports = {
    bot,
    app,
    axios,
    ROSES,
    userSessions,
    isAuthorizedAIUser,
    isGroup,
    getUserSession,
    detectLanguage,
    BOT_TOKEN,
    GEMINI_API_KEY,
    HUGGINGFACE_API_KEY,
    AUTHORIZED_USER_ID,
    PORT
};
