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

      if (!user) {
        return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ success: false, error: 'Неверный email или пароль' });
      }

      const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
      const token = jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn as string,
      } as jwt.SignOptions);

      res.json({
        success: true,
        data: {
          token,
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
      const user = req.user;
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
};
