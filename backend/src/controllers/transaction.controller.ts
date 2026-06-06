import { Request, Response } from 'express';
import { transactionService } from '../services/transaction.service';

export const transactionController = {
  async createTransaction(req: Request, res: Response) {
    try {
      const { type, quantity, medicationId, locationId } = req.body;
      if (!type || quantity === undefined || !medicationId || !locationId) {
        return res.status(400).json({
          error: 'Не заполнены обязательные поля: type, quantity, medicationId, locationId',
        });
      }

      const tx = await transactionService.createTransaction({
        type,
        quantity: parseInt(quantity),
        medicationId: parseInt(medicationId),
        locationId: parseInt(locationId),
      });

      res.status(201).json(tx);
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      res.status(400).json({ error: error.message || 'Internal server error' });
    }
  },

  async getHistory(req: Request, res: Response) {
    try {
      const history = await transactionService.getTransactionHistory();
      res.json(history);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};
