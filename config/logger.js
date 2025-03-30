const winston = require('winston');
const path = require('path');
const DailyRotateFile = require('winston-daily-rotate-file'); 

const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');
const logDir = path.join(__dirname, '../logs');

try {
    const fs = require('fs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }
} catch (err) {
    console.error('Не удалось создать директорию для логов:', logDir, err);
}

const consoleFormat = winston.format.combine();
const fileFormat = winston.format.combine();

const transports = [
    new winston.transports.Console({
        level: logLevel,
        format: consoleFormat,
        handleExceptions: true,
        handleRejections: true,
    }),
];

if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
     transports.push(
         new DailyRotateFile({
             level: 'http', 
             dirname: logDir,
             filename: 'app-%DATE%.log',
             datePattern: 'YYYY-MM-DD',
             zippedArchive: true,
             maxSize: '20m',    
             maxFiles: '14d',    
             format: fileFormat,
         })
     );
     transports.push(
         new DailyRotateFile({
             level: 'error',
             dirname: logDir,
             filename: 'error-%DATE%.log', 
             datePattern: 'YYYY-MM-DD',
             zippedArchive: true,
             maxSize: '20m',
             maxFiles: '30d',
             format: fileFormat,
         })
     );
}

const logger = winston.createLogger({
    level: logLevel,
    transports: transports,
    exitOnError: false,
});

logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    },
};

process.on('unhandledRejection', (reason, promise) => {
   logger.error('НЕПЕРЕХВАЧЕННЫЙ REJECTION:', { promise, reason });
});
process.on('uncaughtException', (error) => {
   logger.error('НЕПЕРЕХВАЧЕННОЕ ИСКЛЮЧЕНИЕ:', error);
});

module.exports = logger;