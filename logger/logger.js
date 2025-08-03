const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');

// Set log level based on environment
const logLevel = process.env.LOG_LEVEL || 'info';

const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level, message, moduleName, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level.toUpperCase()}] [${moduleName || 'GENERAL'}]: ${message} ${metaStr}`;
  })
);

const fileFormat = format.combine(
  format.timestamp(),
  format.json()
);

// Create separate log files for different levels
const logger = createLogger({
  level: logLevel,
  transports: [
    // Console transport for all levels
    new transports.Console({
      format: consoleFormat
    }),
    
    // Daily rotating file for all logs
    new transports.DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat
    }),
    
    // Separate error log file
    new transports.DailyRotateFile({
      filename: 'logs/errors-%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: fileFormat
    }),
    
    // Separate debug log file (only if debug level is enabled)
    ...(logLevel === 'debug' ? [new transports.DailyRotateFile({
      filename: 'logs/debug-%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '7d',
      level: 'debug',
      format: fileFormat
    })] : [])
  ]
});

// Example function to add metadata to the log for context
function getModuleLogger(moduleName) {
  return {
    info: (message, meta = {}) => logger.info(message, { moduleName, ...meta }),
    error: (message, meta = {}) => logger.error(message, { moduleName, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { moduleName, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { moduleName, ...meta }),
    
    // Additional helper methods for better debugging
    logError: (error, context = {}) => {
      logger.error('Error occurred', { 
        moduleName, 
        error: error.message, 
        stack: error.stack, 
        ...context 
      });
    },
    
    logScrapingError: (platform, attribute, error, url = '') => {
      logger.error(`[${platform}] ${attribute} extraction failed`, { 
        moduleName, 
        platform, 
        attribute, 
        error: error.message, 
        stack: error.stack, 
        url 
      });
    },
    
    logScrapingSuccess: (platform, data = {}) => {
      logger.info(`[${platform}] Scraping completed successfully`, { 
        moduleName, 
        platform, 
        ...data 
      });
    }
  };
}

// Global error handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { 
    error: error.message, 
    stack: error.stack 
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { 
    promise, 
    reason: reason?.message || reason,
    stack: reason?.stack 
  });
});

module.exports = { logger, getModuleLogger };
