const express = require('express');
const router = express.Router();
const { executionTracker } = require('../../../services/executionTracker');
const { getModuleLogger } = require('../../../logger/logger');

const logger = getModuleLogger('execution-api');
const { MASTER_CATEGORY_CATALOG } = require('../../../config/masterCategorySeeds');


function getGhToken(customToken = null) {
  if (customToken) return customToken;
  const envToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || process.env.GH_TOKEN;
  if (envToken) return envToken;
  try {
    const { execSync } = require('child_process');
    const creds = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8',
      timeout: 3000
    });
    const match = creds.match(/password=(.+)/);
    if (match && match[1]) return match[1].trim();
  } catch (_) {}
  return null;
}

const GITHUB_WORKFLOW_MAP = {
  'category-electronics': 'category-electronics.yml',
  'category-fashion': 'category-fashion.yml',
  'category-home-kitchen': 'category-home-kitchen.yml',
  'category-beauty-personal-care': 'category-beauty.yml',
  'category-beauty': 'category-beauty.yml',
  'category-sports-fitness': 'category-sports-fitness.yml',
  'category-baby-kids': 'category-baby-kids.yml',
  'category-grocery': 'category-grocery.yml',
  'category-automotive': 'category-automotive.yml',
  'category-books-stationery': 'category-books-stationery.yml',
  'category-deals-trending': 'category-deals-trending.yml',
  'stale-products-update': 'stale-products-update.yml',
  'favorites-check': 'favorites-check.yml',
  'hot-deals-telegram': 'hot-deals-telegram.yml',
  'banners-fetch': 'banners-fetch.yml',
  'amazon-promo-cards-fetch': 'amazon-promo-cards-fetch.yml',
  'render-keepalive': 'render-keepalive.yml'
};

/**
 * GET /api/execution/status
 * Get current execution status
 * Query params: type (bulk_update|telegram_bot|all)
 */
router.get('/status', async (req, res) => {
  try {
    const { type = 'all' } = req.query;
    const status = executionTracker.getCurrentStatus();
    
    // Filter by type if specified
    let filteredStatus = status;
    if (type !== 'all' && status.currentExecution) {
      if (status.currentExecution.type !== type) {
        // Return empty execution if type doesn't match
        filteredStatus = {
          ...status,
          currentExecution: null
        };
      }
    }
    
    res.json({
      success: true,
      data: filteredStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting execution status', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/execution/analytics
 * Get execution analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const analytics = await executionTracker.getAnalytics();
    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting execution analytics', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/execution/history
 * Get execution history
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await executionTracker.getHistory(limit);
    res.json({
      success: true,
      data: history,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting execution history', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/execution/detailed
 * Get detailed execution status with platform and category breakdown
 */
router.get('/detailed', async (req, res) => {
  try {
    const status = executionTracker.getCurrentStatus();
    
    let breakdown = null;
    if (status.currentExecution && status.currentExecution.type === 'bulk_update') {
      const execution = status.currentExecution;
      breakdown = {
        platforms: {},
        categories: {},
        summary: {
          totalPlatforms: 0,
          completedPlatforms: 0,
          totalCategories: 0,
          completedCategories: 0,
          runningCategories: 0,
          pendingCategories: 0,
          zeroProductCategories: 0
        }
      };
      
      if (execution.platforms && typeof execution.platforms === 'object') {
        const platforms = Object.keys(execution.platforms);
        breakdown.summary.totalPlatforms = platforms.length;
        
        for (const [platform, platformData] of Object.entries(execution.platforms)) {
          const categories = platformData.categories || {};
          const categoryKeys = Object.keys(categories);
          
          let completedCount = 0;
          let runningCount = 0;
          let zeroCount = 0;
          
          const categoryDetails = {};
          for (const [category, categoryData] of Object.entries(categories)) {
            const total = categoryData.totalProducts || 0;
            const processed = categoryData.processed || 0;
            
            let status = 'pending';
            if (total === 0 && processed === 0) {
              status = 'zero';
              zeroCount++;
            } else if (processed >= total && total > 0) {
              status = 'completed';
              completedCount++;
            } else if (processed > 0) {
              status = 'running';
              runningCount++;
            }
            
            categoryDetails[category] = {
              status,
              totalProducts: total,
              processed: processed,
              created: categoryData.created || 0,
              updated: categoryData.updated || 0,
              errors: categoryData.errors || 0,
              startTime: categoryData.startTime,
              lastUpdate: categoryData.lastUpdate
            };
            
            breakdown.categories[category] = categoryDetails[category];
          }
          
          breakdown.platforms[platform] = {
            status: runningCount > 0 ? 'running' : (completedCount === categoryKeys.length && categoryKeys.length > 0 ? 'completed' : 'pending'),
            totalCategories: categoryKeys.length,
            completedCategories: completedCount,
            runningCategories: runningCount,
            zeroProductCategories: zeroCount,
            totalProducts: platformData.totalProducts || 0,
            processedProducts: platformData.totalProcessed || 0,
            created: platformData.totalCreated || 0,
            updated: platformData.totalUpdated || 0,
            categories: categoryDetails,
            startTime: platformData.startTime,
            lastUpdate: platformData.lastUpdate
          };
          
          if (completedCount === categoryKeys.length && categoryKeys.length > 0) {
            breakdown.summary.completedPlatforms++;
          }
          
          breakdown.summary.totalCategories += categoryKeys.length;
          breakdown.summary.completedCategories += completedCount;
          breakdown.summary.runningCategories += runningCount;
          breakdown.summary.zeroProductCategories += zeroCount;
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        ...status,
        breakdown
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting detailed execution status', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/execution/product/:productCode
 * Get product details by product code from current execution
 */
router.get('/product/:productCode', async (req, res) => {
  try {
    const { productCode } = req.params;
    const status = executionTracker.getCurrentStatus();
    
    if (!status.currentExecution) {
      return res.status(404).json({
        success: false,
        error: 'No active execution'
      });
    }

    // Search for product in execution data
    let productDetails = null;
    const platforms = status.currentExecution.platforms || {};
    
    for (const [platform, platformData] of Object.entries(platforms)) {
      const categories = platformData.categories || {};
      for (const [category, categoryData] of Object.entries(categories)) {
        const pages = categoryData.pages || {};
        for (const [pageKey, pageData] of Object.entries(pages)) {
          const products = pageData.products || [];
          const found = products.find((p) => p.productCode === productCode);
          if (found) {
            productDetails = {
              ...found,
              platform,
              category,
              page: pageKey,
              executionId: status.currentExecution.id
            };
            break;
          }
        }
        if (productDetails) break;
      }
      if (productDetails) break;
    }

    // If not found in execution, try to get from database
    if (!productDetails) {
      try {
        const { productDealsDB } = require('../../../database/firebaseDB/productDealsDB');
        const safeKey = String(productCode).replace(/[.#$/\[\]]/g, '_');
        const snapshot = await productDealsDB.productdealsRef.child(safeKey).once('value');
        const dbProduct = snapshot.val();
        
        if (dbProduct) {
          productDetails = {
            ...dbProduct,
            productCode,
            source: 'database'
          };
        }
      } catch (dbError) {
        logger.warn('Error fetching product from DB', { productCode, error: dbError.message });
      }
    }

    if (!productDetails) {
      return res.status(404).json({
        success: false,
        error: 'Product not found in current execution or database'
      });
    }

    res.json({
      success: true,
      data: productDetails,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting product details', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/execution/trigger
 * Trigger or enqueue a new execution task
 */
router.post('/trigger', async (req, res) => {
  try {
    const { type, params = {}, forceParallel = false } = req.body;
    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: type'
      });
    }

    const clientMetadata = {
      ip: req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress,
      origin: req.headers.origin || req.headers.referer || 'Website Monitor',
      userAgent: req.headers['user-agent'] || 'Unknown'
    };

    const task = await executionTracker.enqueueTask(type, params, clientMetadata, forceParallel);

    res.json({
      success: true,
      message: forceParallel ? 'Task started in parallel immediately.' : 'Task enqueued successfully.',
      data: task,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error triggering task', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/execution/queue/cancel
 * Cancel a pending queued task
 */
router.post('/queue/cancel', async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: taskId'
      });
    }

    await executionTracker.cancelQueuedTask(taskId);

    res.json({
      success: true,
      message: `Task ${taskId} has been cancelled and removed from queue.`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error cancelling queued task', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/execution/scheduler/config
 * Get dynamic scheduler configurations from Firebase
 */
router.get('/scheduler/config', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    const db = admin.database();
    const configRef = db.ref('schedulerConfig');
    
    const snapshot = await configRef.once('value');
    let configData = snapshot.val();
    
    // Auto-initialize defaults if database node does not exist or is empty
    if (!configData || Object.keys(configData).length === 0) {
      logger.info('Firebase schedulerConfig is empty. Writing default configurations from API self-healing endpoint...');
      configData = {
        bulkUpdatesInterval: 3,
        telegramBotInterval: 3,
        favoritesInterval: 1,
        dbUpdatesInterval: 2,
        bannersInterval: 4,
        isActiveDealsPeriod: false,
        updatedAt: new Date().toISOString()
      };
      await configRef.set(configData);
    }
    
    res.json({
      success: true,
      data: configData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting scheduler config', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/execution/scheduler/config
 * Update dynamic scheduler configurations in Firebase
 */
router.post('/scheduler/config', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    const db = admin.database();
    const configRef = db.ref('schedulerConfig');
    
    const newConfig = req.body;
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration data payload'
      });
    }
    
    const updateData = {
      ...newConfig,
      updatedAt: new Date().toISOString()
    };
    
    await configRef.update(updateData);
    
    res.json({
      success: true,
      message: 'Scheduler configurations updated successfully',
      data: updateData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error updating scheduler config', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/execution/heartbeat
 * Check the heartbeat of the local runner daemon
 */
router.get('/heartbeat', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    const db = admin.database();
    
    let heartbeat = null;
    let current = null;
    
    try {
      const axios = require('axios');
      const dbUrl = db.app.options.databaseURL;
      const [heartbeatRes, currentRes] = await Promise.all([
        axios.get(`${dbUrl}/daemonHeartbeat.json`, { timeout: 4000 }),
        axios.get(`${dbUrl}/executionTracking/current.json`, { timeout: 4000 })
      ]);
      heartbeat = heartbeatRes.data;
      current = currentRes.data;
    } catch (restErr) {
      logger.warn('REST heartbeat fallback triggered', { error: restErr.message });
      const heartbeatRef = db.ref('daemonHeartbeat');
      const statusRef = db.ref('executionTracking/current');
      const [heartbeatSnapshot, statusSnapshot] = await Promise.all([
        heartbeatRef.once('value'),
        statusRef.once('value')
      ]);
      heartbeat = heartbeatSnapshot.val() || null;
      current = statusSnapshot.val() || null;
    }

    let isDaemonAlive = false;
    let secondsSinceLastHeartbeat = null;

    if (heartbeat && heartbeat.timestamp) {
      const lastTime = new Date(heartbeat.timestamp).getTime();
      const diffMs = Date.now() - lastTime;
      secondsSinceLastHeartbeat = Math.round(diffMs / 1000);
      // Considered alive if heartbeat was received within last 60 seconds
      isDaemonAlive = secondsSinceLastHeartbeat < 60;
    }

    let isRunningScriptStuck = false;
    let secondsSinceLastScriptUpdate = null;

    if (current && current.status === 'running') {
      const lastUpdate = new Date(current.lastUpdate || current.startTime).getTime();
      const diffMs = Date.now() - lastUpdate;
      secondsSinceLastScriptUpdate = Math.round(diffMs / 1000);
      // Considered stuck if running for > 20 minutes without progress updates
      isRunningScriptStuck = secondsSinceLastScriptUpdate > (20 * 60);
    }

    res.json({
      success: true,
      data: {
        isDaemonAlive,
        secondsSinceLastHeartbeat,
        isRunningScriptStuck,
        secondsSinceLastScriptUpdate,
        heartbeat,
        currentExecution: current
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error checking execution heartbeat', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/execution/daemon/restart
 * Restarts the local runner daemon by killing existing process and spawning a new one
 */
router.post('/daemon/restart', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    const db = admin.database();
    const heartbeatRef = db.ref('daemonHeartbeat');
    
    const snapshot = await heartbeatRef.once('value');
    const heartbeat = snapshot.val();
    
    // Kill existing PID if available and running
    if (heartbeat && heartbeat.pid) {
      try {
        logger.info(`Killing daemon process pid: ${heartbeat.pid}`);
        process.kill(heartbeat.pid, 'SIGKILL');
      } catch (err) {
        logger.warn(`PID kill warning (process may already be stopped): ${err.message}`);
      }
    }
    
    // Spawn daemon process in background
    const { exec } = require('child_process');
    const path = require('path');
    const daemonScript = path.join(__dirname, '../../../scripts/localDaemon.js');
    
    logger.info(`Spawning new local daemon process from API server...`);
    const daemonProcess = exec(`node "${daemonScript}"`, {
      cwd: path.join(__dirname, '../../../'),
      detached: true,
      stdio: 'ignore'
    });
    
    daemonProcess.unref();
    
    // Clear/Reset heartbeat status
    await heartbeatRef.update({
      status: 'restarting',
      timestamp: new Date().toISOString(),
      notes: 'Daemon restart triggered via Admin Monitor panel'
    });
    
    res.json({
      success: true,
      message: 'Local runner daemon restart signal triggered successfully.'
    });
  } catch (error) {
    logger.error('Error restarting local daemon', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/execution/logs
 * Retrieve the latest log lines from the active log files
 */
router.get('/logs', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const logsDir = path.join(__dirname, '../../../logs');
    
    if (!fs.existsSync(logsDir)) {
      return res.json({ success: true, data: { fileName: 'none', availableFiles: [], lines: [] }, message: 'No logs directory found' });
    }

    const files = fs.readdirSync(logsDir)
      .filter(f => f.endsWith('.log'))
      .map(f => {
        const stats = fs.statSync(path.join(logsDir, f));
        return { name: f, size: stats.size, mtime: stats.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
      return res.json({ success: true, data: { fileName: 'none', availableFiles: [], lines: [] }, message: 'No log files found' });
    }

    // Default to latest log file
    const targetFile = req.query.file || files[0].name;
    const logFilePath = path.join(logsDir, targetFile);
    
    if (!fs.existsSync(logFilePath)) {
      return res.status(404).json({
        success: false,
        error: `Log file not found: ${targetFile}`
      });
    }
    
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    const rawLines = logContent.split('\n');
    const logLines = rawLines
      .map(line => {
        if (!line.trim()) return null;
        try {
          return JSON.parse(line);
        } catch (_) {
          return { message: line, level: 'info', timestamp: new Date().toISOString() };
        }
      })
      .filter(Boolean);

    res.json({
      success: true,
      data: {
        fileName: targetFile,
        availableFiles: files,
        lines: logLines.slice(-300)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting execution logs', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/**
 * GET /api/execution/github-actions
 * Returns live status of all tracked GitHub Actions, category rotation pointers, and catalog
 */
router.get('/github-actions', async (req, res) => {
  try {
    const admin = require('firebase-admin');
    let db = null;
    try {
      db = admin.database();
    } catch (_) {}

    let githubActionsData = {};
    let categoryPointersData = {};

    if (db) {
      try {
        const dbUrl = db.app?.options?.databaseURL;
        if (dbUrl) {
          const [actionsRes, pointersRes] = await Promise.all([
            fetch(`${dbUrl}/executionTracking/githubActions.json`, { signal: AbortSignal.timeout(4000) }).then(r => r.json()).catch(() => null),
            fetch(`${dbUrl}/schedulerState/categoryPointers.json`, { signal: AbortSignal.timeout(4000) }).then(r => r.json()).catch(() => null)
          ]);
          githubActionsData = actionsRes || {};
          categoryPointersData = pointersRes || {};
        }
      } catch (restErr) {
        // Fallback to RTDB
      }

      if (Object.keys(githubActionsData || {}).length === 0) {
        try {
          const [actionsSnap, pointersSnap] = await Promise.all([
            db.ref('executionTracking/githubActions').once('value'),
            db.ref('schedulerState/categoryPointers').once('value')
          ]);
          githubActionsData = actionsSnap.val() || {};
          categoryPointersData = pointersSnap.val() || {};
        } catch (dbErr) {
          logger.warn('RTDB github-actions query fallback error', { error: dbErr.message });
        }
      }
    }

    // Convert actions object to normalized array
    const actionsList = Object.entries(githubActionsData || {}).map(([key, item]) => {
      const isCategory = key.startsWith('category-');
      const categoryKey = isCategory ? key.replace('category-', '') : null;
      const pointerInfo = categoryKey && categoryPointersData ? categoryPointersData[categoryKey] : null;

      return {
        id: key,
        name: item.name || key,
        workflow: item.workflow || key,
        status: item.status || 'unknown',
        source: item.source || 'github-actions',
        runId: item.runId || null,
        commitSha: item.commitSha || null,
        startTime: item.startTime || null,
        completedAt: item.completedAt || null,
        duration: item.duration || 0,
        summary: item.summary || {},
        actionItems: item.actionItems || [],
        metadata: item.metadata || {},
        lastHeartbeat: item.lastHeartbeat || null,
        localDaemonDelegated: item.localDaemonDelegated || false,
        category: categoryKey,
        currentPointer: pointerInfo?.pointer || 0,
        lastQueries: pointerInfo?.lastQueries || item.metadata?.selectedQueries || []
      };
    });

    // Sort descending by completion / start time
    actionsList.sort((a, b) => {
      const timeA = new Date(a.completedAt || a.startTime || 0).getTime();
      const timeB = new Date(b.completedAt || b.startTime || 0).getTime();
      return timeB - timeA;
    });

    const serverHasGhToken = !!getGhToken();

    res.json({
      success: true,
      data: {
        actions: actionsList,
        categoryPointers: categoryPointersData || {},
        catalog: MASTER_CATEGORY_CATALOG || {},
        serverHasGhToken
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting github actions data', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/execution/github-actions/trigger
 * Dispatches a GitHub Action workflow or enqueues to commandsQueue
 */
router.post('/github-actions/trigger', async (req, res) => {
  try {
    const {
      category,
      target_query,
      actionName: reqActionName,
      dispatchTarget = 'auto',
      githubToken: customToken
    } = req.body;

    let actionName = reqActionName;
    if (!actionName) {
      if (category) {
        actionName = `category-${category.toLowerCase()}`;
      } else {
        actionName = 'stale-products-update';
      }
    }

    const workflowFile = GITHUB_WORKFLOW_MAP[actionName] || `${actionName}.yml`;
    const ghToken = getGhToken(customToken);
    const repo = process.env.GITHUB_REPOSITORY || 'bmvavinash/Deals-Lower';

    const admin = require('firebase-admin');
    let db = null;
    try {
      db = admin.database();
    } catch (_) {}

    let dispatchedVia = 'commands-queue';
    let ghaSuccess = false;
    let ghaError = null;

    // 1. Try GitHub Actions REST API dispatch if token available and not explicitly forced to daemon
    if (dispatchTarget !== 'commands-queue' && ghToken) {
      try {
        const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`;
        const payload = {
          ref: 'main',
          inputs: {}
        };
        if (category) payload.inputs.category = category;
        if (target_query) payload.inputs.target_query = target_query;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${ghToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'DealsOptimised-Admin'
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000)
        });

        if (response.status === 204 || response.status === 200) {
          ghaSuccess = true;
          dispatchedVia = 'github-actions';
        } else {
          const errBody = await response.json().catch(() => ({}));
          ghaError = errBody.message || `HTTP ${response.status}`;
          logger.warn(`GitHub Actions API dispatch error for ${workflowFile}: ${ghaError}`);
        }
      } catch (err) {
        ghaError = err.message;
        logger.warn(`GitHub Actions API dispatch error for ${workflowFile}: ${ghaError}`);
      }
    }

    // 2. Fallback to commandsQueue if GitHub Action dispatch did not run or was queued
    let queuedCommandId = null;
    if (!ghaSuccess || dispatchTarget === 'commands-queue') {
      if (db) {
        const queueRef = db.ref('commandsQueue');
        const newCmdRef = queueRef.push();
        queuedCommandId = newCmdRef.key;

        let cmdStr = '';
        if (actionName.startsWith('category-')) {
          const cat = category || actionName.replace('category-', '');
          cmdStr = target_query
            ? `CATEGORY="${cat}" TARGET_QUERY="${target_query}" node actions/category-runner.js`
            : `CATEGORY="${cat}" node actions/category-runner.js`;
        } else if (actionName === 'stale-products-update') {
          cmdStr = 'node actions/stale-products-runner.js';
        } else if (actionName === 'favorites-check') {
          cmdStr = 'node actions/favorites-runner.js';
        } else if (actionName === 'banners-fetch') {
          cmdStr = 'node actions/banners-runner.js';
        } else if (actionName === 'amazon-promo-cards-fetch') {
          cmdStr = 'node scripts/fetchAmazonPromoCards.js';
        } else {
          cmdStr = `node actions/${actionName}.js`;
        }

        await newCmdRef.set({
          id: queuedCommandId,
          name: `UI Trigger: ${actionName} [${target_query || 'rotating'}]`,
          command: cmdStr,
          status: 'pending',
          role: 'bulk',
          source: 'ui-admin-dispatch',
          category: category || null,
          targetQuery: target_query || null,
          actionName,
          createdAt: new Date().toISOString(),
          triggeredBy: req.ip || 'Admin UI'
        });
        dispatchedVia = 'commands-queue';
      }
    }

    // 3. Mark action as queued in Firebase RTDB executionTracking
    if (db) {
      try {
        await db.ref(`executionTracking/githubActions/${actionName}`).update({
          name: actionName,
          status: 'queued',
          lastHeartbeat: new Date().toISOString(),
          lastTriggered: new Date().toISOString(),
          targetQuery: target_query || 'rotating',
          dispatchedVia,
          triggeredBy: req.ip || 'Admin UI'
        });
      } catch (_) {}
    }

    const message = ghaSuccess
      ? `Workflow "${workflowFile}" successfully dispatched on GitHub Actions!`
      : queuedCommandId
        ? `Queued task for "${actionName}" (ID: ${queuedCommandId}) to commandsQueue for Local/Oracle Daemon execution. ${ghaError ? '(GitHub API Notice: ' + ghaError + ')' : ''}`
        : `Action "${actionName}" triggered successfully.`;

    res.json({
      success: true,
      message,
      dispatchedVia,
      actionName,
      workflowFile,
      queuedCommandId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error triggering github action', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;




