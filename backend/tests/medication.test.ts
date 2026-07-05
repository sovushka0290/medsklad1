process.env.JWT_SECRET = 'test_jwt_secret_32_chars_min_length_ok';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret_32_chars_min_length';

import { Request, Response } from 'express';
import { create } from '../src/controllers/medication.controller';

jest.mock('../src/lib/prisma', () => ({
  prisma: {
    medication: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    }
  }
}));

import { prisma } from '../src/lib/prisma';

describe('Medication Controller Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test('POST /medications should create a new medication', async () => {
    mockRequest = {
      body: {
        name: 'Парацетамол',
        unit: 'PILL',
        minQuantity: 100,
        barcodes: ['1234567890'],
      }
    };

    const newMedication = {
      id: 1,
      ...mockRequest.body,
      isCritical: false,
    };

    (prisma.medication.findFirst as jest.Mock).mockResolvedValue(null); // No existing med with same name
    (prisma.medication.create as jest.Mock).mockResolvedValue(newMedication);

    await create(mockRequest as Request, mockResponse as Response);

    expect(prisma.medication.findFirst).toHaveBeenCalledWith({
      where: { name: 'Парацетамол' }
    });
    expect(prisma.medication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Парацетамол' })
    });
    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.json).toHaveBeenCalledWith(newMedication);
  });
});
