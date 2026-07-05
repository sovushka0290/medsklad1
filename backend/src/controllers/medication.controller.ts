import { Request, Response, NextFunction } from 'express';
import { medicationService } from '../services/medication.service';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const createMedicationSchema = z.object({
  name: z.string().min(2, 'Название обязательно').max(255),
  mnn: z.string().optional(),
  form: z.string().optional(),
  unit: z.string().optional(),
  group: z.string().optional(),
  minQuantity: z.number().int().min(0).default(10),
  barcodes: z.array(z.string()).min(1, 'Необходим хотя бы один штрихкод'),
});

export const medicationController = {
  async createMedication(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createMedicationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
      }
      const { name, mnn, form, unit, group, minQuantity, barcodes } = parsed.data;

      // Проверяем уникальность штрихкода
      const existing = await prisma.medication.findFirst({
        where: { barcodes: { hasSome: barcodes } },
        select: { id: true, name: true },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Штрихкод уже привязан к медикаменту "${existing.name}" (ID: ${existing.id})`,
        });
      }

      const medication = await prisma.medication.create({
        data: { name, mnn, form, unit, group, minQuantity, barcodes },
      });
      res.status(201).json({ success: true, data: medication });
    } catch (error) {
      next(error);
    }
  },

  async getMedications(req: Request, res: Response, next: NextFunction) {
    try {
      const barcode = req.query.barcode as string | undefined;
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      // Валидация page/limit
      if (page !== undefined && (!Number.isInteger(page) || page < 1)) {
        return res.status(400).json({ success: false, error: 'Параметр page должен быть целым положительным числом' });
      }
      if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
        return res.status(400).json({ success: false, error: 'Параметр limit должен быть от 1 до 100' });
      }

      const medications = await medicationService.getAllMedications(barcode ? [barcode] : undefined, page, limit);
      res.json(medications);
    } catch (error) {
      next(error);
    }
  },

  async getInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const inventory = await medicationService.getInventorySummary();
      res.json(inventory);
    } catch (error) {
      next(error);
    }
  },

  async searchMedications(req: Request, res: Response, next: NextFunction) {
    try {
      const q = (req.query.q as string) || '';
      if (q.length < 2) {
        return res.json([]);
      }
      const medications = await medicationService.searchMedications(q);
      res.json(medications);
    } catch (error) {
      next(error);
    }
  },

  async updateMedication(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!id || !Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, error: 'Некорректный ID медикамента' });
      }
      const { barcodes } = req.body;
      if (!barcodes || !Array.isArray(barcodes) || barcodes.length === 0) {
        return res.status(400).json({ success: false, error: 'Список штрихкодов обязателен для заполнения' });
      }
      const updated = await medicationService.updateMedicationBarcodes(id, barcodes);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },

  async getLocations(req: Request, res: Response, next: NextFunction) {
    try {
      const locations = await medicationService.getLocations();
      res.json(locations);
    } catch (error) {
      next(error);
    }
  },

  async getCritical(req: Request, res: Response, next: NextFunction) {
    try {
      const medications = await medicationService.getCriticalMedications();
      res.json(medications);
    } catch (error) {
      next(error);
    }
  },

  async scanMedication(req: Request, res: Response, next: NextFunction) {
    try {
      const { barcode } = req.body;
      if (!barcode) {
        return res.status(400).json({ success: false, error: 'Штрихкод обязателен' });
      }

      const medication = await prisma.medication.findFirst({
        where: { barcodes: { has: barcode } }
      });

      if (!medication) {
        return res.status(404).json({ success: false, error: 'Медикамент с таким штрихкодом не найден' });
      }

      res.json({
        success: true,
        data: medication
      });
    } catch (error) {
      next(error);
    }
  },
};
