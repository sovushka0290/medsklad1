process.env.JWT_SECRET = 'test_jwt_secret_32_chars_min_length_ok';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret_32_chars_min_length';

jest.mock('../src/lib/prisma', () => ({
  prisma: {
    inventorySession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    inventoryItem: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    batch: {
      findMany: jest.fn(),
    },
    medication: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
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
import inventoryRoutes from '../src/routes/inventory.routes';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

const app = express();
app.use(express.json());
app.use('/api/inventory', inventoryRoutes);

describe('Inventory Controller Tests', () => {
  const adminToken = jwt.sign({ id: 1, email: 'admin@medsklad.kz', role: 'ADMIN', name: 'Admin' }, config.jwtSecret);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Should start session successfully', async () => {
    const mockSession = { id: 1, locationId: 2, userId: 1, status: 'ACTIVE', items: [] };
    
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const mockTx = {
        inventorySession: {
          create: jest.fn().mockResolvedValue(mockSession),
          findUnique: jest.fn().mockResolvedValue(mockSession),
        },
        batch: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        inventoryItem: {
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        }
      };
      return callback(mockTx);
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, role: 'ADMIN' });

    const res = await request(app)
      .post('/api/inventory/start')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ locationId: 2 });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
  });

  test('Should close session successfully', async () => {
    const mockSession = { id: 1, status: 'COMPLETED', completedAt: new Date() };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, role: 'ADMIN' });
    (prisma.inventorySession.update as jest.Mock).mockResolvedValue(mockSession);

    const res = await request(app)
      .post('/api/inventory/1/close')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  test('Should get completed sessions history', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, role: 'ADMIN' });
    (prisma.inventorySession.findMany as jest.Mock).mockResolvedValue([{ id: 1, status: 'COMPLETED' }]);

    const res = await request(app)
      .get('/api/inventory/history')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].status).toBe('COMPLETED');
  });

  test('Should adjust item quantity successfully', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, role: 'ADMIN' });
    (prisma.medication.findFirst as jest.Mock).mockResolvedValue({ id: 5, name: 'Аспирин' });
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({ id: 10, sessionId: 1, medicationId: 5, expectedQuantity: 10, actualQuantity: 8 });
    (prisma.inventoryItem.update as jest.Mock).mockResolvedValue({ id: 10, actualQuantity: 9, difference: -1 });

    const res = await request(app)
      .put('/api/inventory/1/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ barcode: '123', quantityAdjustment: 1 });

    expect(res.status).toBe(200);
    expect(res.body.actualQuantity).toBe(9);
  });
});
