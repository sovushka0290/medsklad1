process.env.JWT_SECRET = 'test_jwt_secret_32_chars_min_length_ok';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret_32_chars_min_length';

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
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    procedureLog: {
      count: jest.fn(),
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
import * as dashboardService from '../src/services/dashboard.service';

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
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.procedureLog.count as jest.Mock).mockResolvedValue(0);
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
  });
});
