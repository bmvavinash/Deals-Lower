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
const authRoutes = require('./routes/auth');
const cuelinksRoutes = require('./routes/cuelinks');

const app = express();
const PORT = process.env.PORT || constants.frontend?.apiPort || 3003;

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

// Health check endpoint (supports all methods: GET, HEAD, POST, OPTIONS)
app.all(['/health', '/api/health'], (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/server-capabilities', async (req, res) => {
  const os = require('os');
  const fs = require('fs');
  const { execSync } = require('child_process');
  let chromePath = null;
  let puppeteerPath = null;
  let puppeteerLaunchSuccess = false;
  let puppeteerError = null;

  try {
    chromePath = execSync('which google-chrome || which chromium || which chromium-browser || echo "none"').toString().trim();
  } catch (e) {
    chromePath = e.message;
  }

  try {
    const puppeteer = require('puppeteer');
    puppeteerPath = puppeteer.executablePath();
    const exists = fs.existsSync(puppeteerPath);
    if (exists) {
      const browser = await puppeteer.launch({
        headless: 'shell',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process',
          '--no-zygote',
          '--disable-gpu',
          '--js-flags=--max-old-space-size=128'
        ]
      });
      puppeteerLaunchSuccess = true;
      await browser.close();
    } else {
      puppeteerError = `Binary not found at ${puppeteerPath}`;
    }
  } catch (e) {
    puppeteerError = e.message;
  }

  res.json({
    platform: process.platform,
    arch: process.arch,
    totalMem: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
    freeMem: Math.round(os.freemem() / 1024 / 1024) + ' MB',
    chromePath,
    puppeteerPath,
    puppeteerLaunchSuccess,
    puppeteerError
  });
});

// API routes (mounted on both /api/* and /* for dual fail-safe URL resolution)
const mountApiRoute = (path, router) => {
  app.use(`/api${path}`, router);
  app.use(path, router);
};

mountApiRoute('/deals', dealsRoutes);
mountApiRoute('/stocks', stocksRoutes);
mountApiRoute('/logs', logsRoutes);
mountApiRoute('/scheduler', schedulerRoutes);
mountApiRoute('/notifications', notificationsRoutes);
mountApiRoute('/analytics', analyticsRoutes);
mountApiRoute('/execution', executionRoutes);
mountApiRoute('/news', newsRoutes);
mountApiRoute('/banners', bannersRoutes);
mountApiRoute('/dad-expenses', dadExpensesRoutes);
mountApiRoute('/favorites', favoritesRoutes);
mountApiRoute('/category-priority', categoryPriorityRoutes);
mountApiRoute('/commands', commandsRoutes);
mountApiRoute('/categories', categoriesRoutes);
mountApiRoute('/matching-config', matchingConfigRoutes);
mountApiRoute('/affiliates', affiliatesRoutes);
mountApiRoute('/auth', authRoutes);
mountApiRoute('/cuelinks', cuelinksRoutes);

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
    
    // Start Notification Queue Worker
    try {
      const { notificationQueue } = require('../../services/NotificationQueueService');
      notificationQueue.startWorker();
    } catch (error) {
      logger.error('Failed to start Notification Queue Worker', { error: error.message });
    }

    // Autonomous Keep-Alive Self-Ping (Prevents Render free tier from hibernating)
    try {
      const publicUrl = process.env.RENDER_EXTERNAL_URL || 'https://dealsoptimised.onrender.com';
      const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (well below Render's 15-minute inactivity threshold)

      const sendSelfPing = async () => {
        try {
          const pingUrl = `${publicUrl.replace(/\/+$/, '')}/health`;
          const res = await fetch(pingUrl, {
            headers: { 'User-Agent': 'DealsOptimised-SelfPing/1.0' }
          });
          logger.info(`Keep-alive self-ping sent to ${pingUrl}`, { status: res.status });
        } catch (pingErr) {
          logger.warn(`Keep-alive self-ping warning (will retry next interval)`, { error: pingErr.message });
        }
      };

      // Run initial ping after 2 minutes, then every 5 minutes
      setTimeout(sendSelfPing, 2 * 60 * 1000);
      const keepAliveTimer = setInterval(sendSelfPing, PING_INTERVAL_MS);
      if (keepAliveTimer.unref) keepAliveTimer.unref();
      logger.info('Autonomous Keep-Alive Self-Ping scheduled every 5 minutes.');
    } catch (keepAliveErr) {
      logger.error('Failed to initialize keep-alive self-ping', { error: keepAliveErr.message });
    }

    // Auto-start Stocks Master Scheduler (Runs 24/7 Telegram poller & Market hours CMP alerts in cloud & local)
    try {
      const { startMasterScheduler } = require('../../services/stocksMasterScheduler');
      startMasterScheduler();
      logger.info('🚀 Stocks Master Scheduler auto-started on server boot.');
    } catch (schedErr) {
      logger.error('Failed to auto-start Stocks Master Scheduler on boot', { error: schedErr.message });
    }

    // Auto-start Local Daemon if offline on API startup (SKIP ON RENDER)
    try {
      if (admin.apps.length && !process.env.RENDER) {
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
            logger.info('💞 Local Daemon is offline. Automatically starting localDaemon process...');
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

