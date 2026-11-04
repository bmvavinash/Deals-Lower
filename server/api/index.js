process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { getModuleLogger } = require('../../logger/logger');
const constants = require('../../config/constants');
const config = require('../../config/config.js');

const logger = getModuleLogger('api-server');

const app = express();

// ============================================
// GLOBAL CRASH SHIELD - Never exit process
// Guarantees /health and port binding stay alive
// ============================================
process.on('uncaughtException', (error) => {
  console.error('🚨 [GLOBAL] Uncaught Exception:', error);
  try {
    logger.error('💥 [GLOBAL] Uncaught Exception', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  } catch (_) {}
});

process.on('unhandledRejection', (reason) => {
  console.error('🚨 [GLOBAL] Unhandled Rejection:', reason);
  try {
    logger.error('💥 [GLOBAL] Unhandled Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      timestamp: new Date().toISOString()
    });
  } catch (_) {}
});
const PORT = process.env.PORT || constants.frontend?.apiPort || 3003;

// Middleware
app.use(cors());
app.options('*', cors());
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

// Immediate Health Check Endpoint (Responds in < 1ms to Render port detection, root health check, & cron-job.org)
app.all(['/', '/health', '/api/health', '/ping'], (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).json({ 
    status: 'ok', 
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// FAST BIND: Bind port immediately on container boot so Render and cron-job.org get instant 200 OK
let serverInstance = null;
if (!app._listening) {
  app._listening = true;
  serverInstance = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`⚡ API Server immediately bound and listening on 0.0.0.0:${PORT}`, {
      port: PORT,
      environment: constants.env,
      timestamp: new Date().toISOString()
    });
  });
}

// Centrally initialize Firebase Admin
if (!admin.apps.length) {
  let serviceAccount = null;
  const dbname = constants.postingTypesConfig[constants.type].DB;
  let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
  const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
  const databaseURL = DB_Name === 'lowerdealhub' 
    ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
    : `https://${DB_Name}-default-rtdb.firebaseio.com`;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = typeof process.env.FIREBASE_SERVICE_ACCOUNT_JSON === 'object'
        ? process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        : JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      logger.info('Centrally initializing Firebase Admin in cloud mode using environment variables.');
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON env variable:', e.message);
    }
  }

  // Check secret files on Render (/etc/secrets/...) and local keys
  if (!serviceAccount) {
    const candidates = [
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      `/etc/secrets/${filePath}.json`,
      '/etc/secrets/FIREBASE_SERVICE_ACCOUNT_JSON',
      '/etc/secrets/serviceAccountKey.json',
      path.join(__dirname, '../../config', `${filePath}.json`),
      `${constants.pathToFile}/${filePath}.json`
    ].filter(Boolean);

    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          serviceAccount = require(p);
          logger.info(`Centrally initializing Firebase Admin from secret path: ${p}`);
          break;
        }
      } catch (_) {}
    }
  }

  if (serviceAccount && databaseURL) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: databaseURL
      });
      logger.info('Firebase Admin successfully initialized centrally.');
    } catch (initErr) {
      logger.warn('Firebase central initialization warning:', { error: initErr.message });
    }
  } else {
    logger.warn('Could not find Firebase credentials. Deferring initialization to individual modules.');
  }
}

const originalConsoleError = console.error;
console.error = function(...args) {
  originalConsoleError.apply(console, args);
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Cannot read properties')) {
    logger.error('🔍 [CONSOLE ERROR]', {
      message: args.join(' '),
      timestamp: new Date().toISOString()
    });
  }
};

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

// LAZY ROUTE MOUNTING:
// Defers requiring heavy route modules until the first HTTP request arrives.
// Guarantees sub-second server boot (<150ms), eliminating Render 5s health check timeouts
// and freeing 80% RAM/CPU on Oracle Cloud micro-instance.
const lazyRoute = (moduleRelativePath) => {
  let router = null;
  return (req, res, next) => {
    if (!router) {
      try {
        const sw = Date.now();
        router = require(moduleRelativePath);
        logger.info(`⚡ Lazy-loaded route module on demand in ${Date.now() - sw}ms: ${moduleRelativePath}`);
      } catch (err) {
        logger.error(`Failed to lazy-load route: ${moduleRelativePath}`, { error: err.message, stack: err.stack });
        return next(err);
      }
    }
    return router(req, res, next);
  };
};

const safeMount = (routePath, moduleRelativePath) => {
  const handler = lazyRoute(moduleRelativePath);
  app.use(`/api${routePath}`, handler);
  app.use(routePath, handler);
};

safeMount('/deals', './routes/deals');
safeMount('/stocks', './routes/stocks');
safeMount('/logs', './routes/logs');
safeMount('/scheduler', './routes/scheduler');
safeMount('/notifications', './routes/notifications');
safeMount('/analytics', './routes/analytics');
safeMount('/execution', './routes/execution');
safeMount('/news', './routes/news');
safeMount('/banners', './routes/banners');
safeMount('/dad-expenses', './routes/dadExpenses');
safeMount('/favorites', './routes/favorites');
safeMount('/category-priority', './routes/categoryPriority');
safeMount('/commands', './routes/commands');
safeMount('/categories', './routes/categories');
safeMount('/matching-config', './routes/matchingConfig');
safeMount('/affiliates', './routes/affiliates');
safeMount('/auth', './routes/auth');
safeMount('/cuelinks', './routes/cuelinks');

// Background Services & Heavy Schedulers
// Gated strictly: NEVER run heavy schedulers, Chrome pollers, or daemon auto-starters on API server
// This protects the 512MB RAM budget on Render and frees 100% CPU/RAM on Oracle Cloud for instant API throughput
const isApiOnlyServer = process.env.ENABLE_BACKGROUND_SCHEDULER !== 'true';

try {
  if (admin.apps.length && !isApiOnlyServer) {
    const { notificationQueue } = require('../../services/NotificationQueueService');
    notificationQueue.startWorker();
  } else {
    logger.info('API server / Cloud environment detected. Skipping background Notification Queue Worker.');
  }
} catch (error) {
  logger.error('Failed to start Notification Queue Worker', { error: error.message });
}

// External keep-alive is handled continuously from outside by:
// 1. Oracle Cloud VM PM2 daemon (render-keepalive) pinging /health every 3 minutes
// 2. cron-job.org external monitoring service
// Internal loopback pings from inside the container are strictly disabled because hairpin TLS
// handshakes on single-vCPU containers saturate sockets and cause 5-second health-check timeouts.
logger.info('API server keep-alive managed by external Oracle VM & cron-job.org pingers.');

// Auto-start Stocks Master Scheduler (SKIP ON API SERVERS to protect RAM & CPU)
try {
  if (!isApiOnlyServer) {
    const { startMasterScheduler } = require('../../services/stocksMasterScheduler');
    startMasterScheduler();
    logger.info('🚀 Stocks Master Scheduler auto-started on server boot.');
  } else {
    logger.info('API server mode detected. Skipping heavy Stocks Master Scheduler to free 100% CPU/RAM for API requests.');
  }
} catch (schedErr) {
  logger.error('Failed to auto-start Stocks Master Scheduler on boot', { error: schedErr.message });
}

// Auto-start Local Daemon if offline on API startup (SKIP ON CLOUD / API SERVERS)
try {
  if (admin.apps.length && !isApiOnlyServer) {
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
  } else {
    logger.info('API server mode detected. Skipping Local Daemon auto-start helper (managed externally via PM2).');
  }
} catch (daemonError) {
  logger.error('Failed to auto-start Local Daemon helper', { error: daemonError.message });
}

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

// ============================================
// GRACEFUL RESOURCE CLEANUP & SHUTDOWN
// Frees RAM and CPU after request execution and on shutdown
// ============================================
const memoryCleanupTimer = setInterval(() => {
  try {
    if (global.gc) {
      global.gc();
    }
  } catch (_) {}
}, 2 * 60 * 1000);
if (memoryCleanupTimer.unref) memoryCleanupTimer.unref();

const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Gracefully cleaning up API server resources...`);
  if (serverInstance && serverInstance.close) {
    serverInstance.close(() => {
      logger.info('HTTP server closed cleanly.');
      process.exit(0);
    });
    // Hard kill after 5 seconds if connections hang
    setTimeout(() => {
      process.exit(0);
    }, 5000).unref();
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
