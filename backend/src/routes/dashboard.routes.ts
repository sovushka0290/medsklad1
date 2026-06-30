import { Router } from 'express';
import { getDashboardMetrics } from '../services/dashboard.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleGuard } from '../middleware/role.middleware';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Метрики доступны Руководителю и Админу (СЕР-9: убран inline try-catch, используется asyncHandler)
router.get(
  '/metrics',
  authMiddleware,
  roleGuard(['ADMIN', 'MANAGER']),
  asyncHandler(async (req, res) => {
    const metrics = await getDashboardMetrics();
    res.json({ success: true, data: metrics });
  })
);

export default router;
