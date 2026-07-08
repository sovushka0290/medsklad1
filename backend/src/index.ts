import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import morgan from 'morgan';
import compression from 'compression';

import { config } from './config';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';
import authRoutes from './routes/auth.routes';
import medicationRoutes from './routes/medication.routes';
import transactionRoutes from './routes/transaction.routes';
import procedureRoutes from './routes/procedure.routes';
import dashboardRoutes from './routes/dashboard.routes';
import importRoutes from './routes/import.routes';
import exportRoutes from './routes/export.routes';
import aiRoutes from './routes/ai.routes';
import inventoryRoutes from './routes/inventory.routes';
import userRoutes from './routes/user.routes';
import { errorHandler } from './middleware/error.middleware';
import { auditMiddleware } from './middleware/audit.middleware';

const app = express();

// Performance Optimization
app.use(compression());

// Базовые Middleware (лимит 50mb для загрузки фото)
app.use(express.json({ limit: '50mb' }));

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Отключаем для API
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
app.use(cors({ origin: config.cors.origin }));
app.use(hpp());

// Логирование HTTP-запросов через winston
const morganFormat = process.env.NODE_ENV !== 'production' ? 'dev' : 'combined';
app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

app.use(auditMiddleware);

// Global Rate Limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, error: 'Слишком много запросов с вашего IP, попробуйте позже' },
});
app.use('/api', limiter);

// Роуты
app.use('/api', authRoutes);
app.use('/api', medicationRoutes);
app.use('/api', transactionRoutes);
app.use('/api/procedures', procedureRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/users', userRoutes);

// Health check — без раскрытия версии
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ success: true, status: 'ok' });
});

// 404 handler (АРХ-4)
app.use((req: Request, res: Response) => {
  logger.warn(`Маршрут ${req.method} ${req.path} не найден`);
  res.status(404).json({ success: false, error: `Маршрут ${req.method} ${req.path} не найден` });
});

// Глобальный обработчик ошибок (должен быть последним)
app.use(errorHandler);

// Запуск сервера с graceful shutdown (КАЧ-6)
const server = app.listen(config.port, () => {
  logger.info(`[MedSklad] Сервер запущен на порту ${config.port}`);
});

server.timeout = 30000; // 30 секунд таймаут (АРХ-5)

const shutdown = async (signal: string) => {
  logger.info(`[MedSklad] Получен ${signal}, завершение работы...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('[MedSklad] БД отключена, сервер остановлен.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
