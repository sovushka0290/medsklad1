import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const updatePushToken = async (req: Request, res: Response) => {
  try {
    const { pushToken } = req.body;
    // req.user should be populated by auth middleware
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!pushToken) {
      return res.status(400).json({ error: 'Необходим pushToken' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { pushToken },
    });

    res.json({ message: 'Токен обновлен', user: { id: updatedUser.id, pushToken: updatedUser.pushToken } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
