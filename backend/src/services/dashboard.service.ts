import { prisma } from '../lib/prisma';

export const getDashboardMetrics = async () => {
  // Параллельные запросы для скорости
  const [batchAgg, allBatches, outflows] = await Promise.all([
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
          select: { quantity: true, price: true },
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
  ]);

  // Подсчёт по медикаментам
  let totalValue = 0;
  const criticalItems: { name: string; quantity: number; minQuantity: number }[] = [];

  for (const med of allBatches) {
    let medStock = 0;
    for (const batch of med.batches) {
      medStock += batch.quantity;
      totalValue += batch.quantity * (batch.price || 0);
    }
    if (medStock <= med.minQuantity) {
      criticalItems.push({
        name: med.name,
        quantity: medStock,
        minQuantity: med.minQuantity,
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

  return {
    overview: {
      totalItemsInStock: batchAgg._sum.quantity || 0,
      totalInventoryValue: Math.round(totalValue * 100) / 100,
      totalUniqueMedications: allBatches.length,
      criticalItemsCount: criticalItems.length,
    },
    criticalItems,
    top10Consumed,
  };
};
