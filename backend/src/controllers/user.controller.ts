import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';

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
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
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
      // @ts-ignore
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      // @ts-ignore
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
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, пароль и роль обязательны' });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.status(201).json({ success: true, data: newUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, isActive } = req.body;

    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'Неверный ID пользователя' });
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { id: parsedId } });
    if (!existing) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const updated = await prisma.user.update({
      where: { id: parsedId },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
};

