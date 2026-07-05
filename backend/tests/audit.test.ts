// 🔐 Устанавливаем env vars ДО импорта config (fail-secure требует JWT_SECRET)
process.env.JWT_SECRET = 'test_jwt_secret_32_chars_min_length_ok';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret_32_chars_min_length';

// Мокаем prisma
jest.mock('../src/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
    }
  }
}));

import { prisma } from '../src/lib/prisma';
import { auditMiddleware } from '../src/middleware/audit.middleware';
import { Request, Response, NextFunction } from 'express';

describe('Audit Log Middleware Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction = jest.fn();
  let finishCallback: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      path: '/api/medications',
      method: 'GET',
      originalUrl: '/api/medications',
      ip: '127.0.0.1',
      headers: {},
      socket: {} as any,
    };
    
    mockResponse = {
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
        return mockResponse;
      })
    } as any;
  });

  test('Should call next and register finish listener', async () => {
    await auditMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  test('Should not log healthcheck requests', async () => {
    (mockRequest as any).path = '/api/health';
    await auditMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.on).not.toHaveBeenCalled();
  });

  test('Should write audit log on finish', async () => {
    await auditMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Симулируем событие finish
    (req: any) => { (req as any).user = { id: 10 }; };
    (mockRequest as any).user = { id: 10 };
    
    await finishCallback();

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 10,
        ipAddress: '127.0.0.1',
        action: 'GET /api/medications',
      }
    });
  });
});
