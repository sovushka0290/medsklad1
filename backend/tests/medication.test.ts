process.env.JWT_SECRET = 'test_jwt_secret_32_chars_min_length_ok';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret_32_chars_min_length';

jest.mock('../src/lib/prisma', () => ({
  prisma: {
    medication: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    }
  }
}));

import request from 'supertest';
import express from 'express';
import { prisma } from '../src/lib/prisma';
import medicationRoutes from '../src/routes/medication.routes';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

const app = express();
app.use(express.json());
app.use('/api', medicationRoutes);

describe('Medication Controller Tests', () => {
  const adminToken = jwt.sign({ id: 1, email: 'admin@medsklad.kz', role: 'ADMIN', name: 'Admin' }, config.jwtSecret);
  const nurseToken = jwt.sign({ id: 2, email: 'nurse@medsklad.kz', role: 'NURSE', name: 'Nurse' }, config.jwtSecret);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Should create a medication successfully with admin role', async () => {
    const mockMed = {
      id: 1,
      name: 'Аспирин',
      mnn: 'Acetylsalicylic acid',
      form: 'Таблетки',
      unit: 'уп',
      group: 'Анальгетики',
      minQuantity: 15,
      barcodes: ['1234567890'],
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, role: 'ADMIN' });
    (prisma.medication.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.medication.create as jest.Mock).mockResolvedValue(mockMed);

    const res = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Аспирин',
        mnn: 'Acetylsalicylic acid',
        form: 'Таблетки',
        unit: 'уп',
        group: 'Анальгетики',
        minQuantity: 15,
        barcodes: ['1234567890'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Аспирин');
  });

  test('Should return 409 if barcode already exists', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1, role: 'ADMIN' });
    (prisma.medication.findFirst as jest.Mock).mockResolvedValue({ id: 2, name: 'Анальгин' });

    const res = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Аспирин',
        barcodes: ['1234567890'],
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('Should return 403 if user is not ADMIN or STOREKEEPER', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 2, role: 'NURSE' });

    const res = await request(app)
      .post('/api/medications')
      .set('Authorization', `Bearer ${nurseToken}`)
      .send({
        name: 'Аспирин',
        barcodes: ['1234567890'],
      });

    expect(res.status).toBe(403);
  });
});
