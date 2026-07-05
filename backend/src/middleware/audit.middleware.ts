import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export const auditMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Исключаем хелсчек, чтобы не засорять базу
  if (req.path === '/api/health' || req.path === '/health') {
    return next();
  }

  // Записываем лог при завершении ответа
  res.on('finish', async () => {
    try {
      const user = (req as any).user;
      const userId = user ? user.id : null;
      
      const ip = 
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        (req.headers['x-real-ip'] as string) ||
        req.ip ||
        req.socket.remoteAddress ||
        null;

      const action = `${req.method} ${req.originalUrl || req.url}`;

      // @ts-ignore
      await prisma.auditLog.create({
        data: {
          userId,
          ipAddress: ip,
          action,
          endpoint: req.originalUrl || req.url,
        },
      });
    } catch (error) {
      console.error('[AuditLog Error]:', error);
    }
  });

  next();
};
