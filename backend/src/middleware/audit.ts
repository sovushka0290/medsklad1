import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

const sanitizeBody = (body: any) => {
  if (!body) return undefined;
  const sanitized = { ...body };
  if (sanitized.password) sanitized.password = '***';
  if (sanitized.oldPassword) sanitized.oldPassword = '***';
  return sanitized;
};

export const auditLog = (actionName?: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', async () => {
      // Исключаем методы GET из логирования по умолчанию (если actionName не задан явно),
      // чтобы не засорять БД логами чтения
      if (!actionName && req.method === 'GET') return;

      try {
        const userId = (req as any).user?.id || null;
        const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
        const endpoint = `${req.method} ${req.originalUrl}`;
        const duration = Date.now() - start;
        
        const action = actionName || `${req.method}_${req.baseUrl.split('/').pop()?.toUpperCase()}`;

        await prisma.auditLog.create({
          data: {
            userId,
            action,
            endpoint,
            ipAddress,
            details: {
              statusCode: res.statusCode,
              durationMs: duration,
              query: req.query,
              body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
            }
          }
        });
      } catch (error) {
        console.error('Audit Log Error:', error);
      }
    });

    next();
  };
};
