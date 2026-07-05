import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../config';

export const refreshController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh токен отсутствует' });
    }

    try {
      const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as { id: number };
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      if (!user) {
        return res.status(401).json({ success: false, error: 'Пользователь не найден' });
      }

      const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
      const token = jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn as string,
      } as jwt.SignOptions);

      const newRefreshToken = jwt.sign(
        { id: user.id },
        config.jwtRefreshSecret,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        data: {
          token,
          refreshToken: newRefreshToken,
        },
      });
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Недействительный или истёкший refresh токен' });
    }
  } catch (error) {
    next(error);
  }
};
