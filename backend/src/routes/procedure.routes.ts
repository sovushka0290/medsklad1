import { Router } from 'express';
import { createProcedure, logProcedure, getProcedureComparison } from '../services/procedure.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleGuard } from '../middleware/role.middleware';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Кладовщик создает процедуры и нормативы (СЕР-8: убран inline try-catch)
router.post(
  '/',
  authMiddleware,
  roleGuard(['ADMIN', 'STOREKEEPER']),
  asyncHandler(async (req, res) => {
    const procedure = await createProcedure(req.body);
    res.status(201).json({ success: true, data: procedure });
  })
);

// Медсестра логирует выполнение процедуры
router.post(
  '/log',
  authMiddleware,
  roleGuard(['ADMIN', 'NURSE', 'HEAD_NURSE']),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const log = await logProcedure({ ...req.body, userId });
    res.status(201).json({ success: true, data: log });
  })
);

// Руководитель или Главная медсестра — сравнение Факт/Норма
router.get(
  '/compare',
  authMiddleware,
  roleGuard(['ADMIN', 'MANAGER', 'HEAD_NURSE']),
  asyncHandler(async (req, res) => {
    const comparison = await getProcedureComparison();
    res.json({ success: true, data: comparison });
  })
);

export default router;
