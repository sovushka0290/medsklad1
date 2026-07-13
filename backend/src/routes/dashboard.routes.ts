import { Router } from 'express';
import { getDashboardMetrics } from '../services/dashboard.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleGuard } from '../middleware/role.middleware';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Метрики доступны Руководителю, Главной медсестре, Админу, Кладовщику и Медсестре (для мобильного дашборда)
router.get(
  '/metrics',
  authMiddleware,
  roleGuard(['ADMIN', 'MANAGER', 'HEAD_NURSE', 'STOREKEEPER', 'NURSE']),
  asyncHandler(async (req, res) => {
    const filter = req.query.filter as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const shift = req.query.shift as string | undefined;
    const metrics = await getDashboardMetrics(filter, startDate, endDate, (req as any).user, shift);
    res.json(metrics);
  })
);

export default router;
