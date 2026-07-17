import { prisma } from '../lib/prisma';
import NodeCache from 'node-cache';
import { generateDashboardInsights } from './ai.service';
import { getProcedureComparison } from './procedure.service';
import { LocationType } from '@prisma/client';

const dashboardCache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache

export const getDashboardMetrics = async (
  filter?: string,
  startDate?: string,
  endDate?: string,
  user?: { id: number; role: string },
  shift?: string
) => {
  const cacheKey = `dashboard_metrics_${user?.role || ''}_${user?.id || ''}_${filter || 'week'}_${startDate || ''}_${endDate || ''}_${shift || ''}`;
  const cached = dashboardCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Роль медсестры: упрощенный мобильный дашборд без тяжелых финансовых и аналитических расчетов
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
      consumptionTrend: [],
      financialAnalysis: [],
      cabinetEfficiency: [],
      aiInsights: []
    };

    dashboardCache.set(cacheKey, result);
    return result;
  }

  // Расчет дат для основного аналитического периода
  const now = new Date();
  let dateFrom: Date;
  let dateTo: Date = new Date(now);

  if (startDate && endDate) {
    dateFrom = new Date(startDate);
    dateTo = new Date(endDate);
    dateTo.setHours(23, 59, 59, 999);
    if (shift === 'prev') {
      const diffTime = Math.abs(dateTo.getTime() - dateFrom.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      dateFrom.setDate(dateFrom.getDate() - diffDays);
      dateTo.setDate(dateTo.getDate() - diffDays);
    }
  } else {
    switch (filter) {
      case 'today':
        dateFrom = new Date(now);
        dateFrom.setHours(0, 0, 0, 0);
        if (shift === 'prev') {
          dateFrom.setDate(dateFrom.getDate() - 1);
          dateTo = new Date(dateFrom);
          dateTo.setHours(23, 59, 59, 999);
        }
        break;
      case 'month':
        dateFrom = new Date(now);
        dateFrom.setDate(now.getDate() - 30);
        if (shift === 'prev') {
          dateFrom.setDate(dateFrom.getDate() - 30);
          dateTo = new Date(now);
          dateTo.setDate(now.getDate() - 30);
        }
        break;
      case 'year':
        dateFrom = new Date(now);
        dateFrom.setFullYear(now.getFullYear() - 1);
        if (shift === 'prev') {
          dateFrom.setFullYear(dateFrom.getFullYear() - 1);
          dateTo = new Date(now);
          dateTo.setFullYear(now.getFullYear() - 1);
        }
        break;
      case 'week':
      default:
        dateFrom = new Date(now);
        dateFrom.setDate(now.getDate() - 7);
        if (shift === 'prev') {
          dateFrom.setDate(dateFrom.getDate() - 7);
          dateTo = new Date(now);
          dateTo.setDate(now.getDate() - 7);
        }
        break;
    }
  }

  // 1. Агрегация основных запасов и партий
  const [batchAgg, allBatches, outflows, rawTrendTx] = await Promise.all([
    prisma.batch.aggregate({
      _sum: { quantity: true },
    }),

    prisma.medication.findMany({
      select: {
        id: true,
        name: true,
        minQuantity: true,
        batches: {
          select: { quantity: true, price: true, expirationDate: true, locationId: true },
        },
      },
    }),

    prisma.transaction.groupBy({
      by: ['medicationId'],
      where: { type: 'OUTFLOW', createdAt: { gte: dateFrom, lte: dateTo } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),

    prisma.transaction.findMany({
      where: {
        type: { in: ['OUTFLOW', 'WRITE_OFF'] },
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: { createdAt: true, quantity: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Расчет расхода за последние 30 дней для прогнозирования дней до исчерпания
  const date30DaysAgo = new Date();
  date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);

  const consumptionLast30Days = await prisma.transaction.groupBy({
    by: ['medicationId'],
    where: {
      type: { in: ['OUTFLOW', 'WRITE_OFF'] },
      createdAt: { gte: date30DaysAgo },
    },
    _sum: { quantity: true },
  });

  const consumptionMap = new Map<number, number>();
  for (const c of consumptionLast30Days) {
    consumptionMap.set(c.medicationId, (c._sum.quantity || 0) / 30); // среднесуточный расход
  }

  // Расчет критических запасов, стоимости и сроков годности
  let totalValue = 0;
  const criticalItems: {
    name: string;
    quantity: number;
    minQuantity: number;
    isExpiringSoon: boolean;
    averageDailyConsumption: number;
    daysUntilDepletion: number;
  }[] = [];

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
        if (daysLeft < 0) {
          isExpiringSoon = true;
        }
      }
    }

    const averageDailyConsumption = consumptionMap.get(med.id) || 0;
    const daysUntilDepletion = averageDailyConsumption > 0
      ? Math.round((medStock / averageDailyConsumption) * 10) / 10
      : 999; // Если расхода нет, ставим 999 дней (безопасно)

    let minExpirationDate: Date | null = null;
    for (const batch of med.batches) {
      if (batch.quantity > 0 && batch.expirationDate) {
        if (!minExpirationDate || batch.expirationDate < minExpirationDate) {
          minExpirationDate = batch.expirationDate;
        }
      }
    }

    if (medStock <= med.minQuantity || isExpiringSoon || daysUntilDepletion <= 15) {
      criticalItems.push({
        id: String(med.id),
        name: med.name,
        quantity: medStock,
        minQuantity: med.minQuantity,
        isExpiringSoon,
        averageDailyConsumption,
        daysUntilDepletion,
        expirationDate: minExpirationDate ? minExpirationDate.toISOString() : null,
      });
    }
  }

  expiringItems.sort((a, b) => a.daysLeft - b.daysLeft);

  // Получаем названия для ТОП-10 потребляемых
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

  // Тренд потребления
  const trendByDate = new Map<string, number>();
  for (const tx of rawTrendTx) {
    const dateKey = tx.createdAt.toISOString().split('T')[0];
    trendByDate.set(dateKey, (trendByDate.get(dateKey) || 0) + tx.quantity);
  }
  const consumptionTrend = Array.from(trendByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

  // 2. Финансовый анализ: Закупки (INCOME) vs Расходы+Списания (OUTFLOW, WRITE_OFF) по месяцам
  const date6MonthsAgo = new Date();
  date6MonthsAgo.setMonth(date6MonthsAgo.getMonth() - 6);

  const financialTransactions = await prisma.transaction.findMany({
    where: {
      createdAt: { gte: date6MonthsAgo },
      type: { in: ['INCOME', 'OUTFLOW', 'WRITE_OFF'] },
    },
    select: {
      type: true,
      quantity: true,
      price: true,
      createdAt: true,
    },
  });

  // Заполняем последние 6 месяцев нулями по дефолту
  const financialMap = new Map<string, { month: string; purchases: number; expenditures: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthKey = d.toISOString().substring(0, 7); // YYYY-MM
    financialMap.set(monthKey, { month: monthKey, purchases: 0, expenditures: 0 });
  }

  for (const tx of financialTransactions) {
    const monthKey = tx.createdAt.toISOString().substring(0, 7);
    if (financialMap.has(monthKey)) {
      const monthData = financialMap.get(monthKey)!;
      const txValue = tx.quantity * (tx.price || 0);
      if (tx.type === 'INCOME') {
        monthData.purchases += txValue;
      } else {
        monthData.expenditures += txValue;
      }
    }
  }

  const financialAnalysis = Array.from(financialMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((item) => ({
      ...item,
      purchases: Math.round(item.purchases * 100) / 100,
      expenditures: Math.round(item.expenditures * 100) / 100,
    }));

  // 3. Эффективность кабинетов (Ф-27)
  const locations = await prisma.location.findMany({
    select: { id: true, name: true, type: true },
  });

  const comparisons = await getProcedureComparison({
    from: dateFrom.toISOString(),
    to: dateTo.toISOString(),
  });

  const outflowsForLocations = await prisma.transaction.findMany({
    where: {
      type: { in: ['OUTFLOW', 'WRITE_OFF'] },
      createdAt: { gte: dateFrom, lte: dateTo },
    },
    select: {
      locationId: true,
      quantity: true,
      price: true,
    },
  });

  const cabinetEfficiency = locations
    .filter((loc) => loc.type !== LocationType.MAIN_STORAGE)
    .map((loc) => {
      const locComparisons = comparisons.filter((c) => c.locationId === loc.id);
      const totalManipulations = locComparisons.reduce((sum, c) => sum + c.timesPerformed, 0);

      // Подсчет нарушений
      let violationsCount = 0;
      let totalNormsChecked = 0;
      for (const comp of locComparisons) {
        for (const usage of comp.usage) {
          totalNormsChecked++;
          if (usage.isViolation) {
            violationsCount++;
          }
        }
      }

      const violationsPercentage = totalNormsChecked > 0
        ? Math.round((violationsCount / totalNormsChecked) * 1000) / 10
        : 0;

      // Сумма списаний в деньгах
      const locTxs = outflowsForLocations.filter((tx) => tx.locationId === loc.id);
      const writeOffsValue = locTxs.reduce((sum, tx) => sum + tx.quantity * (tx.price || 0), 0);

      return {
        cabinetId: loc.id,
        cabinetName: loc.name,
        proceduresCount: totalManipulations,
        writeOffsValue: Math.round(writeOffsValue * 100) / 100,
        violationsCount,
        violationsPercentage,
      };
    });

  // 4. Сбор данных для ИИ-инсайтов
  // Избыток на кабинетах: остаток > 15 шт при среднем расходе в день < 0.05
  const excessItems: { name: string; quantity: number; cabinetName: string; averageDailyConsumption: number }[] = [];
  const cabinetBatches = await prisma.batch.findMany({
    where: {
      location: { type: { not: LocationType.MAIN_STORAGE } },
      quantity: { gte: 15 },
    },
    select: {
      id: true,
      quantity: true,
      medicationId: true,
      locationId: true,
      medication: { select: { name: true } },
      location: { select: { name: true } },
    },
  });

  // Получим средний расход по комбинациям препарат-локация за 30 дней
  const localConsumption = await prisma.transaction.groupBy({
    by: ['medicationId', 'locationId'],
    where: {
      type: { in: ['OUTFLOW', 'WRITE_OFF'] },
      createdAt: { gte: date30DaysAgo },
    },
    _sum: { quantity: true },
  });

  const localConsumptionMap = new Map<string, number>();
  for (const lc of localConsumption) {
    localConsumptionMap.set(`${lc.medicationId}_${lc.locationId}`, (lc._sum.quantity || 0) / 30);
  }

  for (const b of cabinetBatches) {
    const avgConsumption = localConsumptionMap.get(`${b.medicationId}_${b.locationId}`) || 0;
    if (avgConsumption < 0.05) {
      excessItems.push({
        name: b.medication.name,
        quantity: b.quantity,
        cabinetName: b.location.name,
        averageDailyConsumption: avgConsumption,
      });
    }
  }

  // Аномальный расход: расход за последние 7 дней превысил норму (предыдущие 3 недели / 3) более чем на 150%
  const anomalousItems: { name: string; quantityConsumed: number; percentageIncrease: number; cabinetName: string }[] = [];
  const date7DaysAgo = new Date();
  date7DaysAgo.setDate(date7DaysAgo.getDate() - 7);

  const rawOutflowsLast7Days = await prisma.transaction.findMany({
    where: {
      type: { in: ['OUTFLOW', 'WRITE_OFF'] },
      createdAt: { gte: date7DaysAgo },
    },
    include: {
      medication: { select: { name: true } },
      location: { select: { name: true } },
    },
  });

  const rawOutflowsPreviousWeeks = await prisma.transaction.findMany({
    where: {
      type: { in: ['OUTFLOW', 'WRITE_OFF'] },
      createdAt: { gte: date30DaysAgo, lt: date7DaysAgo },
    },
    select: {
      medicationId: true,
      locationId: true,
      quantity: true,
    },
  });

  const last7DaysMap = new Map<string, { quantity: number; medName: string; locName: string }>();
  for (const tx of rawOutflowsLast7Days) {
    const key = `${tx.medicationId}_${tx.locationId}`;
    const curr = last7DaysMap.get(key) || { quantity: 0, medName: tx.medication.name, locName: tx.location.name };
    curr.quantity += tx.quantity;
    last7DaysMap.set(key, curr);
  }

  const prevWeeksMap = new Map<string, number>();
  for (const tx of rawOutflowsPreviousWeeks) {
    const key = `${tx.medicationId}_${tx.locationId}`;
    prevWeeksMap.set(key, (prevWeeksMap.get(key) || 0) + tx.quantity);
  }

  for (const [key, data] of last7DaysMap.entries()) {
    const prevWeeklyAverage = (prevWeeksMap.get(key) || 0) / 3;
    if (data.quantity > 8 && prevWeeklyAverage > 0) {
      const percentageIncrease = ((data.quantity - prevWeeklyAverage) / prevWeeklyAverage) * 100;
      if (percentageIncrease >= 150) {
        anomalousItems.push({
          name: data.medName,
          quantityConsumed: data.quantity,
          percentageIncrease,
          cabinetName: data.locName,
        });
      }
    }
  }

  // Генерация ИИ-инсайтов
  const aiInsights = await generateDashboardInsights({
    criticalItems: criticalItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      minQuantity: item.minQuantity,
      daysUntilDepletion: item.daysUntilDepletion,
      averageDailyConsumption: item.averageDailyConsumption,
    })),
    excessItems: excessItems.slice(0, 5),
    anomalousItems: anomalousItems.slice(0, 5),
  });

  const result = {
    overview: {
      totalItemsInStock: batchAgg._sum.quantity || 0,
      totalInventoryValue: Math.round(totalValue * 100) / 100,
      totalUniqueMedications: allBatches.length,
      criticalItemsCount: criticalItems.length,
      expiringItemsCount: expiringItems.filter((e) => e.bucket === '30').length,
    },
    criticalItems,
    expiringItems,
    top10Consumed,
    consumptionTrend,
    financialAnalysis,
    cabinetEfficiency,
    aiInsights,
  };

  dashboardCache.set(cacheKey, result);
  return result;
};

