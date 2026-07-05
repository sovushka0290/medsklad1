import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string | undefined;

  // 1. Проверка API Key (только если задан в .env)
  if (apiKey && config.apiKey && apiKey === config.apiKey) {
    const user = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { id: 'asc' },
    });
    if (user) {
      req.user = user;
    }
    return next();
  }

  // 2. Проверка JWT токена
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Доступ запрещен: отсутствует токен авторизации',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { id: number; email: string; role: string; name: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Пользователь не найден' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Недействительный или истёкший токен' });
  }
};

// Алиас для обратной совместимости (используется в ai.routes, inventory.routes, user.routes)
export const requireAuth = authMiddleware;

export const roleGuard = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ success: false, error: 'Недостаточно прав' });
    }
    next();
  };
};
