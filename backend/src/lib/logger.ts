import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// Настройка кастомного формата для консоли
const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  })
);

// Проверяем, запущено ли приложение в Serverless/Vercel окружении
const isServerless = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

let transports: winston.transport[] = [];
let exceptionHandlers: any[] = [];
let rejectionHandlers: any[] = [];

if (isServerless) {
  // В Serverless-окружении (Vercel) пишем только в консоль, чтобы не вызывать ошибку EROFS
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
} else {
  // В локальной разработке пишем в файлы с ротацией
  const fileRotateTransport = new DailyRotateFile({
    filename: path.join(__dirname, '../../../logs', 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    maxSize: '20m',
    format: combine(timestamp(), errors({ stack: true }), json()),
  });

  const errorRotateTransport = new DailyRotateFile({
    filename: path.join(__dirname, '../../../logs', 'error-%DATE%.log'),
    level: 'error',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    maxSize: '20m',
    format: combine(timestamp(), errors({ stack: true }), json()),
  });

  transports.push(fileRotateTransport, errorRotateTransport);

  exceptionHandlers.push(
    new DailyRotateFile({
      filename: path.join(__dirname, '../../../logs', 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    })
  );

  rejectionHandlers.push(
    new DailyRotateFile({
      filename: path.join(__dirname, '../../../logs', 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), json()),
  transports,
  exceptionHandlers: exceptionHandlers.length > 0 ? exceptionHandlers : undefined,
  rejectionHandlers: rejectionHandlers.length > 0 ? rejectionHandlers : undefined,
});

// Если не Serverless и NODE_ENV не production, дополнительно выводим в консоль
if (!isServerless && process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

