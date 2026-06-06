import { PrismaClient, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateTransactionInput {
  type: TransactionType;
  quantity: number;
  medicationId: number;
  locationId: number;
}

export const transactionService = {
  async createTransaction(input: CreateTransactionInput) {
    const { type, quantity, medicationId, locationId } = input;

    if (quantity <= 0) {
      throw new Error('Количество должно быть больше нуля');
    }

    // Проверяем существование медикамента и локации
    const medication = await prisma.medication.findUnique({
      where: { id: medicationId },
    });
    if (!medication) {
      throw new Error('Медикамент не найден');
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });
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
          // Обновляем существующую партию
          await tx.batch.update({
            where: { id: batch.id },
            data: { quantity: batch.quantity + quantity },
          });
        } else {
          // Создаем новую партию
          await tx.batch.create({
            data: {
              medicationId,
              locationId,
              quantity,
            },
          });
        }
      } else if (type === TransactionType.OUTFLOW) {
        if (!batch || batch.quantity < quantity) {
          throw new Error(`Недостаточно товара на складе (в наличии: ${batch ? batch.quantity : 0})`);
        }

        // Обновляем партию, вычитая количество
        await tx.batch.update({
          where: { id: batch.id },
          data: { quantity: batch.quantity - quantity },
        });
      } else {
        throw new Error('Неизвестный тип транзакции');
      }

      // Создаем запись транзакции в аудите
      return tx.transaction.create({
        data: {
          type,
          quantity,
          medicationId,
          locationId,
        },
        include: {
          medication: true,
          location: true,
        },
      });
    });
  },

  async getTransactionHistory() {
    return prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        medication: true,
        location: true,
      },
    });
  },
};
