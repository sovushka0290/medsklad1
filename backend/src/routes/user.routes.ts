import { Router } from 'express';
import { updatePushToken } from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.put('/me/push-token', requireAuth, updatePushToken);

export default router;
