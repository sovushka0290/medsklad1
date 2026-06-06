import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_KEY || 'MedSkladSecretKey123';

  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({
      error: 'Доступ запрещен: отсутствует или недействительный API-ключ (x-api-key)',
    });
  }

  next();
};
