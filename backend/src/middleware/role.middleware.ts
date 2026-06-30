import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

export const roleGuard = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ success: false, error: 'Пользователь не авторизован' });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: `Доступ запрещен. У вас роль ${user.role}, а требуется одна из: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};
