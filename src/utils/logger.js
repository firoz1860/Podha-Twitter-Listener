const winston = require('winston');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.dirname(process.env.LOG_FILE || './logs/app.log');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'podha-twitter-listener' },
  transports: [
    new winston.transports.File({ 
      filename: process.env.LOG_FILE || './logs/app.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Handle uncaught exceptions
logger.exceptions.handle(
  new winston.transports.File({ filename: './logs/exceptions.log' })
);

module.exports = logger;