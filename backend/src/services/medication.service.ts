import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const medicationService = {
  async getAllMedications(barcode?: string, page?: number, limit?: number) {
    if (barcode) {
      return prisma.medication.findMany({
        where: { barcode },
        include: { batches: { include: { location: true } } },
      });
    }

    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      return prisma.medication.findMany({
        skip,
        take: limit,
        include: {
          batches: { include: { location: true } },
        },
        orderBy: { name: 'asc' },
      });
    }

    return prisma.medication.findMany({
      include: {
        batches: { include: { location: true } },
      },
      orderBy: { name: 'asc' },
    });
  },

  async getInventorySummary() {
    // Получаем сводную таблицу остатков.
    // Делаем join с локациями (чтобы получить имена) и с медикаментами
    return prisma.batch.findMany({
      include: {
        location: true,
        medication: true,
      },
    });
  },

  async searchMedications(query: string) {
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
    });
  },

  async updateMedicationBarcode(id: number, barcode: string) {
    return prisma.medication.update({
      where: { id },
      data: { barcode },
    });
  },

  async getLocations() {
    return prisma.location.findMany();
  },

  async getCriticalMedications() {
    const medications = await prisma.medication.findMany({
      include: {
        batches: { include: { location: true } },
      },
    });

    return medications.filter(med => {
      const totalStock = med.batches.reduce((sum, b) => sum + b.quantity, 0);
      return totalStock < med.minQuantity;
    });
  },
};
