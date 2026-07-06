process.env.JWT_SECRET = 'test_jwt_secret_32_chars_min_length_ok';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret_32_chars_min_length';

jest.mock('../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    medication: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    inventorySession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    batch: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((callback) => callback({
      inventorySession: {
        create: jest.fn().mockResolvedValue({ id: 10 }),
        findUnique: jest.fn(),
      },
      batch: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryItem: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      }
    })),
  }
}));

import request from 'supertest';
import express from 'express';
import { prisma } from '../src/lib/prisma';
import medicationRoutes from '../src/routes/medication.routes';
import inventoryRoutes from '../src/routes/inventory.routes';
import userRoutes from '../src/routes/user.routes';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

const app = express();
app.use(express.json());
app.use('/api', medicationRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/users', userRoutes);

describe('RBAC Role Guard Tests', () => {
  const adminToken = jwt.sign({ id: 1, email: 'admin@medsklad.kz', role: 'ADMIN', name: 'Admin' }, config.jwtSecret);
  const nurseToken = jwt.sign({ id: 2, email: 'nurse@medsklad.kz', role: 'NURSE', name: 'Nurse' }, config.jwtSecret);
  const storekeeperToken = jwt.sign({ id: 3, email: 'store@medsklad.kz', role: 'STOREKEEPER', name: 'Store' }, config.jwtSecret);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/medications - allowed for ADMIN, forbidden for NURSE', async () => {
    // Admin request
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, role: 'ADMIN' });
    const resAdmin = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Аспирин', barcodes: ['123'] });
    expect(resAdmin.status).not.toBe(403);

    // Nurse request
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 2, role: 'NURSE' });
    const resNurse = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ name: 'Аспирин', barcodes: ['123'] });
    expect(resNurse.status).toBe(403);
  });

  test('POST /api/inventory/start - allowed for STOREKEEPER, forbidden for NURSE', async () => {
    // Storekeeper request
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 3, role: 'STOREKEEPER' });
    const resStore = await request(app)
      .post('/api/inventory/start')
      .set('Authorization', `Bearer ${storekeeperToken}`)
      .send({ locationId: 1 });
    expect(resStore.status).not.toBe(403);

    // Nurse request
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 2, role: 'NURSE' });
    const resNurse = await request(app)
      .post('/api/inventory/start')
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({ locationId: 1 });
    expect(resNurse.status).toBe(403);
  });

  test('GET /api/users/audit-logs - allowed for ADMIN, forbidden for STOREKEEPER', async () => {
    // Admin request
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, role: 'ADMIN' });
    const resAdmin = await request(app)
      .get('/api/users/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resAdmin.status).not.toBe(403);

    // Storekeeper request
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 3, role: 'STOREKEEPER' });
    const resStore = await request(app)
      .get('/api/users/audit-logs')
      .set('Authorization', `Bearer ${storekeeperToken}`);
    expect(resStore.status).toBe(403);
  });
});
