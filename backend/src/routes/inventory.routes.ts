import { Router } from 'express';
import { startSession, getActive, scanItem, completeSession } from '../controllers/inventory.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.post('/start', startSession);
router.get('/active', getActive);
router.put('/:id/scan', scanItem);
router.post('/:id/complete', completeSession);

export default router;
