import { prisma } from '../lib/prisma';

export const createProcedure = async (data: {
  name: string;
  description?: string;
  norms: { medicationId: number; expectedQuantity: number; tolerancePercent: number }[];
}) => {
  if (!data.name || data.name.trim().length === 0) {
    throw new Error('Название процедуры обязательно');
  }
  if (!data.norms || data.norms.length === 0) {
    throw new Error('Необходимо указать хотя бы один норматив');
  }

  // Валидация нормативов
  for (const norm of data.norms) {
    if (!norm.medicationId || norm.medicationId <= 0) {
      throw new Error('Некорректный ID медикамента в нормативе');
    }
    if (!norm.expectedQuantity || norm.expectedQuantity <= 0) {
      throw new Error('Ожидаемое количество должно быть положительным');
    }
    if (norm.tolerancePercent < 0 || norm.tolerancePercent > 100) {
      throw new Error('Допустимое отклонение должно быть от 0 до 100%');
    }
  }

  return prisma.procedure.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim(),
      norms: {
        create: data.norms.map((norm) => ({
          medicationId: norm.medicationId,
          expectedQuantity: norm.expectedQuantity,
          tolerancePercent: norm.tolerancePercent,
        })),
      },
    },
    include: { norms: { include: { medication: { select: { id: true, name: true } } } } },
  });
};

export const getAllProcedures = async () => {
  return prisma.procedure.findMany({
    include: {
      norms: {
        include: { medication: { select: { id: true, name: true, minQuantity: true } } }
      }
    },
    orderBy: { name: 'asc' },
  });
};

export const logProcedure = async (data: {
  procedureId: number;
  locationId: number;
  userId: number;
}) => {
  if (!data.procedureId || data.procedureId <= 0) {
    throw new Error('Некорректный ID процедуры');
  }
  if (!data.locationId || data.locationId <= 0) {
    throw new Error('Некорректный ID локации');
  }

  return prisma.$transaction(async (tx) => {
    // Проверяем что процедура существует
    const procedure = await tx.procedure.findUnique({ 
      where: { id: data.procedureId },
      include: { norms: true }
    });
    
    if (!procedure) {
      throw new Error('Процедура не найдена');
    }

    // Списываем медикаменты со склада согласно нормам
    for (const norm of procedure.norms) {
      // Ищем партии списанием по FEFO
      const batches = await tx.batch.findMany({
        where: { medicationId: norm.medicationId, locationId: data.locationId, quantity: { gt: 0 } },
        orderBy: { expirationDate: 'asc' }
      });

      let remainingToDeduct = norm.expectedQuantity;
      
      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;

        const deductAmount = Math.min(batch.quantity, remainingToDeduct);
        const quantityBefore = batch.quantity;
        const quantityAfter = quantityBefore - deductAmount;

        // Создаем транзакцию списания
        await tx.transaction.create({
          data: {
            type: 'OUTFLOW',
            quantity: deductAmount,
            medicationId: norm.medicationId,
            locationId: data.locationId,
            userId: data.userId,
            reason: `Списание на процедуру: ${procedure.name}`,
            quantityBefore,
            quantityAfter
          }
        });

        if (quantityAfter === 0) {
          await tx.batch.delete({ where: { id: batch.id } });
        } else {
          await tx.batch.update({
            where: { id: batch.id },
            data: { quantity: quantityAfter }
          });
        }

        remainingToDeduct -= deductAmount;
      }

      if (remainingToDeduct > 0) {
        throw new Error(`Недостаточно медикамента (ID: ${norm.medicationId}) для проведения процедуры`);
      }
    }

    // Логируем саму процедуру
    return tx.procedureLog.create({
      data: {
        procedureId: data.procedureId,
        locationId: data.locationId,
        userId: data.userId,
      },
      include: {
        procedure: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, role: true } },
      },
    });
  });
};

export const getProcedureComparison = async () => {
  const procedures = await prisma.procedure.findMany({
    include: {
      norms: {
        include: { medication: { select: { id: true, name: true } } },
      },
      logs: true,
    },
  });

  return procedures.map((proc) => {
    const logsCount = proc.logs.length;
    const expected = proc.norms.map((norm) => {
      const expectedTotal = norm.expectedQuantity * logsCount;
      const minAllowed = expectedTotal * (1 - norm.tolerancePercent / 100);
      const maxAllowed = expectedTotal * (1 + norm.tolerancePercent / 100);

      return {
        medicationId: norm.medicationId,
        medicationName: norm.medication.name,
        expectedTotal: Math.round(expectedTotal * 100) / 100,
        minAllowed: Math.round(minAllowed * 100) / 100,
        maxAllowed: Math.round(maxAllowed * 100) / 100,
        tolerancePercent: norm.tolerancePercent,
      };
    });

    return {
      procedureId: proc.id,
      procedureName: proc.name,
      timesPerformed: logsCount,
      expectedUsage: expected,
    };
  });
};
