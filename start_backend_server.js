#!/usr/bin/env node
/**
 * Standalone script to start the backend API server with visible console logs
 */

const { getModuleLogger } = require('./logger/logger');

// Override console methods to ensure logs are visible
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

console.log = (...args) => {
  originalConsoleLog('[CONSOLE]', ...args);
};

console.error = (...args) => {
  originalConsoleError('[ERROR]', ...args);
};

console.warn = (...args) => {
  originalConsoleWarn('[WARN]', ...args);
};

console.info = (...args) => {
  originalConsoleInfo('[INFO]', ...args);
};

// Start the API server
require('./server/api/index.js');

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down backend server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down backend server...');
  process.exit(0);
});

















