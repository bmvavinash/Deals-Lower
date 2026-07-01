const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { getModuleLogger } = require('../../../logger/logger');
const admin = require('firebase-admin');
const constants = require('../../../config/constants');
const config = require('../../../config/config');

const logger = getModuleLogger('logs-api');

// Get Firebase reference for structured logs
function getFirebaseLogsRef() {
  try {
    const dbname = constants.postingTypesConfig[constants.type].DB;
    let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
    const db = admin.database();
    return db.ref('logs');
  } catch (error) {
    logger.warn('Firebase logs ref not available', { error: error.message });
    return null;
  }
}

/**
 * GET /api/logs
 * Get logs with optional filters
 * Query params: level, module, startDate, endDate, limit
 */
router.get('/', async (req, res, next) => {
  try {
    const { level, module, startDate, endDate, limit = 1000, category, database, source } = req.query;
    
    // Try Firebase first for structured logs (with timeout)
    const logsRef = getFirebaseLogsRef();
    if (logsRef) {
      try {
        // Add timeout to Firebase query
        const firebasePromise = logsRef.once('value');
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firebase timeout')), 3000)
        );
        
        const snapshot = await Promise.race([firebasePromise, timeoutPromise]);
        let logs = snapshot.val() || {};
        
        // Convert to array first to check if we have actual logs
        let logsArray = [];
        Object.entries(logs).forEach(([date, dateLogs]) => {
          Object.entries(dateLogs || {}).forEach(([moduleName, moduleLogs]) => {
            Object.entries(moduleLogs || {}).forEach(([logLevel, levelLogs]) => {
              Object.entries(levelLogs || {}).forEach(([logId, logEntry]) => {
                logsArray.push({
                  id: logId,
                  date,
                  module: moduleName,
                  level: logLevel,
                  ...logEntry
                });
              });
            });
          });
        });

        // Only use Firebase if we have actual log entries
        if (logsArray.length > 0) {
          // Apply filters
          if (level) {
            logsArray = logsArray.filter(log => log.level === level);
          }
          if (module) {
            // Support module presets: telegram, banners, bulk-updates
            if (module === 'telegram') {
              logsArray = logsArray.filter(log => 
                log.module?.toLowerCase().includes('telegram') || 
                log.moduleName?.toLowerCase().includes('telegram') ||
                log.message?.toLowerCase().includes('telegram')
              );
            } else if (module === 'banners') {
              logsArray = logsArray.filter(log => 
                log.module?.toLowerCase().includes('banner') || 
                log.moduleName?.toLowerCase().includes('banner') ||
                log.message?.toLowerCase().includes('banner')
              );
            } else if (module === 'bulk-updates') {
              logsArray = logsArray.filter(log => 
                log.module?.toLowerCase().includes('bulk') || 
                log.moduleName?.toLowerCase().includes('bulk') ||
                log.message?.toLowerCase().includes('bulk')
              );
            } else {
              logsArray = logsArray.filter(log => 
                log.module === module || log.moduleName === module
              );
            }
          }
          if (category) {
            logsArray = logsArray.filter(log => 
              log.message?.toLowerCase().includes(category.toLowerCase()) ||
              log.category?.toLowerCase().includes(category.toLowerCase())
            );
          }
          if (database) {
            logsArray = logsArray.filter(log => 
              log.message?.toLowerCase().includes(database.toLowerCase()) ||
              log.targetDb === database ||
              log.db === database
            );
          }
          if (source) {
            logsArray = logsArray.filter(log => 
              log.source === source ||
              log.sourceType === source
            );
          }
          if (startDate) {
            logsArray = logsArray.filter(log => log.timestamp >= startDate);
          }
          if (endDate) {
            logsArray = logsArray.filter(log => log.timestamp <= endDate);
          }

          // Sort by timestamp descending
          logsArray.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.date).getTime();
            const timeB = new Date(b.timestamp || b.date).getTime();
            return timeB - timeA;
          });

          // Apply limit
          logsArray = logsArray.slice(0, parseInt(limit));

          // Return Firebase logs if we have data after filtering
          if (logsArray.length > 0) {
            return res.json({
              success: true,
              data: logsArray,
              count: logsArray.length,
              source: 'firebase'
            });
          }
        }
        // If Firebase is empty or has no matching logs, fall through to file logs
      } catch (firebaseError) {
        logger.warn('Firebase logs fetch failed or empty, trying file logs', { error: firebaseError.message });
      }
    }
    
    // Always try file logs (even if Firebase check passed but had no data)
    // File logs are the primary source when Firebase is empty
    
    // Fallback to file-based logs
    const logsDir = path.join(__dirname, '../../../logs');
    if (!fs.existsSync(logsDir)) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        source: 'file',
        message: 'No logs directory found'
      });
    }
    
    logger.debug('Reading logs from files', { logsDir });

    // Get all log files, sorted by modification time (newest first)
    const logFiles = fs.readdirSync(logsDir)
      .filter(file => file.endsWith('.log') || file.endsWith('.log.gz'))
      .map(file => ({
        name: file,
        path: path.join(logsDir, file),
        mtime: fs.statSync(path.join(logsDir, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 10) // Last 10 log files
      .map(f => f.name);

    let allLogs = [];
    const parsedLimit = parseInt(limit) || 1000;

    // Filter helper function
    const matchesFilter = (log) => {
      if (level && log.level !== level) return false;
      if (module) {
        const modLower = module.toLowerCase();
        if (modLower === 'telegram') {
          const hasTelegram = (log.module || '').toLowerCase().includes('telegram') ||
                              (log.moduleName || '').toLowerCase().includes('telegram') ||
                              (log.message || '').toLowerCase().includes('telegram');
          if (!hasTelegram) return false;
        } else if (modLower === 'banners') {
          const hasBanner = (log.module || '').toLowerCase().includes('banner') ||
                            (log.moduleName || '').toLowerCase().includes('banner') ||
                            (log.message || '').toLowerCase().includes('banner');
          if (!hasBanner) return false;
        } else if (modLower === 'bulk-updates') {
          const hasBulk = (log.module || '').toLowerCase().includes('bulk') ||
                          (log.moduleName || '').toLowerCase().includes('bulk') ||
                          (log.message || '').toLowerCase().includes('bulk');
          if (!hasBulk) return false;
        } else {
          if (log.moduleName !== module && log.module !== module) return false;
        }
      }
      if (category) {
        const catLower = category.toLowerCase();
        const hasCat = (log.message || '').toLowerCase().includes(catLower) ||
                       (log.category || '').toLowerCase().includes(catLower);
        if (!hasCat) return false;
      }
      if (database) {
        const dbLower = database.toLowerCase();
        const hasDb = (log.message || '').toLowerCase().includes(dbLower) ||
                      log.targetDb === database ||
                      log.db === database;
        if (!hasDb) return false;
      }
      if (source) {
        if (log.source !== source && log.sourceType !== source) return false;
      }
      if (startDate) {
        const logTime = log.timestamp ? new Date(log.timestamp) : new Date(0);
        if (logTime < new Date(startDate)) return false;
      }
      if (endDate) {
        const logTime = log.timestamp ? new Date(log.timestamp) : new Date();
        if (logTime > new Date(endDate)) return false;
      }
      return true;
    };

    for (const file of logFiles) {
      if (allLogs.length >= parsedLimit) {
        break;
      }
      try {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        
        // Skip empty files
        if (stats.size === 0) {
          continue;
        }
        
        // Read last 2000 lines (decompressing if zipped)
        let content;
        if (file.endsWith('.gz')) {
          try {
            content = zlib.gunzipSync(fs.readFileSync(filePath)).toString('utf-8');
          } catch (zipErr) {
            logger.warn(`Failed to decompress log file ${file}`, { error: zipErr.message });
            continue;
          }
        } else {
          content = fs.readFileSync(filePath, 'utf-8');
        }
        const lines = content.split('\n').filter(line => line.trim());
        const recentLines = lines.slice(-2000); // Last 2000 lines per file
        
        // Process newest lines first (iterating backwards)
        for (let i = recentLines.length - 1; i >= 0; i--) {
          const line = recentLines[i];
          if (allLogs.length >= parsedLimit) {
            break;
          }
          try {
            const parsed = JSON.parse(line);
            // Winston format: { level, message, timestamp, moduleName, ...meta }
            const logEntry = {
              id: `${file}-${i}`,
              level: parsed.level || 'info',
              message: parsed.message || '',
              timestamp: parsed.timestamp || new Date().toISOString(),
              module: parsed.moduleName || 'GENERAL',
              moduleName: parsed.moduleName || 'GENERAL',
              ...parsed
            };
            if (matchesFilter(logEntry)) {
              allLogs.push(logEntry);
            }
          } catch (parseError) {
            // If not JSON, try to parse as text log
            let logLevel = 'info';
            if (line.toLowerCase().includes('error')) logLevel = 'error';
            else if (line.toLowerCase().includes('warn')) logLevel = 'warn';
            else if (line.toLowerCase().includes('debug')) logLevel = 'debug';
            
            const logEntry = {
              id: `${file}-${i}`,
              raw: line,
              timestamp: new Date().toISOString(),
              level: logLevel,
              message: line.substring(0, 200),
              module: 'GENERAL',
              moduleName: 'GENERAL'
            };
            if (matchesFilter(logEntry)) {
              allLogs.push(logEntry);
            }
          }
        }
      } catch (error) {
        logger.warn(`Error reading log file ${file}`, { error: error.message });
      }
    }

    // Sort to make sure it's descending order (mostly already is)
    allLogs.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });

    allLogs = allLogs.slice(0, parsedLimit);

    logger.debug('File logs processed', { 
      totalLogs: allLogs.length, 
      logFilesRead: logFiles.length,
      limit: parsedLimit,
      filters: { level, module, category, database, source }
    });

    res.json({
      success: true,
      data: allLogs,
      count: allLogs.length,
      source: 'file',
      message: allLogs.length === 0 
        ? `No logs found in ${logFiles.length} log files (check filters)` 
        : `Found ${allLogs.length} logs from ${logFiles.length} files`
    });
  } catch (error) {
    logger.error('Error fetching logs', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /api/logs/stats
 * Get log statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const stats = {
      total: 0,
      byLevel: {},
      byModule: {},
      errors: 0,
      warnings: 0,
      info: 0,
      debug: 0
    };

    // Try Firebase first (with timeout)
    const logsRef = getFirebaseLogsRef();
    if (logsRef) {
      try {
        const firebasePromise = logsRef.once('value');
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firebase timeout')), 3000)
        );
        
        const snapshot = await Promise.race([firebasePromise, timeoutPromise]);
        const logs = snapshot.val() || {};
        
        if (logs && Object.keys(logs).length > 0) {
          Object.values(logs).forEach(dateLogs => {
            Object.entries(dateLogs || {}).forEach(([moduleName, moduleLogs]) => {
              Object.entries(moduleLogs || {}).forEach(([logLevel, levelLogs]) => {
                const count = Object.keys(levelLogs || {}).length;
                stats.total += count;
                stats.byLevel[logLevel] = (stats.byLevel[logLevel] || 0) + count;
                stats.byModule[moduleName] = (stats.byModule[moduleName] || 0) + count;
                
                if (logLevel === 'error') stats.errors += count;
                else if (logLevel === 'warn') stats.warnings += count;
                else if (logLevel === 'info') stats.info += count;
                else if (logLevel === 'debug') stats.debug += count;
              });
            });
          });
        }
      } catch (error) {
        logger.warn('Error getting stats from Firebase, using file logs', { error: error.message });
      }
    }

    // Always count from file logs (they're the primary source)
    const logsDir = path.join(__dirname, '../../../logs');
    if (fs.existsSync(logsDir)) {
      const logFiles = fs.readdirSync(logsDir)
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(logsDir, file),
          mtime: fs.statSync(path.join(logsDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 10) // Last 10 log files
        .map(f => f.name);

      for (const file of logFiles) {
        try {
          const filePath = path.join(logsDir, file);
          const fileStats = fs.statSync(filePath);
          if (fileStats.size === 0) continue;
          
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').filter(line => line.trim());
          
          lines.forEach(line => {
            try {
              const parsed = JSON.parse(line);
              const level = parsed.level || 'info';
              const moduleName = parsed.moduleName || 'GENERAL';
              
              stats.total++;
              stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
              stats.byModule[moduleName] = (stats.byModule[moduleName] || 0) + 1;
              
              if (level === 'error') stats.errors++;
              else if (level === 'warn') stats.warnings++;
              else if (level === 'info') stats.info++;
              else if (level === 'debug') stats.debug++;
            } catch {
              // Not JSON, count as info
              stats.total++;
              stats.byLevel['info'] = (stats.byLevel['info'] || 0) + 1;
              stats.byModule['GENERAL'] = (stats.byModule['GENERAL'] || 0) + 1;
              stats.info++;
            }
          });
        } catch (error) {
          logger.warn(`Error reading log file ${file} for stats`, { error: error.message });
        }
      }
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching log stats', { error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * DELETE /api/logs
 * Clear logs (with optional date range)
 * Body: { startDate, endDate, level, module }
 */
router.delete('/', async (req, res, next) => {
  try {
    const { startDate, endDate, level, module } = req.body;
    
    // Clear Firebase logs
    const logsRef = getFirebaseLogsRef();
    if (logsRef) {
      try {
        if (startDate && endDate) {
          // Clear specific date range
          const snapshot = await logsRef.once('value');
          const logs = snapshot.val() || {};
          const updates = {};
          
          Object.entries(logs).forEach(([date, dateLogs]) => {
            if (date >= startDate && date <= endDate) {
              updates[date] = null; // Delete this date
            }
          });
          
          await logsRef.update(updates);
        } else {
          // Clear all Firebase logs
          await logsRef.remove();
        }
      } catch (error) {
        logger.warn('Error clearing Firebase logs', { error: error.message });
      }
    }

    // Note: File logs are not deleted for safety (they're rotated automatically)
    // If needed, we can add a separate endpoint with confirmation

    res.json({
      success: true,
      message: 'Logs cleared successfully',
      note: 'File logs are preserved for safety. Firebase logs have been cleared.'
    });
  } catch (error) {
    logger.error('Error clearing logs', { error: error.message });
    next(error);
  }
});

/**
 * POST /api/logs/fix
 * Trigger auto-fix flow for a scraping or validation error
 * Body: { productCode, productUrl, storeType, targetDb, issue }
 */
router.post('/fix', async (req, res, next) => {
  let driver = null;
  try {
    const { productCode, productUrl, storeType, targetDb = 'deals', issue } = req.body;

    if (!productUrl) {
      return res.status(400).json({
        success: false,
        message: 'Product URL is required for fixing'
      });
    }

    if (!productCode) {
      return res.status(400).json({
        success: false,
        message: 'Product Code (or ASIN) is required for fixing'
      });
    }

    logger.info('Auto-fix request received', { productCode, productUrl, storeType, targetDb, issue });

    const chrome = require('selenium-webdriver/chrome');
    const { Builder } = require('selenium-webdriver');
    const { productDealsDB } = require('../../../database/firebaseDB/productDealsDB');
    const missingDataRecoveryService = require('../../../services/missingDataRecoveryService');

    const net = require('net');
    const isPortOpen = (port) => new Promise((resolve) => {
      const socket = new net.Socket();
      const onError = () => {
        socket.destroy();
        resolve(false);
      };
      socket.setTimeout(800);
      socket.once('error', onError);
      socket.once('timeout', onError);
      socket.connect(port, '127.0.0.1', () => {
        socket.end();
        resolve(true);
      });
    });

    // WebDriver helper
    const getDriver = async () => {
      if (global.driver) {
        try {
          await global.driver.getTitle();
          return global.driver;
        } catch (e) {
          logger.warn('Global driver invalid, recreating session...');
          global.driver = null;
        }
      }

      const isDebuggerAvailable = await isPortOpen(9222);
      if (isDebuggerAvailable) {
        try {
          let options = new chrome.Options();
          options.debuggerAddress("localhost:9222");
          const session = await chrome.Driver.createSession(options);
          await session.getTitle();
          logger.info('Connected to running Chrome instance on port 9222');
          
          try {
            await session.sendDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
              source: 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
            });
            logger.info('DevTools script injected successfully for logs route debugger session.');
          } catch (cdpErr) {
            logger.warn('Failed to inject DevTools script in logs route debugger session', { error: cdpErr.message });
          }

          global.driver = session;
          return session;
        } catch (error) {
          logger.warn('Failed to connect to Chrome on port 9222 despite port open, falling back...', { error: error.message });
        }
      } else {
        logger.info('Port 9222 is closed, skipping remote debugging connection');
      }

      try {
        let options = new chrome.Options();
        options.addArguments('--headless=new');
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
        options.addArguments('--disable-blink-features=AutomationControlled');
        const standalone = await new Builder()
          .forBrowser('chrome')
          .setChromeOptions(options)
          .build();
        
        try {
          await standalone.sendDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
            source: 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
          });
        } catch (cdpErr) {
          logger.warn('Failed to inject DevTools script in logs route standalone session', { error: cdpErr.message });
          try {
            await standalone.executeScript('Object.defineProperty(navigator, "webdriver", {get: () => undefined})');
          } catch {}
        }

        logger.info('Standalone headless Chrome WebDriver initialized successfully');
        global.driver = standalone;
        return standalone;
      } catch (fallbackError) {
        logger.error('Failed to initialize standalone webdriver', { error: fallbackError.message });
        throw fallbackError;
      }
    };

    driver = await getDriver();

    // Fetch existing product from DB
    const safeKey = String(productCode).replace(/[.#$/\[\]]/g, '_');
    const ref = targetDb === 'productdeals' ? productDealsDB.productdealsRef : productDealsDB.dealsRef;
    const snap = await ref.child(safeKey).once('value');
    let product = snap.val();

    if (!product) {
      logger.info('Product not found in DB, creating stub object', { productCode, productUrl });
      product = {
        productCode,
        productUrl,
        storeType: storeType || 'Amazon',
        title: '',
        brand: '',
        price: '',
        photo: ''
      };
    }

    // Ensure productUrl is present
    if (!product.productUrl) {
      product.productUrl = productUrl;
    }

    logger.info('Running missing data recovery service...', { productCode });
    const recoveredProduct = await missingDataRecoveryService.recoverMissingData(product, driver);

    if (recoveredProduct) {
      // Save details back to the database
      const dbStatus = await productDealsDB.updateIndividualProduct(productCode, recoveredProduct, targetDb);
      logger.info('Product update completed after recovery', { productCode, status: dbStatus });

      const isStillMissing = missingDataRecoveryService.isMissingCriticalData(recoveredProduct);

      if (!isStillMissing) {
        // Trigger fixing similar errors in background
        triggerFixForSimilarErrors(storeType, driver, targetDb, productCode)
          .catch(err => logger.error('Error in triggerFixForSimilarErrors', { error: err.message }));
      }

      return res.json({
        success: true,
        message: isStillMissing 
          ? 'Retriggered scraping, but some fields are still missing. Verify selectors or page layout.'
          : 'Product fixed and updated successfully in database!',
        isStillMissing,
        data: recoveredProduct
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Recovery process execution returned null.'
      });
    }

  } catch (error) {
    logger.error('Error fixing log product', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: `Failed to fix product: ${error.message}`
    });
  }
});

/**
 * Automatically find, run recovery on, and resolve other similar errors in log files
 */
async function triggerFixForSimilarErrors(storeType, driver, targetDb, originalProductCode) {
  logger.info('🔍 Starting background auto-fix scan for similar errors...', { storeType });
  const logsDir = path.join(__dirname, '../../../logs');
  if (!fs.existsSync(logsDir)) {
    logger.warn('Logs directory does not exist, skipping similar errors auto-fix');
    return;
  }

  // Get the 5 most recently modified error or application log files
  const logFiles = fs.readdirSync(logsDir)
    .filter(file => file.startsWith('errors-') || file.startsWith('application-'))
    .map(file => ({
      name: file,
      path: path.join(logsDir, file),
      mtime: fs.statSync(path.join(logsDir, file)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 5);

  const similarProducts = [];
  const seenCodes = new Set([originalProductCode]);

  for (const logFile of logFiles) {
    try {
      let content;
      if (logFile.name.endsWith('.gz')) {
        content = zlib.gunzipSync(fs.readFileSync(logFile.path)).toString('utf-8');
      } else {
        content = fs.readFileSync(logFile.path, 'utf-8');
      }
      
      const lines = content.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          // Only look for error or warn logs
          if (parsed.level !== 'error' && parsed.level !== 'warn') continue;
          
          // Check if same storeType / platform
          const logStore = parsed.storeType || parsed.platform || '';
          const logUrl = parsed.productUrl || parsed.url || parsed.recoverySource || parsed.sourceUrl || '';
          const isSameStore = 
            (logStore && logStore.toLowerCase() === storeType.toLowerCase()) ||
            (logUrl && logUrl.toLowerCase().includes(storeType.toLowerCase()));
            
          if (!isSameStore) continue;

          // Resolve productCode and productUrl
          const productCode = parsed.productCode || parsed.asin || parsed.id || parsed.key || '';
          const productUrl = logUrl;

          if (productCode && productUrl && typeof productUrl === 'string' && typeof productCode === 'string' && !productUrl.startsWith('logs\\')) {
            const cleanCode = String(productCode).trim();
            if (!seenCodes.has(cleanCode)) {
              seenCodes.add(cleanCode);
              similarProducts.push({
                productCode: cleanCode,
                productUrl: productUrl.trim(),
                storeType,
                originalLine: line,
                filePath: logFile.path,
                fileName: logFile.name
              });
            }
          }
        } catch {}
      }
    } catch (err) {
      logger.warn('Failed to read log file for similar errors check', { file: logFile.name, error: err.message });
    }
  }

  logger.info(`📋 Found ${similarProducts.length} unique similar products to check and fix`, { codes: Array.from(seenCodes) });

  const missingDataRecoveryService = require('../../../services/missingDataRecoveryService');
  const { productDealsDB } = require('../../../database/firebaseDB/productDealsDB');

  // Process similar products one by one
  for (const item of similarProducts) {
    try {
      logger.info(`⚙️ Processing similar product: ${item.productCode} (${item.productUrl})`);
      
      // 1. Check if it's already resolved in the database
      const safeKey = String(item.productCode).replace(/[.#$/\[\]]/g, '_');
      const ref = targetDb === 'productdeals' ? productDealsDB.productdealsRef : productDealsDB.dealsRef;
      const snap = await ref.child(safeKey).once('value');
      let product = snap.val();

      let isSuccess = false;
      let recoveredProduct = null;

      if (product && !missingDataRecoveryService.isMissingCriticalData(product)) {
        logger.info(`✅ Similar product ${item.productCode} is already valid in database, marking resolved.`);
        isSuccess = true;
      } else {
        // 2. Trigger the recovery scraping
        if (!product) {
          product = {
            productCode: item.productCode,
            productUrl: item.productUrl,
            storeType: item.storeType,
            title: '', brand: '', price: '', photo: ''
          };
        }
        
        logger.info(`🔄 Running data recovery for similar product ${item.productCode}...`);
        recoveredProduct = await missingDataRecoveryService.recoverMissingData(product, driver);
        if (recoveredProduct && !missingDataRecoveryService.isMissingCriticalData(recoveredProduct)) {
          // Save to DB
          await productDealsDB.updateIndividualProduct(item.productCode, recoveredProduct, targetDb);
          logger.info(`✅ Similar product ${item.productCode} fixed successfully and saved to DB.`);
          isSuccess = true;
        } else {
          logger.warn(`❌ Similar product ${item.productCode} recovery failed or still missing critical data.`);
        }
      }

      // 3. If passing, update the corresponding log line in the file
      if (isSuccess) {
        await updateLogLineToResolved(item.filePath, item.fileName, item.originalLine, item.productCode);
      }
    } catch (itemErr) {
      logger.error(`Error processing similar product ${item.productCode}`, { error: itemErr.message });
    }
  }
  logger.info('🏁 Background auto-fix scan completed');
}

/**
 * Helper to update a specific error log line to resolved info status in a log file
 */
async function updateLogLineToResolved(filePath, fileName, originalLine, productCode) {
  try {
    logger.info(`📝 Updating log line in file ${fileName} for resolved product ${productCode}`);
    
    let content;
    const isGz = filePath.endsWith('.gz');
    
    if (isGz) {
      content = zlib.gunzipSync(fs.readFileSync(filePath)).toString('utf-8');
    } else {
      content = fs.readFileSync(filePath, 'utf-8');
    }

    const lines = content.split('\n');
    let matchedIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === originalLine.trim()) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex !== -1) {
      try {
        const parsed = JSON.parse(lines[matchedIndex]);
        parsed.level = 'info';
        parsed.message = `[RESOLVED/AUTO-FIXED] ${parsed.message || ''}`;
        parsed.resolvedAt = new Date().toISOString();
        lines[matchedIndex] = JSON.stringify(parsed);
        logger.info(`✨ Successfully updated log line to INFO status in ${fileName}`);
      } catch (parseErr) {
        lines[matchedIndex] = `[RESOLVED/AUTO-FIXED] ${lines[matchedIndex]}`;
      }

      const newContent = lines.join('\n');
      if (isGz) {
        fs.writeFileSync(filePath, zlib.gzipSync(Buffer.from(newContent, 'utf-8')));
      } else {
        fs.writeFileSync(filePath, newContent, 'utf-8');
      }
    } else {
      logger.warn(`Could not find the exact log line in ${fileName} to update`);
    }
  } catch (err) {
    logger.error(`Failed to update log file ${fileName} for resolved product ${productCode}`, { error: err.message });
  }
}

module.exports = router;




