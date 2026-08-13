#!/usr/bin/env node
'use strict';

require('dotenv').config();

const DEAL_URL = process.env.DEAL_URL;
const CHAT_ID = process.env.CHAT_ID;
const MESSAGE_ID = process.env.MESSAGE_ID;
const TELEGRAM_BOT_KEY = process.env.TELEGRAM_BOT_KEY;

if (!DEAL_URL) {
  console.error('ERROR: DEAL_URL environment variable is required.');
  process.exit(1);
}

require('./setup-firebase');
const https = require('https');
const { handleProductProcessing } = require('../dataSources/handleProductProcessing');
const { scrapePage, loadConfig } = require('../pageScheduler');
const { getProductDetails } = require('../scheduler');

/**
 * Helper to send a reply back to Telegram
 * @param {string} text Message text to send
 */
async function sendTelegramMessage(text) {
  if (!CHAT_ID || !TELEGRAM_BOT_KEY) return;
  
  const data = JSON.stringify({
    chat_id: CHAT_ID,
    text: text,
    reply_to_message_id: MESSAGE_ID || undefined
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${TELEGRAM_BOT_KEY}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let resData = '';
      res.on('data', (chunk) => resData += chunk);
      res.on('end', () => resolve(resData));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Runner script to process a single hot deal URL triggered by Telegram bot
 */
async function main() {
  console.log(`[${new Date().toISOString()}] Starting hot-deals-runner for URL: ${DEAL_URL}`);
  
  // Set 10-minute timeout
  const timeoutId = setTimeout(() => {
    console.error(`[${new Date().toISOString()}] TIMEOUT: hot-deals-runner exceeded 10 minutes`);
    process.exit(1);
  }, 10 * 60 * 1000);

  try {
    let result;
    // Process the deal URL through getProductDetails or scrapePage depending on URL type
    if (DEAL_URL.includes('amzn.to') || DEAL_URL.includes('fkrt.it') || DEAL_URL.includes('/dp/')) {
      result = await getProductDetails(DEAL_URL);
    } else {
      result = await scrapePage(DEAL_URL);
    }
    
    console.log(`[${new Date().toISOString()}] Processed successfully. Result:`, result ? 'Success' : 'Empty Result');
    
    if (CHAT_ID) {
      await sendTelegramMessage(`Successfully processed deal:\n${DEAL_URL}\nResult: Success`);
    }
    
    clearTimeout(timeoutId);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR in hot-deals-runner:`, error);
    
    if (CHAT_ID) {
      await sendTelegramMessage(`Failed to process deal:\n${DEAL_URL}\nError: ${error.message}`);
    }
    
    clearTimeout(timeoutId);
    process.exit(1);
  }
}

// Handle termination signals for graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, exiting gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, exiting gracefully...');
  process.exit(0);
});

main();
