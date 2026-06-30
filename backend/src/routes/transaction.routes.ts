import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createTransactionSchema } from '../validators/transaction.validator';

const router = Router();

router.post('/transactions', authMiddleware, validate(createTransactionSchema), transactionController.createTransaction);
router.get('/transactions', authMiddleware, transactionController.getHistory);

export default router;
