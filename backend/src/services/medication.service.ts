import { prisma } from '../lib/prisma';

export const medicationService = {
  async getAllMedications(barcode?: string, page?: number, limit?: number) {
    if (barcode) {
      return prisma.medication.findMany({
        where: { barcode },
        include: { batches: { include: { location: true } } },
      });
    }

    const take = limit || 50;
    const skip = page ? (page - 1) * take : 0;

    const [data, total] = await Promise.all([
      prisma.medication.findMany({
        skip,
        take,
        include: {
          batches: { include: { location: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.medication.count(),
    ]);

    return { data, total, page: page || 1, limit: take, totalPages: Math.ceil(total / take) };
  },

  async getInventorySummary() {
    // Оптимизация: агрегация вместо загрузки всех записей
    return prisma.batch.findMany({
      where: { quantity: { gt: 0 } }, // Только ненулевые остатки
      include: {
        location: { select: { id: true, name: true, type: true } },
        medication: { select: { id: true, name: true, barcode: true, minQuantity: true } },
      },
      orderBy: { medication: { name: 'asc' } },
    });
  },

  async searchMedications(query: string) {
    if (query.length < 2) return [];

    return prisma.medication.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { barcode: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        batches: { include: { location: true } },
      },
      take: 20, // Ограничение количества результатов
    });
  },

  async updateMedicationBarcode(id: number, barcode: string) {
    return prisma.medication.update({
      where: { id },
      data: { barcode },
    });
  },

  async getLocations() {
    return prisma.location.findMany({
      orderBy: { name: 'asc' },
    });
  },

  async getCriticalMedications() {
    // Оптимизация: загружаем только необходимые поля
    const medications = await prisma.medication.findMany({
      include: {
        batches: {
          select: { quantity: true, locationId: true },
        },
      },
    });

    return medications.filter((med) => {
      const totalStock = med.batches.reduce((sum, b) => sum + b.quantity, 0);
      return totalStock < med.minQuantity;
    }).map((med) => ({
      ...med,
      totalStock: med.batches.reduce((sum, b) => sum + b.quantity, 0),
    }));
  },
};
