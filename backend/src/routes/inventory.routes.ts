import { Router } from 'express';
import {
  startSession,
  getActive,
  scanItem,
  completeSession,
  closeSession,
  getSessionHistory,
  adjustQuantity
} from '../controllers/inventory.controller';
import { requireAuth, roleGuard } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.post('/start', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), startSession);
router.get('/active', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE', 'MANAGER']), getActive);
router.get('/history', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE', 'MANAGER']), getSessionHistory);
router.put('/:id/scan', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), scanItem);
router.post('/:id/complete', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), completeSession);
router.post('/:id/close', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), closeSession);
router.post('/:id/adjust', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), adjustQuantity);

export default router;
