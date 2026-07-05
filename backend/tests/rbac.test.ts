process.env.JWT_SECRET = 'test_jwt_secret_32_chars_min_length_ok';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret_32_chars_min_length';

import { Request, Response, NextFunction } from 'express';
import { roleGuard } from '../src/middleware/auth.middleware';

describe('RBAC Middleware Tests', () => {
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

  test('Should allow access if user has required role', () => {
    mockRequest = {
      user: { id: 1, role: 'ADMIN' }
    } as any;

    const middleware = roleGuard(['ADMIN', 'MANAGER']);
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  test('Should block access with 403 if user lacks required role', () => {
    mockRequest = {
      user: { id: 2, role: 'NURSE' }
    } as any;

    const middleware = roleGuard(['ADMIN', 'MANAGER']);
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Нет доступа. Требуются роли: ADMIN, MANAGER' });
  });

  test('Should block access with 401 if no user is attached to request', () => {
    mockRequest = {}; // No user

    const middleware = roleGuard(['ADMIN']);
    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Не авторизован' });
  });
});
