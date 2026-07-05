import { Router } from 'express';
import { updatePushToken, getAuditLogs } from '../controllers/user.controller';
import { requireAuth, roleGuard } from '../middleware/auth.middleware';

const router = Router();

router.put('/me/push-token', requireAuth, updatePushToken);
router.get('/audit-logs', requireAuth, roleGuard(['ADMIN', 'HEAD_NURSE']), getAuditLogs);

export default router;
