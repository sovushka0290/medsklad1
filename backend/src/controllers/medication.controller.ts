import { Request, Response, NextFunction } from 'express';
import { medicationService } from '../services/medication.service';

export const medicationController = {
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
};
