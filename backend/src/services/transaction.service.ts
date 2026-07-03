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
      let quantityBefore = 0;
      let quantityAfter = 0;

      if (type === TransactionType.INCOME) {
        // Приход ищет партию с таким же сроком годности, либо любую (в MVP упрощаем до первой)
        const batch = await tx.batch.findFirst({
          where: { medicationId, locationId },
          orderBy: { expirationDate: 'asc' } // FEFO сортировка
        });

        quantityBefore = batch ? batch.quantity : 0;
        quantityAfter = quantityBefore + quantity;

        if (batch) {
          await tx.batch.update({
            where: { id: batch.id },
            data: { quantity: quantityAfter },
          });
        } else {
          await tx.batch.create({
            data: { medicationId, locationId, quantity },
          });
        }
      } else if (type === TransactionType.OUTFLOW || type === TransactionType.WRITE_OFF) {
        // Списание строго по FEFO (сначала старые партии)
        const batch = await tx.batch.findFirst({
          where: { medicationId, locationId, quantity: { gt: 0 } },
          orderBy: { expirationDate: 'asc' }
        });

        if (!batch || batch.quantity < quantity) {
          throw new Error(
            `Недостаточно товара на складе (в наличии: ${batch ? batch.quantity : 0})`
          );
        }

        quantityBefore = batch.quantity;
        quantityAfter = quantityBefore - quantity;

        if (quantityAfter === 0) {
          // Если остаток 0 - удаляем партию
          await tx.batch.delete({ where: { id: batch.id } });
        } else {
          await tx.batch.update({
            where: { id: batch.id },
            data: { quantity: quantityAfter },
          });
        }
      } else if (type === TransactionType.RETURN) {
         // Возврат (пока работает как приход)
         const batch = await tx.batch.findFirst({
          where: { medicationId, locationId },
          orderBy: { expirationDate: 'asc' }
        });

        quantityBefore = batch ? batch.quantity : 0;
        quantityAfter = quantityBefore + quantity;

        if (batch) {
          await tx.batch.update({
            where: { id: batch.id },
            data: { quantity: quantityAfter },
          });
        } else {
          await tx.batch.create({
            data: { medicationId, locationId, quantity },
          });
        }
      } else {
        throw new Error('Неизвестный тип транзакции');
      }

      // Создаем запись транзакции
      return tx.transaction.create({
        data: { type, quantity, medicationId, locationId, userId, reason, quantityBefore, quantityAfter },
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
