// Test API server startup step by step
console.log('=== Testing API Server Startup ===\n');

try {
  console.log('1. Testing basic imports...');
  const express = require('express');
  const cors = require('cors');
  console.log('   ✓ express, cors loaded\n');

  console.log('2. Testing logger...');
  const { getModuleLogger } = require('./logger/logger');
  const logger = getModuleLogger('test');
  console.log('   ✓ logger loaded\n');

  console.log('3. Testing constants...');
  const constants = require('./config/constants');
  console.log('   ✓ constants loaded');
  console.log('   API Port:', constants.frontend?.apiPort || 3001, '\n');

  console.log('4. Testing Firebase DB imports...');
  try {
    const { productDealsDB } = require('./database/firebaseDB/productDealsDB');
    console.log('   ✓ productDealsDB loaded\n');
  } catch (e) {
    console.log('   ⚠ productDealsDB error:', e.message);
    console.log('   (This may be OK if Firebase not initialized yet)\n');
  }

  console.log('5. Testing notification tracking DB...');
  try {
    const { notificationTrackingDB } = require('./database/firebaseDB/notificationTrackingDB');
    console.log('   ✓ notificationTrackingDB loaded\n');
  } catch (e) {
    console.log('   ⚠ notificationTrackingDB error:', e.message, '\n');
  }

  console.log('6. Testing route imports...');
  try {
    require('./server/api/routes/deals');
    console.log('   ✓ deals route loaded');
  } catch (e) {
    console.log('   ✗ deals route error:', e.message);
    console.log('   Stack:', e.stack.split('\n').slice(0, 3).join('\n'));
  }

  try {
    require('./server/api/routes/stocks');
    console.log('   ✓ stocks route loaded');
  } catch (e) {
    console.log('   ✗ stocks route error:', e.message);
  }

  try {
    require('./server/api/routes/logs');
    console.log('   ✓ logs route loaded');
  } catch (e) {
    console.log('   ✗ logs route error:', e.message);
  }

  try {
    require('./server/api/routes/scheduler');
    console.log('   ✓ scheduler route loaded');
  } catch (e) {
    console.log('   ✗ scheduler route error:', e.message);
  }

  try {
    require('./server/api/routes/notifications');
    console.log('   ✓ notifications route loaded');
  } catch (e) {
    console.log('   ✗ notifications route error:', e.message);
  }

  try {
    require('./server/api/routes/analytics');
    console.log('   ✓ analytics route loaded');
  } catch (e) {
    console.log('   ✗ analytics route error:', e.message);
  }

  console.log('\n7. Testing main API server module...');
  const app = require('./server/api/index.js');
  console.log('   ✓ API server module loaded successfully!\n');

  console.log('✅ All imports successful!');
  console.log('The API server should start without errors.\n');
  console.log('To start: node server/api/index.js');

} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}


















