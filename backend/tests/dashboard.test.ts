process.env.JWT_SECRET = 'test_jwt_secret_32_chars_min_length_ok';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret_32_chars_min_length';

<<<<<<< HEAD
jest.mock('../src/lib/prisma', () => ({
  prisma: {
    batch: {
      aggregate: jest.fn(),
    },
    medication: {
      findMany: jest.fn(),
    },
    transaction: {
      groupBy: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
  }
}));

import request from 'supertest';
import express from 'express';
import { prisma } from '../src/lib/prisma';
import dashboardRoutes from '../src/routes/dashboard.routes';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

const app = express();
app.use(express.json());
app.use('/api/dashboard', dashboardRoutes);

describe('Dashboard Controller Tests', () => {
  const adminToken = jwt.sign({ id: 1, email: 'admin@medsklad.kz', role: 'ADMIN', name: 'Admin' }, config.jwtSecret);

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, role: 'ADMIN' });
    (prisma.batch.aggregate as jest.Mock).mockResolvedValue({ _sum: { quantity: 100 } });
    (prisma.medication.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.transaction.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
  });

  test('Should get dashboard metrics with filter today', async () => {
    (prisma.batch.aggregate as jest.Mock).mockResolvedValue({ _sum: { quantity: 150 } });

    const res = await request(app)
      .get('/api/dashboard/metrics?filter=today')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.overview.totalItemsInStock).toBe(150);
  });

  test('Should get dashboard metrics with filter week', async () => {
    const res = await request(app)
      .get('/api/dashboard/metrics?filter=week')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.overview.totalItemsInStock).toBe(100);
  });

  test('Should get dashboard metrics with custom dates', async () => {
    const res = await request(app)
      .get('/api/dashboard/metrics?startDate=2026-07-01&endDate=2026-07-06')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
=======
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
>>>>>>> c3ab6ea257cdd60b4926c44388ac86496362e606
  });
});
