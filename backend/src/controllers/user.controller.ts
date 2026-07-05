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

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({ error: 'Параметр page должен быть целым положительным числом' });
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'Параметр limit должен быть от 1 до 100' });
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count(),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

