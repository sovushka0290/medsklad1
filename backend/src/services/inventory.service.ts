import { prisma } from '../lib/prisma';
import { InventoryStatus } from '@prisma/client';

export const startInventorySession = async (locationId: number, userId: number) => {
  return prisma.$transaction(async (tx) => {
    // 1. Создаем сессию
    const session = await tx.inventorySession.create({
      data: {
        locationId,
        userId,
        status: InventoryStatus.ACTIVE,
      }
    });

    // 2. Делаем снапшот остатков для этой локации
    const batches = await tx.batch.findMany({
      where: { locationId }
    });

    // Группируем по medicationId
    const expectedTotals: Record<number, number> = {};
    for (const b of batches) {
      expectedTotals[b.medicationId] = (expectedTotals[b.medicationId] || 0) + b.quantity;
    }

    // 3. Создаем записи InventoryItem
    const itemsData = Object.keys(expectedTotals).map(medId => ({
      sessionId: session.id,
      medicationId: Number(medId),
      expectedQuantity: expectedTotals[Number(medId)],
    }));

    if (itemsData.length > 0) {
      await tx.inventoryItem.createMany({ data: itemsData });
    }

    return tx.inventorySession.findUnique({
      where: { id: session.id },
      include: { items: true }
    });
  });
};

export const getActiveSessions = async () => {
  return prisma.inventorySession.findMany({
    where: { status: InventoryStatus.ACTIVE },
    include: {
      location: true,
      user: { select: { id: true, name: true } },
      _count: { select: { items: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
};

export const scanInventoryItem = async (sessionId: number, barcode: string, quantityToAdd: number = 1) => {
  // Найти медикамент по штрихкоду
  const med = await prisma.medication.findFirst({ where: { barcodes: { has: barcode } } });
  if (!med) throw new Error('Медикамент с таким штрихкодом не найден');

  // Найти или создать InventoryItem для данной сессии
  let item = await prisma.inventoryItem.findFirst({
    where: { sessionId, medicationId: med.id }
  });

  if (!item) {
    // Товар, которого вообще не должно быть в этой локации (expected = 0)
    item = await prisma.inventoryItem.create({
      data: {
        sessionId,
        medicationId: med.id,
        expectedQuantity: 0,
        actualQuantity: quantityToAdd,
        difference: quantityToAdd
      }
    });
  } else {
    const newActual = (item.actualQuantity || 0) + quantityToAdd;
    item = await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        actualQuantity: newActual,
        difference: newActual - item.expectedQuantity
      }
    });
  }

  return item;
};

export const completeInventorySession = async (sessionId: number) => {
  // Закрываем сессию
  const session = await prisma.inventorySession.update({
    where: { id: sessionId },
    data: {
      status: InventoryStatus.COMPLETED,
      completedAt: new Date()
    },
    include: {
      items: {
        include: { medication: true }
      },
      location: true
    }
  });

  return session;
};
