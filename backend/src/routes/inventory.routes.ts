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
>>>>>>> c79c4cada72b9906ae888aba688f6412f470d5ea
import { requireAuth, roleGuard } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.post('/start', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), startSession);
router.get('/active', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE', 'MANAGER']), getActive);
router.get('/history', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE', 'MANAGER']), getSessionHistory);
router.put('/:id/scan', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), scanItem);
router.post('/:id/complete', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), completeSession);
router.post('/:id/close', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), closeSession);
<<<<<<< HEAD
router.post('/:id/adjust', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), adjustQuantity);
=======
router.put('/:id/adjust', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), adjustQuantity);
>>>>>>> c79c4cada72b9906ae888aba688f6412f470d5ea

export default router;
