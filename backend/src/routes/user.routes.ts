import { Router } from 'express';
import { updatePushToken, getAuditLogs, getUsers, createUser, updateUser } from '../controllers/user.controller';
import { requireAuth, roleGuard } from '../middleware/auth.middleware';

const router = Router();

router.put('/me/push-token', requireAuth, updatePushToken);
router.get('/audit-logs', requireAuth, roleGuard(['ADMIN', 'HEAD_NURSE']), getAuditLogs);

// ADMIN-only User Management
router.get('/', requireAuth, roleGuard(['ADMIN']), getUsers);
router.post('/', requireAuth, roleGuard(['ADMIN']), createUser);
router.patch('/:id', requireAuth, roleGuard(['ADMIN']), updateUser);

export default router;
