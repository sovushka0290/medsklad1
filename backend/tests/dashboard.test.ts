process.env.JWT_SECRET = 'test_jwt_secret_32_chars_min_length_ok';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret_32_chars_min_length';

import { Request, Response } from 'express';
import { getMetrics } from '../src/controllers/dashboard.controller';
import * as dashboardService from '../src/services/dashboard.service';

jest.mock('../src/services/dashboard.service', () => ({
  getDashboardMetrics: jest.fn(),
}));

jest.mock('../src/lib/prisma', () => ({
  prisma: { auditLog: { create: jest.fn() } }
}));

describe('Dashboard Controller Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test('GET /dashboard should call service with filter', async () => {
    mockRequest = {
      query: { filter: 'month' }
    };

    const mockMetrics = { overview: { totalUniqueMedications: 10 } };
    (dashboardService.getDashboardMetrics as jest.Mock).mockResolvedValue(mockMetrics);

    await getMetrics(mockRequest as Request, mockResponse as Response);

    expect(dashboardService.getDashboardMetrics).toHaveBeenCalledWith('month');
    expect(mockResponse.json).toHaveBeenCalledWith(mockMetrics);
  });

  test('GET /dashboard should use default week filter if none provided', async () => {
    mockRequest = {
      query: {}
    };

    const mockMetrics = { overview: { totalUniqueMedications: 5 } };
    (dashboardService.getDashboardMetrics as jest.Mock).mockResolvedValue(mockMetrics);

    await getMetrics(mockRequest as Request, mockResponse as Response);

    expect(dashboardService.getDashboardMetrics).toHaveBeenCalledWith('week');
    expect(mockResponse.json).toHaveBeenCalledWith(mockMetrics);
  });
});
