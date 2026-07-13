process.env.JWT_SECRET = 'test_jwt_secret_32_chars_min_length_ok';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret_32_chars_min_length';

import { transactionService } from '../src/services/transaction.service';
import { prisma } from '../src/lib/prisma';
import { TransactionType } from '@prisma/client';

jest.mock('../src/lib/prisma', () => {
  const mockTx = {
    batch: {
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
    }
  };
  return {
    prisma: {
      medication: {
        findUnique: jest.fn(),
      },
      location: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockTx)),
    },
  };
});

describe('FEFO Stock Deduction Logic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Should deduct from the batch with the earliest expiration date first (FEFO)', async () => {
    const mockMedication = { id: 1, name: 'Тестовый препарат', minQuantity: 5 };
    const mockLocation = { id: 2, name: 'Главный Склад' };

    const batch1ExpiredSoon = { id: 101, quantity: 10, expirationDate: new Date('2026-08-01'), price: 100 };
    const batch2ExpiredLater = { id: 102, quantity: 15, expirationDate: new Date('2026-12-01'), price: 100 };
    const batch3NoExpiration = { id: 103, quantity: 20, expirationDate: null, price: 100 };

    (prisma.medication.findUnique as jest.Mock).mockResolvedValue(mockMedication);
    (prisma.location.findUnique as jest.Mock).mockResolvedValue(mockLocation);

    // Mocking transaction operations inside prisma.$transaction callback
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const mockTx = {
        batch: {
          findMany: jest.fn().mockResolvedValue([batch3NoExpiration, batch2ExpiredLater, batch1ExpiredSoon]), // randomized order from DB
          update: jest.fn().mockResolvedValue({}),
          delete: jest.fn().mockResolvedValue({}),
        },
        transaction: {
          create: jest.fn().mockResolvedValue({
            medication: { name: 'Тестовый препарат', minQuantity: 5 },
            location: { name: 'Главный Склад' },
            user: { name: 'Admin', role: 'ADMIN' },
          }),
        },
        user: {
          findMany: jest.fn().mockResolvedValue([]),
        }
      };

      await callback(mockTx);

      // Verify FEFO order: batch 101 (2026-08-01) should be updated/deleted first, then batch 102 (2026-12-01), then batch 103 (null)
      // We deduct 12 units. 10 units must be deducted from batch 101 (fully reducing it to 0), and 2 units from batch 102.
      expect(mockTx.batch.delete).toHaveBeenCalledWith({ where: { id: 101 } });
      expect(mockTx.batch.update).toHaveBeenCalledWith({
        where: { id: 102 },
        data: { quantity: 13 },
      });
      // Batch 103 (no expiration date) should not be touched
      expect(mockTx.batch.update).not.toHaveBeenCalledWith({
        where: { id: 103 },
        data: expect.any(Object),
      });
    });

    await transactionService.createTransaction({
      type: TransactionType.OUTFLOW,
      quantity: 12,
      medicationId: 1,
      locationId: 2,
      userId: 1,
    });
  });

  test('Should allow overdraft and reduce batch into negative balance if allowOverdraft option is set', async () => {
    const mockMedication = { id: 1, name: 'Тестовый препарат', minQuantity: 5 };
    const mockLocation = { id: 2, name: 'Главный Склад' };

    const batch1 = { id: 101, quantity: 5, expirationDate: new Date('2026-08-01'), price: 100 };

    (prisma.medication.findUnique as jest.Mock).mockResolvedValue(mockMedication);
    (prisma.location.findUnique as jest.Mock).mockResolvedValue(mockLocation);

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const mockTx = {
        batch: {
          findMany: jest.fn().mockResolvedValue([batch1]),
          update: jest.fn().mockResolvedValue({}),
          delete: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue({}),
        },
        transaction: {
          create: jest.fn().mockResolvedValue({
            medication: { name: 'Тестовый препарат', minQuantity: 5 },
            location: { name: 'Главный Склад' },
            user: { name: 'Admin', role: 'ADMIN' },
          }),
        },
        user: {
          findMany: jest.fn().mockResolvedValue([]),
        }
      };

      await callback(mockTx);

      // We deduct 12 units from a batch of 5. The batch should be updated into negative balance (-7).
      expect(mockTx.batch.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: { quantity: -7 },
      });
      expect(mockTx.batch.delete).not.toHaveBeenCalled();
    });

    await transactionService.createTransaction({
      type: TransactionType.OUTFLOW,
      quantity: 12,
      medicationId: 1,
      locationId: 2,
      userId: 1,
      allowOverdraft: true,
    });
  });
});
