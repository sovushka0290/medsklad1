import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/transactions', authMiddleware, transactionController.createTransaction);
router.get('/transactions', transactionController.getHistory);

export default router;
