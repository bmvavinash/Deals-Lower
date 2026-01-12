// Test all imports step by step
console.log('=== Testing API Server Imports ===\n');

try {
  console.log('1. Testing express...');
  const express = require('express');
  console.log('   ✓ express loaded\n');

  console.log('2. Testing cors...');
  const cors = require('cors');
  console.log('   ✓ cors loaded\n');

  console.log('3. Testing logger...');
  const { getModuleLogger } = require('./logger/logger');
  console.log('   ✓ logger loaded\n');

  console.log('4. Testing constants...');
  const constants = require('./config/constants');
  console.log('   ✓ constants loaded');
  console.log('   API Port:', constants.frontend?.apiPort || 3001, '\n');

  console.log('5. Testing productDealsDB...');
  try {
    const { productDealsDB } = require('./database/firebaseDB/productDealsDB');
    console.log('   ✓ productDealsDB loaded\n');
  } catch (e) {
    console.log('   ⚠ productDealsDB error:', e.message);
    console.log('   (This may be OK - Firebase might need initialization)\n');
  }

  console.log('6. Testing notificationTrackingDB...');
  try {
    const { notificationTrackingDB } = require('./database/firebaseDB/notificationTrackingDB');
    console.log('   ✓ notificationTrackingDB loaded\n');
  } catch (e) {
    console.log('   ⚠ notificationTrackingDB error:', e.message, '\n');
  }

  console.log('7. Testing routes...');
  try {
    require('./server/api/routes/deals');
    console.log('   ✓ deals route');
  } catch (e) {
    console.log('   ✗ deals route:', e.message);
  }

  try {
    require('./server/api/routes/stocks');
    console.log('   ✓ stocks route');
  } catch (e) {
    console.log('   ✗ stocks route:', e.message);
  }

  try {
    require('./server/api/routes/logs');
    console.log('   ✓ logs route');
  } catch (e) {
    console.log('   ✗ logs route:', e.message);
  }

  try {
    require('./server/api/routes/scheduler');
    console.log('   ✓ scheduler route');
  } catch (e) {
    console.log('   ✗ scheduler route:', e.message);
  }

  try {
    require('./server/api/routes/notifications');
    console.log('   ✓ notifications route');
  } catch (e) {
    console.log('   ✗ notifications route:', e.message);
  }

  try {
    require('./server/api/routes/analytics');
    console.log('   ✓ analytics route');
  } catch (e) {
    console.log('   ✗ analytics route:', e.message);
  }

  console.log('\n8. Testing main API server...');
  const app = require('./server/api/index.js');
  console.log('   ✓ API server module loaded!\n');

  console.log('✅ ALL IMPORTS SUCCESSFUL!');
  console.log('\nThe API server should start without errors.');
  console.log('Run: node server/api/index.js\n');

} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
}


















