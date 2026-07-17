import { prisma } from '../lib/prisma';
import { BadRequestError } from '../lib/errors';

// ─────────────────────────────────────────────────────────────────────────────
// Ф-19: Создание процедуры со справочником нормативного расхода
// ─────────────────────────────────────────────────────────────────────────────
export const createProcedure = async (data: {
  name: string;
  description?: string;
  standard?: string; // ГОСТ / СанПиН / Клинический протокол
  norms: { medicationId: number; expectedQuantity: number; tolerancePercent: number }[];
}) => {
  if (!data.name || data.name.trim().length === 0) {
    throw new BadRequestError('Название процедуры обязательно');
  }
  if (!data.norms || data.norms.length === 0) {
    throw new BadRequestError('Необходимо указать хотя бы один норматив');
  }

  for (const norm of data.norms) {
    if (!norm.medicationId || norm.medicationId <= 0) {
      throw new BadRequestError('Некорректный ID медикамента в нормативе');
    }
    if (!norm.expectedQuantity || norm.expectedQuantity <= 0) {
      throw new BadRequestError('Ожидаемое количество должно быть положительным');
    }
    if (norm.tolerancePercent < 0 || norm.tolerancePercent > 100) {
      throw new BadRequestError('Допустимое отклонение должно быть от 0 до 100%');
    }
  }

  return prisma.procedure.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim(),
      standard: data.standard?.trim() || null,
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

// ─────────────────────────────────────────────────────────────────────────────
// Ф-20: Учёт проведённых процедур — медсестра вносит кол-во манипуляций за смену
// ─────────────────────────────────────────────────────────────────────────────
export const logProcedure = async (data: {
  procedureId: number;
  locationId: number;
  userId: number;
  quantity?: number;
  note?: string;
}) => {
  if (!data.procedureId || data.procedureId <= 0) {
    throw new BadRequestError('Некорректный ID процедуры');
  }
  if (!data.locationId || data.locationId <= 0) {
    throw new BadRequestError('Некорректный ID локации');
  }
  const parsedQty = data.quantity ? parseInt(String(data.quantity), 10) : 1;
  const quantity = isNaN(parsedQty) || parsedQty <= 0 ? 1 : parsedQty;

  return prisma.$transaction(async (tx) => {
    const procedure = await tx.procedure.findUnique({
      where: { id: data.procedureId },
      include: { norms: { include: { medication: { select: { name: true } } } } }
    });

    if (!procedure) {
      throw new BadRequestError('Процедура не найдена');
    }

    // Предзагружаем все партии по нужным медикаментам
    const medicationIds = procedure.norms.map((n) => n.medicationId);
    const allBatches = await tx.batch.findMany({
      where: {
        medicationId: { in: medicationIds },
        locationId: data.locationId,
        quantity: { gt: 0 },
      },
      orderBy: { expirationDate: 'asc' },
    });

    // Ф-21: Автоматическое списание по нормативу с FEFO
    for (const norm of procedure.norms) {
      const batches = allBatches
        .filter((b) => b.medicationId === norm.medicationId)
        .sort((a, b) => {
          if (!a.expirationDate && !b.expirationDate) return 0;
          if (!a.expirationDate) return 1;
          if (!b.expirationDate) return -1;
          return a.expirationDate.getTime() - b.expirationDate.getTime();
        });

      // Суммарное списание = норматив × количество манипуляций
      let remainingToDeduct = Math.round(norm.expectedQuantity * quantity);
      let currentTotalStock = batches.reduce((sum, b) => sum + b.quantity, 0);

      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;

        const deductAmount = Math.min(batch.quantity, remainingToDeduct);
        const quantityBefore = currentTotalStock;
        const quantityAfter = quantityBefore - deductAmount;
        currentTotalStock = quantityAfter;

        await tx.transaction.create({
          data: {
            type: 'OUTFLOW',
            quantity: deductAmount,
            medicationId: norm.medicationId,
            locationId: data.locationId,
            userId: data.userId,
            reason: `Списание на процедуру: ${procedure.name}`,
            quantityBefore,
            quantityAfter,
          }
        });

        const newBatchQuantity = batch.quantity - deductAmount;
        if (newBatchQuantity === 0) {
          await tx.batch.delete({ where: { id: batch.id } });
        } else {
          await tx.batch.update({
            where: { id: batch.id },
            data: { quantity: newBatchQuantity }
          });
        }

        remainingToDeduct -= deductAmount;
      }

      if (remainingToDeduct > 0) {
        const medName = norm.medication?.name || `ID ${norm.medicationId}`;
        throw new BadRequestError(`Недостаточно медикамента "${medName}" для проведения ${quantity} манипуляций`);
      }
    }

    // Создаём одну запись журнала с quantity (вместо N отдельных записей)
    const log = await tx.procedureLog.create({
      data: {
        procedureId: data.procedureId,
        locationId: data.locationId,
        userId: data.userId,
        quantity,
        note: data.note?.trim() || null,
      },
      include: {
        procedure: { select: { id: true, name: true, standard: true } },
        location: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, role: true } },
      },
    });

    return log;
  }, {
    maxWait: 8000,
    timeout: 20000
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Ф-21, Ф-22: Сравнение нормативного и фактического расхода с % отклонения
// ─────────────────────────────────────────────────────────────────────────────
export const getProcedureComparison = async (params?: { from?: string; to?: string }) => {
  const dateFilter: Record<string, Date> = {};
  if (params?.from) dateFilter.gte = new Date(params.from);
  if (params?.to) {
    const to = new Date(params.to);
    to.setHours(23, 59, 59, 999);
    dateFilter.lte = to;
  }
  const hasDateFilter = Object.keys(dateFilter).length > 0;

  const procedures = await prisma.procedure.findMany({
    include: {
      norms: {
        include: { medication: { select: { id: true, name: true } } },
      },
      logs: {
        where: hasDateFilter ? { createdAt: dateFilter } : undefined,
        include: {
          location: { select: { id: true, name: true } }
        }
      },
    },
  });

  const procedureNames = procedures.map(p => `Списание на процедуру: ${p.name}`);
  const allTxs = await prisma.transaction.findMany({
    where: {
      type: 'OUTFLOW',
      reason: { in: procedureNames },
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    },
    select: { locationId: true, reason: true, medicationId: true, quantity: true }
  });

  const comparisons = [];
  for (const proc of procedures) {
    // Группируем логи по локации, суммируем quantity
    const locationGroups = proc.logs.reduce((acc, log) => {
      const locId = log.locationId;
      if (!acc[locId]) {
        acc[locId] = { locationName: log.location.name, totalManipulations: 0 };
      }
      acc[locId].totalManipulations += log.quantity;
      return acc;
    }, {} as Record<number, { locationName: string; totalManipulations: number }>);

    for (const locIdStr of Object.keys(locationGroups)) {
      const locId = Number(locIdStr);
      const group = locationGroups[locId];
      const totalManipulations = group.totalManipulations;

      const procTxs = allTxs.filter(
        tx => tx.locationId === locId && tx.reason === `Списание на процедуру: ${proc.name}`
      );

      const actualUsageByMed = procTxs.reduce((acc, tx) => {
        acc[tx.medicationId] = (acc[tx.medicationId] || 0) + tx.quantity;
        return acc;
      }, {} as Record<number, number>);

      const usage = proc.norms.map((norm) => {
        const expectedTotal = Math.round(norm.expectedQuantity * totalManipulations * 100) / 100;
        const minAllowed = Math.round(expectedTotal * (1 - norm.tolerancePercent / 100) * 100) / 100;
        const maxAllowed = Math.round(expectedTotal * (1 + norm.tolerancePercent / 100) * 100) / 100;
        const actualTotal = actualUsageByMed[norm.medicationId] || 0;
        const isViolation = expectedTotal > 0 && (actualTotal < minAllowed || actualTotal > maxAllowed);

        // Ф-22: абсолютное и процентное отклонение
        const deviationAbs = Math.round((actualTotal - expectedTotal) * 100) / 100;
        const deviationPct = expectedTotal > 0
          ? Math.round((deviationAbs / expectedTotal) * 10000) / 100
          : 0;

        return {
          medicationId: norm.medicationId,
          medicationName: norm.medication.name,
          normPerManipulation: norm.expectedQuantity,
          expectedTotal,
          actualTotal,
          deviationAbs,       // +/- в абсолютных единицах
          deviationPct,       // +/- в процентах
          isViolation,
          minAllowed,
          maxAllowed,
          tolerancePercent: norm.tolerancePercent,
        };
      });

      comparisons.push({
        locationId: locId,
        cabinetName: group.locationName,
        procedureId: proc.id,
        procedureName: proc.name,
        procedureStandard: proc.standard,
        timesPerformed: totalManipulations,
        usage,
      });
    }
  }

  return comparisons;
};

// ─────────────────────────────────────────────────────────────────────────────
// Ф-23, Ф-24: Журнал расхода по кабинетам — клиника→кабинет→сотрудник→МО
// ─────────────────────────────────────────────────────────────────────────────
export const getLogsJournal = async (params: {
  locationId?: number;
  procedureId?: number;
  userId?: number;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const dateFilter: Record<string, Date> = {};
  if (params.from) dateFilter.gte = new Date(params.from);
  if (params.to) {
    const to = new Date(params.to);
    to.setHours(23, 59, 59, 999);
    dateFilter.lte = to;
  }

  const where: any = {};
  if (params.locationId) where.locationId = params.locationId;
  if (params.procedureId) where.procedureId = params.procedureId;
  if (params.userId) where.userId = params.userId;
  if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;

  const [total, logs] = await Promise.all([
    prisma.procedureLog.count({ where }),
    prisma.procedureLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        procedure: {
          include: {
            norms: {
              include: {
                medication: {
                  select: { id: true, name: true, unit: true }
                }
              }
            }
          }
        },
        location: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, role: true } },
      },
    }),
  ]);

  return {
    data: logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};
