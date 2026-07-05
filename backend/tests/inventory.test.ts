process.env.JWT_SECRET = 'test_jwt_secret_32_chars_min_length_ok';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret_32_chars_min_length';

import { Request, Response } from 'express';
import { startSession, closeSession, getSessionHistory, adjustQuantity } from '../src/controllers/inventory.controller';
import * as inventoryService from '../src/services/inventory.service';

jest.mock('../src/services/inventory.service', () => ({
  startInventorySession: jest.fn(),
  completeInventorySession: jest.fn(),
  getCompletedSessions: jest.fn(),
  adjustInventoryItem: jest.fn(),
}));

jest.mock('../src/lib/prisma', () => ({
  prisma: { auditLog: { create: jest.fn() } }
}));

describe('Inventory Controller Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test('POST /inventory/start should start a new session', async () => {
    mockRequest = {
      body: { locationId: 1 },
      user: { id: 42 }
    } as any;

    const mockSession = { id: 1, locationId: 1, userId: 42, status: 'ACTIVE' };
    (inventoryService.startInventorySession as jest.Mock).mockResolvedValue(mockSession);

    await startSession(mockRequest as Request, mockResponse as Response);

    expect(inventoryService.startInventorySession).toHaveBeenCalledWith(1, 42);
    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.json).toHaveBeenCalledWith(mockSession);
  });

  test('POST /inventory/:id/close should complete a session', async () => {
    mockRequest = {
      params: { id: '1' }
    };

    const mockSession = { id: 1, status: 'COMPLETED' };
    (inventoryService.completeInventorySession as jest.Mock).mockResolvedValue(mockSession);

    await closeSession(mockRequest as Request, mockResponse as Response);

    expect(inventoryService.completeInventorySession).toHaveBeenCalledWith(1);
    expect(mockResponse.json).toHaveBeenCalledWith(mockSession);
  });

  test('GET /inventory/history should return completed sessions', async () => {
    mockRequest = {};

    const mockSessions = [{ id: 1, status: 'COMPLETED' }, { id: 2, status: 'COMPLETED' }];
    (inventoryService.getCompletedSessions as jest.Mock).mockResolvedValue(mockSessions);

    await getSessionHistory(mockRequest as Request, mockResponse as Response);

    expect(inventoryService.getCompletedSessions).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(mockSessions);
  });

  test('PUT /inventory/:id/adjust should adjust item quantity', async () => {
    mockRequest = {
      params: { id: '1' },
      body: { barcode: '123', quantityAdjustment: 5 }
    };

    const mockItem = { id: 10, sessionId: 1, actualQuantity: 5, difference: 5 };
    (inventoryService.adjustInventoryItem as jest.Mock).mockResolvedValue(mockItem);

    await adjustQuantity(mockRequest as Request, mockResponse as Response);

    expect(inventoryService.adjustInventoryItem).toHaveBeenCalledWith(1, '123', 5);
    expect(mockResponse.json).toHaveBeenCalledWith(mockItem);
  });
});
