import { Router } from 'express';
import { startSession, getActive, scanItem, completeSession } from '../controllers/inventory.controller';
import { requireAuth, roleGuard } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.post('/start', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), startSession);
router.get('/active', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE', 'MANAGER']), getActive);
router.put('/:id/scan', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), scanItem);
router.post('/:id/complete', roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']), completeSession);

export default router;
