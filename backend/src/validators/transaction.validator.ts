import { z } from 'zod';

export const createTransactionSchema = z.object({
  body: z.object({
    type: z.enum(['INCOME', 'OUTFLOW', 'RETURN', 'WRITE_OFF']),
    quantity: z.number().int().positive('Количество должно быть положительным числом'),
    medicationId: z.number().int().positive(),
    locationId: z.number().int().positive(),
    userId: z.number().int().positive().optional(),
    reason: z.string().max(255).optional(),
    expirationDate: z.string().datetime().optional(), // ISO string
    serialNumber: z.string().max(100).optional(),
    price: z.number().positive().optional(),
  }),
});
