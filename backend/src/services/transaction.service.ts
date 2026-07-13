import { prisma } from '../lib/prisma';
import { TransactionType } from '@prisma/client';
import { BadRequestError } from '../lib/errors';

export interface CreateTransactionInput {
  type: TransactionType;
  quantity: number;
  medicationId: number;
  locationId: number;
  userId?: number;
  reason?: string;
  expirationDate?: string;
  serialNumber?: string;
  supplier?: string;
  price?: number;
  allowOverdraft?: boolean;
}

export const transactionService = {
  async createTransaction(input: CreateTransactionInput) {
    const { type, quantity, medicationId, locationId, userId, reason, expirationDate, serialNumber, supplier, price, allowOverdraft } = input;

    if (quantity <= 0) {
      throw new BadRequestError('Количество должно быть больше нуля');
    }

    // Проверяем существование медикамента и локации параллельно
    const [medication, location] = await Promise.all([
      prisma.medication.findUnique({ where: { id: medicationId } }),
      prisma.location.findUnique({ where: { id: locationId } }),
    ]);

    if (!medication) {
      throw new BadRequestError('Медикамент не найден');
    }
    if (!location) {
      throw new BadRequestError('Локация не найдена');
    }

    // Выполняем в рамках транзакции базы данных для атомарности
    return prisma.$transaction(async (tx) => {
      let quantityBefore = 0;
      let quantityAfter = 0;

      // Считаем общий остаток до операции (сумма всех партий)
      const allBatches = await tx.batch.findMany({
        where: { medicationId, locationId },
        orderBy: { expirationDate: 'asc' }
      });
      quantityBefore = allBatches.reduce((sum, b) => sum + b.quantity, 0);

      if (type === TransactionType.INCOME || type === TransactionType.RETURN) {
        quantityAfter = quantityBefore + quantity;
        
        // Пытаемся найти партию с точно такими же параметрами (включая срок годности)
        const expDate = expirationDate ? new Date(expirationDate) : null;
        const matchingBatch = allBatches.find(b => 
          (b.expirationDate?.getTime() === expDate?.getTime()) &&
          (b.price === price)
        );

        if (matchingBatch) {
          await tx.batch.update({
            where: { id: matchingBatch.id },
            data: { quantity: matchingBatch.quantity + quantity },
          });
        } else {
          await tx.batch.create({
            data: { 
              medicationId, 
              locationId, 
              quantity,
              expirationDate: expDate,
              serialNumber,
              supplier,
              price
            },
          });
        }
      } else if (type === TransactionType.OUTFLOW || type === TransactionType.WRITE_OFF) {
        if (type === TransactionType.WRITE_OFF && !reason) {
          throw new BadRequestError('Укажите причину списания');
        }
        if (quantityBefore < quantity && !allowOverdraft) {
          throw new BadRequestError(`Недостаточно товара на складе (в наличии: ${quantityBefore})`);
        }
        
        quantityAfter = quantityBefore - quantity;
        let remainingToDeduct = quantity;

        const sortedBatches = [...allBatches].sort((a, b) => {
          if (!a.expirationDate && !b.expirationDate) return 0;
          if (!a.expirationDate) return 1;
          if (!b.expirationDate) return -1;
          return a.expirationDate.getTime() - b.expirationDate.getTime();
        });

        if (sortedBatches.length > 0) {
          for (let i = 0; i < sortedBatches.length; i++) {
            const batch = sortedBatches[i];
            const isLast = i === sortedBatches.length - 1;

            if (remainingToDeduct <= 0) break;

            if (isLast && remainingToDeduct > batch.quantity && allowOverdraft) {
              // Последняя партия уходит в минус
              await tx.batch.update({
                where: { id: batch.id },
                data: { quantity: batch.quantity - remainingToDeduct },
              });
              remainingToDeduct = 0;
            } else {
              const deductAmount = Math.min(batch.quantity, remainingToDeduct);
              const newBatchQuantity = batch.quantity - deductAmount;

              if (newBatchQuantity === 0) {
                await tx.batch.delete({ where: { id: batch.id } });
              } else {
                await tx.batch.update({
                  where: { id: batch.id },
                  data: { quantity: newBatchQuantity },
                });
              }
              remainingToDeduct -= deductAmount;
            }
          }
        } else if (allowOverdraft) {
          // Если партий вообще нет, создаем новую партию с отрицательным количеством
          await tx.batch.create({
            data: {
              medicationId,
              locationId,
              quantity: -remainingToDeduct,
              supplier: 'Авто-Овердрафт (Оффлайн)',
            }
          });
          remainingToDeduct = 0;
        }
      } else {
        throw new BadRequestError('Неизвестный тип транзакции');
      }

      // Создаем запись транзакции
      const txRecord = await tx.transaction.create({
        data: { type, quantity, medicationId, locationId, userId, reason, quantityBefore, quantityAfter },
        include: {
          medication: { select: { id: true, name: true, barcodes: true, minQuantity: true } },
          location: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, role: true } }, // Без password!
        },
      });

      // ПУШ-УВЕДОМЛЕНИЕ И EMAIL: Если остаток стал <= minQuantity
      const minQty = txRecord.medication.minQuantity;
      if (quantityAfter <= minQty && quantityBefore > minQty) {
        setImmediate(async () => {
          try {
            const { prisma: prismaClient } = require('../lib/prisma');
            const { sendPushNotification } = require('./push.service');
            const { emailService } = require('./email.service');
            
            const admins = await prismaClient.user.findMany({
              where: {
                role: { in: ['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER'] },
                isActive: true
              },
              select: {
                pushToken: true,
                email: true,
                role: true,
              }
            });
            
            // Push Notification
            const tokens = admins.map((u: any) => u.pushToken).filter(Boolean);
            if (tokens.length > 0) {
              await sendPushNotification(
                tokens,
                '⚠️ Критический остаток',
                `Препарат "${txRecord.medication.name}" заканчивается. Осталось: ${quantityAfter} шт. в локации "${txRecord.location.name}".`
              );
            }

            // Email Notification to Storekeepers, Head Nurses and Admins
            const recipients = admins.filter((u: any) => ['STOREKEEPER', 'HEAD_NURSE', 'ADMIN'].includes(u.role) && u.email);
            for (const recipient of recipients) {
              await emailService.sendCriticalStockAlert(txRecord.medication.name, quantityAfter, minQty, recipient.email);
            }

          } catch (err) {
            console.error('Failed to send low stock alerts:', err);
          }
        });
      }

      return txRecord;
    });
  },

  async getTransactionHistory(page = 1, limit = 50) {
    const take = Math.min(limit, 100); // Максимум 100 за запрос
    const skip = (page - 1) * take;

    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          medication: { select: { id: true, name: true, barcodes: true, minQuantity: true } },
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
