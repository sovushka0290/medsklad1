// 🔐 Устанавливаем env vars ДО импорта config (fail-secure требует JWT_SECRET)
process.env.JWT_SECRET = 'test_jwt_secret_32_chars_min_length_ok';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret_32_chars_min_length';

import jwt from 'jsonwebtoken';
import { config } from '../src/config';

// Мокаем prisma до импортов контроллеров/сервисов
jest.mock('../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    }
  }
}));

import { prisma } from '../src/lib/prisma';
import { refreshController } from '../src/controllers/refresh.controller';
import { Request, Response } from 'express';

describe('Auth & Refresh Token Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test('Should return 400 if refreshToken is missing', async () => {
    mockRequest = {
      body: {}
    };

    await refreshController(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'Refresh токен отсутствует'
    });
  });

  test('Should refresh token successfully for a valid user and valid refresh token', async () => {
    const userId = 42;
    const testUser = {
      id: userId,
      email: 'nurse@medsklad.kz',
      role: 'NURSE',
      name: 'Медсестра Анна',
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(testUser);

    const refreshToken = jwt.sign({ id: userId }, config.jwtRefreshSecret, { expiresIn: '7d' });
    mockRequest = {
      body: { refreshToken }
    };

    await refreshController(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: userId } });
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        token: expect.any(String),
        refreshToken: expect.any(String),
      }),
    }));
  });

  test('Should return 401 for an invalid/expired refresh token', async () => {
    mockRequest = {
      body: { refreshToken: 'invalid-token-value' }
    };

    await refreshController(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'Недействительный или истёкший refresh токен'
    });
  });
});
