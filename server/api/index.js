process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const express = require('express');
const cors = require('cors');
const { getModuleLogger } = require('../../logger/logger');
const constants = require('../../config/constants');

const logger = getModuleLogger('api-server');

// ============================================
// GLOBAL ERROR HANDLERS - Catch ALL errors
// ============================================
process.on('uncaughtException', (error) => {
  console.error('🚨 [GLOBAL] Uncaught Exception:', error);
  console.error('🚨 [GLOBAL] Stack:', error.stack);
  logger.error('💥 [GLOBAL] Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code,
    errno: error.errno,
    syscall: error.syscall,
    timestamp: new Date().toISOString()
  });
  // Don't exit - let the server continue but log everything
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 [GLOBAL] Unhandled Rejection:', reason);
  if (reason instanceof Error) {
    console.error('🚨 [GLOBAL] Stack:', reason.stack);
  }
  logger.error('💥 [GLOBAL] Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString(),
    timestamp: new Date().toISOString()
  });
  // Don't exit - let the server continue but log everything
});

// Catch synchronous errors in async functions
const originalConsoleError = console.error;
console.error = function(...args) {
  originalConsoleError.apply(console, args);
  // Log to file as well
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Cannot read properties')) {
    logger.error('🔍 [CONSOLE ERROR]', {
      message: args.join(' '),
      timestamp: new Date().toISOString()
    });
  }
};

// Import routes
const dealsRoutes = require('./routes/deals');
const stocksRoutes = require('./routes/stocks');
const logsRoutes = require('./routes/logs');
const schedulerRoutes = require('./routes/scheduler');
const notificationsRoutes = require('./routes/notifications');
const analyticsRoutes = require('./routes/analytics');
const executionRoutes = require('./routes/execution');
const newsRoutes = require('./routes/news');
const bannersRoutes = require('./routes/banners');
const dadExpensesRoutes = require('./routes/dadExpenses');
const matchingConfigRoutes = require('./routes/matchingConfig');

const app = express();
const PORT = constants.frontend?.apiPort || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, { 
    query: req.query, 
    body: req.method !== 'GET' ? req.body : undefined 
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
app.use('/api/deals', dealsRoutes);
app.use('/api/stocks', stocksRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/scheduler', schedulerRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/execution', executionRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/banners', bannersRoutes);
app.use('/api/dad-expenses', dadExpensesRoutes);
app.use('/api/matching-config', matchingConfigRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('API Error', { 
    error: err.message, 
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`API Server started on port ${PORT}`, {
      port: PORT,
      environment: constants.env,
      timestamp: new Date().toISOString()
    });
  });
}

module.exports = app;

