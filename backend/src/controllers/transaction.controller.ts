import { Request, Response, NextFunction } from 'express';
import { transactionService } from '../services/transaction.service';

export const transactionController = {
  async createTransaction(req: Request, res: Response, next: NextFunction) {
    try {
            const { 
        type, 
        quantity, 
        medicationId, 
        locationId, 
        reason, 
        batchNumber,
        serialNumber, 
        expirationDate, 
        price,
        supplier, 
        purpose,
        receiver,
        targetLocationId,
        allowOverdraft 
      } = req.body;
      const userId = (req as any).user?.id;

      const tx = await transactionService.createTransaction({
        type,
        quantity,
        medicationId,
        locationId,
        userId,
        reason,
        batchNumber,
        serialNumber,
        expirationDate,
        supplier,
        price,
        purpose,
        receiver,
        targetLocationId: targetLocationId ? Number(targetLocationId) : undefined,
        allowOverdraft,
      });

      res.status(201).json(tx);
    } catch (error: any) {
      // Бизнес-ошибки (недостаточно товара и т.д.) — 400
      if (error.message && !error.message.includes('prisma')) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  },

  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 50;

      if (!Number.isInteger(page) || page < 1) {
        return res.status(400).json({ success: false, error: 'Параметр page должен быть целым положительным числом' });
      }
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ success: false, error: 'Параметр limit должен быть от 1 до 100' });
      }

      const result = await transactionService.getTransactionHistory(page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
};
