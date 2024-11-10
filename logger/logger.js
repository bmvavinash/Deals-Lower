const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json(),
    format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}] ${message} ${JSON.stringify(meta)}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});

// Example function to add metadata to the log for context
function getModuleLogger(moduleName) {
  return {
    info: (message, meta = {}) => logger.info(message, { moduleName, ...meta }),
    error: (message, meta = {}) => logger.error(message, { moduleName, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { moduleName, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { moduleName, ...meta }),
  };
}

module.exports = { logger, getModuleLogger };
