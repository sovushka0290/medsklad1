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

// Настройка ротации логов для файлов
const fileRotateTransport = new DailyRotateFile({
  filename: path.join(__dirname, '../../../logs', 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d', // Хранить логи 14 дней
  maxSize: '20m', // Максимальный размер файла
  format: combine(timestamp(), errors({ stack: true }), json()),
});

const errorRotateTransport = new DailyRotateFile({
  filename: path.join(__dirname, '../../../logs', 'error-%DATE%.log'),
  level: 'error',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '30d', // Хранить логи ошибок 30 дней
  maxSize: '20m',
  format: combine(timestamp(), errors({ stack: true }), json()),
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), json()),
  transports: [
    fileRotateTransport,
    errorRotateTransport,
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(__dirname, '../../../logs', 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(__dirname, '../../../logs', 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
    }),
  ],
});

// В режиме разработки выводим в консоль с цветами
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}
