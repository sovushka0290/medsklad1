import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller';
import { authMiddleware, roleGuard } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createTransactionSchema } from '../validators/transaction.validator';

const router = Router();

router.post('/transactions', authMiddleware, roleGuard(['ADMIN', 'STOREKEEPER', 'NURSE', 'HEAD_NURSE']), validate(createTransactionSchema), transactionController.createTransaction);
router.get('/transactions', authMiddleware, roleGuard(['ADMIN', 'MANAGER', 'HEAD_NURSE', 'STOREKEEPER']), transactionController.getHistory);

export default router;
