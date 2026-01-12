const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
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
      .filter(file => file.endsWith('.log'))
      .map(file => ({
        name: file,
        path: path.join(logsDir, file),
        mtime: fs.statSync(path.join(logsDir, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 10) // Last 10 log files
      .map(f => f.name);

    let allLogs = [];
    for (const file of logFiles) {
      try {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        
        // Skip empty files
        if (stats.size === 0) {
          continue;
        }
        
        // Read last 2000 lines to avoid memory issues
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        const recentLines = lines.slice(-2000); // Last 2000 lines per file
        
        recentLines.forEach((line, lineIndex) => {
          try {
            const parsed = JSON.parse(line);
            // Winston format: { level, message, timestamp, moduleName, ...meta }
            allLogs.push({
              id: `${file}-${lineIndex}`,
              level: parsed.level || 'info',
              message: parsed.message || '',
              timestamp: parsed.timestamp || new Date().toISOString(),
              module: parsed.moduleName || 'GENERAL',
              moduleName: parsed.moduleName || 'GENERAL',
              ...parsed
            });
          } catch (parseError) {
            // If not JSON, try to parse as text log
            // Try to extract level from line
            let logLevel = 'info';
            if (line.toLowerCase().includes('error')) logLevel = 'error';
            else if (line.toLowerCase().includes('warn')) logLevel = 'warn';
            else if (line.toLowerCase().includes('debug')) logLevel = 'debug';
            
            allLogs.push({
              id: `${file}-${lineIndex}`,
              raw: line,
              timestamp: new Date().toISOString(),
              level: logLevel,
              message: line.substring(0, 200),
              module: 'GENERAL',
              moduleName: 'GENERAL'
            });
          }
        });
      } catch (error) {
        logger.warn(`Error reading log file ${file}`, { error: error.message });
      }
    }

    // Apply filters
    if (level) {
      allLogs = allLogs.filter(log => log.level === level);
    }
    if (module) {
      // Support module presets: telegram, banners, bulk-updates
      if (module === 'telegram') {
        allLogs = allLogs.filter(log => 
          log.module?.toLowerCase().includes('telegram') || 
          log.moduleName?.toLowerCase().includes('telegram') ||
          log.message?.toLowerCase().includes('telegram')
        );
      } else if (module === 'banners') {
        allLogs = allLogs.filter(log => 
          log.module?.toLowerCase().includes('banner') || 
          log.moduleName?.toLowerCase().includes('banner') ||
          log.message?.toLowerCase().includes('banner')
        );
      } else if (module === 'bulk-updates') {
        allLogs = allLogs.filter(log => 
          log.module?.toLowerCase().includes('bulk') || 
          log.moduleName?.toLowerCase().includes('bulk') ||
          log.message?.toLowerCase().includes('bulk')
        );
      } else {
        allLogs = allLogs.filter(log => 
          log.moduleName === module || log.module === module
        );
      }
    }
    if (category) {
      allLogs = allLogs.filter(log => 
        log.message?.toLowerCase().includes(category.toLowerCase()) ||
        log.category?.toLowerCase().includes(category.toLowerCase())
      );
    }
    if (database) {
      allLogs = allLogs.filter(log => 
        log.message?.toLowerCase().includes(database.toLowerCase()) ||
        log.targetDb === database ||
        log.db === database
      );
    }
    if (source) {
      allLogs = allLogs.filter(log => 
        log.source === source ||
        log.sourceType === source
      );
    }
    if (startDate) {
      allLogs = allLogs.filter(log => {
        const logTime = log.timestamp ? new Date(log.timestamp) : new Date(0);
        return logTime >= new Date(startDate);
      });
    }
    if (endDate) {
      allLogs = allLogs.filter(log => {
        const logTime = log.timestamp ? new Date(log.timestamp) : new Date();
        return logTime <= new Date(endDate);
      });
    }

    // Sort and limit
    allLogs.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });

    allLogs = allLogs.slice(0, parseInt(limit));

    logger.debug('File logs processed', { 
      totalLogs: allLogs.length, 
      logFilesRead: logFiles.length,
      limit: parseInt(limit),
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

module.exports = router;




