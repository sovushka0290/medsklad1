import { prisma } from '../lib/prisma';
import NodeCache from 'node-cache';

const dashboardCache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache

export const getDashboardMetrics = async () => {
  const cacheKey = 'dashboard_metrics';
  const cached = dashboardCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  // Параллельные запросы для скорости
  const [batchAgg, allBatches, outflows, consumptionTrendRaw] = await Promise.all([
    // 1. Агрегация общих показателей через SQL (ПЕРФ-1: не загружаем все записи в память)
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

    // 3. ТОП-10 расходуемых
    prisma.transaction.groupBy({
      by: ['medicationId'],
      where: { type: 'OUTFLOW' },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),

    // 4. Динамика расхода за последние 7 дней
    prisma.$queryRaw<{ date: string; total: number }[]>`
      SELECT DATE(t."createdAt") as date, CAST(SUM(t."quantity") AS FLOAT) as total
      FROM "Transaction" t
      WHERE t.type IN ('OUTFLOW', 'WRITE_OFF')
        AND t."createdAt" >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(t."createdAt")
      ORDER BY DATE(t."createdAt") ASC;
    `,
  ]);

  // Подсчёт по медикаментам
  let totalValue = 0;
  const criticalItems: { name: string; quantity: number; minQuantity: number; isExpiringSoon: boolean }[] = [];

  const futureThreshold = new Date();
  const thresholdDays = parseInt(process.env.EXPIRY_THRESHOLD_DAYS || '30', 10);
  futureThreshold.setDate(futureThreshold.getDate() + thresholdDays);

  for (const med of allBatches) {
    let medStock = 0;
    let isExpiringSoon = false;
    for (const batch of med.batches) {
      medStock += batch.quantity;
      totalValue += batch.quantity * (batch.price || 0);
      if (batch.quantity > 0 && batch.expirationDate && batch.expirationDate <= futureThreshold) {
        isExpiringSoon = true;
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

  const consumptionTrend = consumptionTrendRaw.map(row => ({
    date: row.date.toString(), // handle JS Date formatting if necessary
    total: row.total,
  }));

  const result = {
    overview: {
      totalItemsInStock: batchAgg._sum.quantity || 0,
      totalInventoryValue: Math.round(totalValue * 100) / 100,
      totalUniqueMedications: allBatches.length,
      criticalItemsCount: criticalItems.length,
    },
    criticalItems,
    top10Consumed,
    consumptionTrend,
  };

  dashboardCache.set(cacheKey, result);
  return result;
};
