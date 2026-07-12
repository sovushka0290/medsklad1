import { prisma } from '../lib/prisma';
import NodeCache from 'node-cache';

const dashboardCache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache

export const getDashboardMetrics = async (
  filter?: string,
  startDate?: string,
  endDate?: string,
  user?: { id: number; role: string }
) => {
  const cacheKey = `dashboard_metrics_${user?.role || ''}_${user?.id || ''}_${filter || 'week'}_${startDate || ''}_${endDate || ''}`;
  const cached = dashboardCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (user?.role === 'NURSE') {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const procedureLogsCount = await prisma.procedureLog.count({
      where: {
        userId: user.id,
        createdAt: { gte: todayStart }
      }
    });

    const allMeds = await prisma.medication.findMany({
      select: {
        id: true,
        minQuantity: true,
        batches: {
          select: { quantity: true, expirationDate: true }
        }
      }
    });

    let criticalCount = 0;
    let expiringCount = 0;
    const nowTime = new Date();
    const threshold30 = new Date();
    threshold30.setDate(threshold30.getDate() + 30);

    for (const med of allMeds) {
      let medStock = 0;
      let isExpiringSoon = false;
      for (const batch of med.batches) {
        medStock += batch.quantity;
        if (batch.quantity > 0 && batch.expirationDate) {
          const daysLeft = Math.ceil((batch.expirationDate.getTime() - nowTime.getTime()) / (1000 * 60 * 60 * 24));
          if (daysLeft >= 0 && daysLeft <= 30) {
            isExpiringSoon = true;
            expiringCount++;
          }
          if (daysLeft < 0) {
            isExpiringSoon = true;
          }
        }
      }
      if (medStock <= med.minQuantity || isExpiringSoon) {
        criticalCount++;
      }
    }

    const result = {
      overview: {
        proceduresLoggedToday: procedureLogsCount,
        criticalItemsCount: criticalCount,
        expiringItemsCount: expiringCount,
        totalItemsInStock: 0,
        totalInventoryValue: 0,
        totalUniqueMedications: 0
      },
      criticalItems: [],
      expiringItems: [],
      top10Consumed: [],
      consumptionTrend: []
    };

    dashboardCache.set(cacheKey, result);
    return result;
  }

  // Вычисляем диапазон дат
  const now = new Date();
  let dateFrom: Date;
  let dateTo: Date = now;

  if (startDate && endDate) {
    dateFrom = new Date(startDate);
    dateTo = new Date(endDate);
    dateTo.setHours(23, 59, 59, 999);
  } else {
    switch (filter) {
      case 'today':
        dateFrom = new Date(now);
        dateFrom.setHours(0, 0, 0, 0);
        break;
      case 'month':
        dateFrom = new Date(now);
        dateFrom.setDate(now.getDate() - 30);
        break;
      case 'week':
      default:
        dateFrom = new Date(now);
        dateFrom.setDate(now.getDate() - 7);
        break;
    }
  }

  // Параллельные запросы для скорости
  const [batchAgg, allBatches, outflows, rawTrendTx] = await Promise.all([
    // 1. Агрегация общих показателей
    prisma.batch.aggregate({
      _sum: { quantity: true },
    }),

    // 2. Для критических остатков нужны данные по каждому медикаменту
    prisma.medication.findMany({
      select: {
        id: true,
        name: true,
        minQuantity: true,
        batches: {
          select: { quantity: true, price: true, expirationDate: true },
        },
      },
    }),

    // 3. ТОП-10 расходуемых за период
    prisma.transaction.groupBy({
      by: ['medicationId'],
      where: { type: 'OUTFLOW', createdAt: { gte: dateFrom, lte: dateTo } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),

    // 4. Динамика расхода за период — через findMany + JS группировка (нет raw SQL)
    prisma.transaction.findMany({
      where: {
        type: { in: ['OUTFLOW', 'WRITE_OFF'] },
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: { createdAt: true, quantity: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Подсчёт по медикаментам
  let totalValue = 0;
  const criticalItems: { name: string; quantity: number; minQuantity: number; isExpiringSoon: boolean }[] = [];

  // Пороги истечения: 30, 60, 90 дней
  const threshold30 = new Date();
  threshold30.setDate(threshold30.getDate() + 30);
  const threshold60 = new Date();
  threshold60.setDate(threshold60.getDate() + 60);
  const threshold90 = new Date();
  threshold90.setDate(threshold90.getDate() + 90);

  const expiringItems: {
    name: string;
    quantity: number;
    expirationDate: string;
    daysLeft: number;
    bucket: '30' | '60' | '90';
  }[] = [];

  for (const med of allBatches) {
    let medStock = 0;
    let isExpiringSoon = false;
    for (const batch of med.batches) {
      medStock += batch.quantity;
      totalValue += batch.quantity * (batch.price || 0);

      if (batch.quantity > 0 && batch.expirationDate) {
        const expDate = batch.expirationDate;
        const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Включаем только будущие (не просроченные)
        if (daysLeft >= 0 && expDate <= threshold90) {
          isExpiringSoon = expDate <= threshold30;
          const bucket = expDate <= threshold30 ? '30' : expDate <= threshold60 ? '60' : '90';
          expiringItems.push({
            name: med.name,
            quantity: batch.quantity,
            expirationDate: expDate.toISOString(),
            daysLeft,
            bucket,
          });
        }
        // Помечаем просроченные тоже (daysLeft < 0) как критические
        if (daysLeft < 0) {
          isExpiringSoon = true;
        }
      }
    }
    if (medStock <= med.minQuantity || isExpiringSoon) {
      criticalItems.push({
        name: med.name,
        quantity: medStock,
        minQuantity: med.minQuantity,
        isExpiringSoon
      });
    }
  }

  // Сортируем: сначала ближе к истечению
  expiringItems.sort((a, b) => a.daysLeft - b.daysLeft);

  // Получаем имена для ТОП-10
  const top10Ids = outflows.map((o) => o.medicationId);
  const top10Medications = top10Ids.length > 0
    ? await prisma.medication.findMany({
        where: { id: { in: top10Ids } },
        select: { id: true, name: true },
      })
    : [];

  const top10Consumed = outflows.map((outflow) => {
    const med = top10Medications.find((m) => m.id === outflow.medicationId);
    return {
      medicationName: med?.name || 'Неизвестный',
      totalConsumed: outflow._sum.quantity || 0,
    };
  });

  // Группируем динамику расхода по датам через JS (без raw SQL)
  const trendByDate = new Map<string, number>();
  for (const tx of rawTrendTx) {
    const dateKey = tx.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
    trendByDate.set(dateKey, (trendByDate.get(dateKey) || 0) + tx.quantity);
  }
  const consumptionTrend = Array.from(trendByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

  const result = {
    overview: {
      totalItemsInStock: batchAgg._sum.quantity || 0,
      totalInventoryValue: Math.round(totalValue * 100) / 100,
      totalUniqueMedications: allBatches.length,
      criticalItemsCount: criticalItems.length,
      expiringItemsCount: expiringItems.filter(e => e.bucket === '30').length,
    },
    criticalItems,
    expiringItems,
    top10Consumed,
    consumptionTrend,
  };

  dashboardCache.set(cacheKey, result);
  return result;
};
