import { prisma } from '../lib/prisma';
import { TransactionType } from '@prisma/client';

export interface CreateTransactionInput {
  type: TransactionType;
  quantity: number;
  medicationId: number;
  locationId: number;
  userId?: number;
  reason?: string;
}

export const transactionService = {
  async createTransaction(input: CreateTransactionInput) {
    const { type, quantity, medicationId, locationId, userId, reason } = input;

    if (quantity <= 0) {
      throw new Error('Количество должно быть больше нуля');
    }

    // Проверяем существование медикамента и локации параллельно
    const [medication, location] = await Promise.all([
      prisma.medication.findUnique({ where: { id: medicationId } }),
      prisma.location.findUnique({ where: { id: locationId } }),
    ]);

    if (!medication) {
      throw new Error('Медикамент не найден');
    }
    if (!location) {
      throw new Error('Локация не найдена');
    }

    // Выполняем в рамках транзакции базы данных для атомарности
    return prisma.$transaction(async (tx) => {
      // Ищем партию на складе
      const batch = await tx.batch.findFirst({
        where: { medicationId, locationId },
      });

      if (type === TransactionType.INCOME) {
        if (batch) {
          await tx.batch.update({
            where: { id: batch.id },
            data: { quantity: batch.quantity + quantity },
          });
        } else {
          await tx.batch.create({
            data: { medicationId, locationId, quantity },
          });
        }
      } else if (type === TransactionType.OUTFLOW) {
        if (!batch || batch.quantity < quantity) {
          throw new Error(
            `Недостаточно товара на складе (в наличии: ${batch ? batch.quantity : 0})`
          );
        }
        await tx.batch.update({
          where: { id: batch.id },
          data: { quantity: batch.quantity - quantity },
        });
      } else {
        throw new Error('Неизвестный тип транзакции');
      }

      // Создаем запись транзакции
      return tx.transaction.create({
        data: { type, quantity, medicationId, locationId, userId, reason },
        include: {
          medication: { select: { id: true, name: true, barcode: true } },
          location: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, role: true } }, // Без password!
        },
      });
    });
  },

  async getTransactionHistory(page = 1, limit = 50) {
    const take = Math.min(limit, 100); // Максимум 100 за запрос
    const skip = (page - 1) * take;

    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          medication: { select: { id: true, name: true, barcode: true } },
          location: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, role: true } }, // Без password!
        },
        skip,
        take,
      }),
      prisma.transaction.count(),
    ]);

    return {
      data,
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  },
};
