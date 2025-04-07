const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');

const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
  })
);

const fileFormat = format.combine(
  format.timestamp(),
  format.json()
);

const logger = createLogger({
  level: 'info',
  // format: format.combine(
  //   format.timestamp(),
  //   format.json(),
  //   format.printf(({ timestamp, level, message, ...meta }) => {
  //     return `${timestamp} [${level}] ${message} ${JSON.stringify(meta)}`;
  //   })
  // ),
  transports: [
    new transports.Console({
      format: consoleFormat
    }),
    new transports.DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat
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
