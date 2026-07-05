import { Router } from 'express';
<<<<<<< HEAD
import {
  startSession,
  getActive,
  scanItem,
  completeSession,
  closeSession,
  getSessionHistory,
  adjustQuantity
} from '../controllers/inventory.controller';
=======
import { startSession, getActive, scanItem, completeSession, getSessionHistory, closeSession, adjustQuantity } from '../controllers/inventory.controller';
>>>>>>> c3ab6ea257cdd60b4926c44388ac86496362e606
import { requireAuth, roleGuard } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.post('/start', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), startSession);
router.get('/active', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE', 'MANAGER']), getActive);
<<<<<<< HEAD
router.get('/history', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), getSessionHistory);
router.put('/:id/scan', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), scanItem);
router.post('/:id/complete', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), completeSession);
router.post('/:id/close', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), closeSession);
router.post('/:id/adjust', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), adjustQuantity);
=======
router.get('/history', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE', 'MANAGER']), getSessionHistory);
router.put('/:id/scan', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), scanItem);
router.post('/:id/complete', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), completeSession);
router.post('/:id/close', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), closeSession);
router.put('/:id/adjust', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), adjustQuantity);
>>>>>>> c3ab6ea257cdd60b4926c44388ac86496362e606

export default router;
