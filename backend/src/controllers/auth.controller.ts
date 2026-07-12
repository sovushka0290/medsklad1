import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });

      // 🔐 SECURITY: Всегда вычисляем bcrypt.compare для защиты от timing attack
      // (время ответа одинаковое независимо от того, найден пользователь или нет)
      const dummyHash = '$2b$10$CoYmZ7n5Zc9j/jH5O9WkNe1234567890123456789012345678901';
      const isPasswordValid = user
        ? await bcrypt.compare(password, user.password)
        : await bcrypt.compare(password, dummyHash);

      if (!user || !isPasswordValid) {
        return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
      }

      const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
      const token = jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn as string,
      } as jwt.SignOptions);

      const refreshToken = jwt.sign({ id: user.id }, config.jwtRefreshSecret, {
        expiresIn: config.jwtRefreshExpiresIn as string,
      } as jwt.SignOptions);

      res.json({
        success: true,
        data: {
          token,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ success: false, error: 'Не авторизован' });
      }
      // Не отправляем пароль клиенту
      const { password, ...safeUser } = user;
      res.json({ success: true, data: safeUser });
    } catch (error) {
      next(error);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(401).json({ success: false, error: 'Refresh token обязателен' });
      }

      const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as { id: number };
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      if (!user) {
        return res.status(401).json({ success: false, error: 'Пользователь не найден' });
      }

      const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
      const token = jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn as string,
      } as jwt.SignOptions);

      const newRefreshToken = jwt.sign({ id: user.id }, config.jwtRefreshSecret, {
        expiresIn: config.jwtRefreshExpiresIn as string,
      } as jwt.SignOptions);

      res.json({
        success: true,
        data: {
          token,
          refreshToken: newRefreshToken,
        },
      });
    } catch (error) {
      res.status(401).json({ success: false, error: 'Недействительный или истекший refresh token' });
    }
  },
};
