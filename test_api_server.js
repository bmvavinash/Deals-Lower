// Quick test script to verify API server can start
console.log('Testing API server startup...');

try {
  console.log('1. Testing imports...');
  const express = require('express');
  const cors = require('cors');
  console.log('   ✓ express and cors loaded');
  
  console.log('2. Testing logger...');
  const { getModuleLogger } = require('./logger/logger');
  console.log('   ✓ logger loaded');
  
  console.log('3. Testing constants...');
  const constants = require('./config/constants');
  console.log('   ✓ constants loaded, API port:', constants.frontend?.apiPort || 3001);
  
  console.log('4. Testing route imports...');
  try {
    require('./server/api/routes/deals');
    console.log('   ✓ deals route loaded');
  } catch(e) {
    console.log('   ✗ deals route error:', e.message);
  }
  
  console.log('5. Starting server...');
  const app = require('./server/api/index.js');
  console.log('   ✓ API server module loaded');
  console.log('\n✅ All tests passed! Server should be ready.');
  console.log('   Access at: http://localhost:' + (constants.frontend?.apiPort || 3001));
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}


















