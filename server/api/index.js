process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { getModuleLogger } = require('../../logger/logger');
const constants = require('../../config/constants');
const config = require('../../config/config.js');

const logger = getModuleLogger('api-server');

// Centrally initialize Firebase Admin
if (!admin.apps.length) {
  let serviceAccount;
  let databaseURL;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      const dbname = constants.postingTypesConfig[constants.type].DB;
      let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
      databaseURL = DB_Name === 'lowerdealhub' 
        ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
        : `https://${DB_Name}-default-rtdb.firebaseio.com`;
      logger.info(`Centrally initializing Firebase Admin in cloud mode using environment variables.`);
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON env variable:", e.message);
    }
  } else {
    try {
      const dbname = constants.postingTypesConfig[constants.type].DB;
      let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
      const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
      serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);
      databaseURL = DB_Name === 'lowerdealhub' 
        ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
        : `https://${DB_Name}-default-rtdb.firebaseio.com`;
      logger.info(`Centrally initializing Firebase Admin in local development mode.`);
    } catch (e) {
      logger.warn("Could not find local Firebase credentials file. Central initialization skipped.", e.message);
    }
  }

  if (serviceAccount && databaseURL) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: databaseURL
    });
  }
}

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
const favoritesRoutes = require('./routes/favorites');
const categoryPriorityRoutes = require('./routes/categoryPriority');
const commandsRoutes = require('./routes/commands');
const categoriesRoutes = require('./routes/categories');
const matchingConfigRoutes = require('./routes/matchingConfig');
const affiliatesRoutes = require('./routes/affiliates');

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
app.use('/api/favorites', favoritesRoutes);
app.use('/api/category-priority', categoryPriorityRoutes);
app.use('/api/commands', commandsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/matching-config', matchingConfigRoutes);
app.use('/api/affiliates', affiliatesRoutes);

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
    
    // Auto-start Local Daemon if offline on API startup
    try {
      if (admin.apps.length) {
        const db = admin.database();
        const heartbeatRef = db.ref('daemonHeartbeat');
        heartbeatRef.once('value', (snapshot) => {
          const heartbeat = snapshot.val();
          let isDaemonAlive = false;
          if (heartbeat && heartbeat.timestamp) {
            const lastTime = new Date(heartbeat.timestamp).getTime();
            const diffMs = Date.now() - lastTime;
            isDaemonAlive = diffMs < 60000;
          }
          if (!isDaemonAlive) {
            logger.info('🔄 Local Daemon is offline. Automatically starting localDaemon process...');
            const { exec } = require('child_process');
            const path = require('path');
            const daemonScript = path.join(__dirname, '../../scripts/localDaemon.js');
            const daemonProcess = exec(`node "${daemonScript}"`, {
              cwd: path.join(__dirname, '../../'),
              detached: true,
              stdio: 'ignore'
            });
            daemonProcess.unref();
          } else {
            logger.info('💖 Local Daemon is already active and healthy.');
          }
        });
      }
    } catch (daemonError) {
      logger.error('Failed to auto-start Local Daemon helper', { error: daemonError.message });
    }

    // Initialize the Telegram bot (polling disabled here; hosted separately via Cloud Functions Webhook)
    /*
    try {
      if (constants.notifications?.enableTelegram) {
        logger.info('🤖 Starting Telegram Bot polling helper...');
        require('../../dataSources/bot');
        logger.info('✅ Telegram Bot polling helper active');
      }
    } catch (botError) {
      logger.error('Failed to start Telegram Bot helper', { error: botError.message });
    }
    */
  });
}

module.exports = app;

