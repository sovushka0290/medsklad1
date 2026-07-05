import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);

  // Prisma known errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: 'Запись с такими данными уже существует (нарушение уникальности)',
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: 'Запись не найдена',
    });
  }

  const statusCode = err.statusCode || 500;

  // 🔐 SECURITY: Скрываем детали ошибки в production
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Внутренняя ошибка сервера'
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
