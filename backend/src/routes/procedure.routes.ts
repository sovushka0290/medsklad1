import { Router } from 'express';
import { createProcedure, logProcedure, getProcedureComparison, getAllProcedures } from '../services/procedure.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleGuard } from '../middleware/role.middleware';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Кладовщик создает процедуры и нормативы (СЕР-8: убран inline try-catch)
router.post(
  '/',
  authMiddleware,
  roleGuard(['ADMIN', 'STOREKEEPER', 'HEAD_NURSE']),
  asyncHandler(async (req, res) => {
    const procedure = await createProcedure(req.body);
    res.status(201).json({ success: true, data: procedure });
  })
);

// Получить список всех процедур
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const procedures = await getAllProcedures();
    res.json({ success: true, data: procedures });
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
// Primary route
router.get(
  '/comparison',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER']),
  asyncHandler(async (req, res) => {
    const comparison = await getProcedureComparison();
    res.json({ success: true, data: comparison });
  })
);
// Backward‑compatible alias
router.get(
  '/compare',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER']),
  asyncHandler(async (req, res) => {
    const comparison = await getProcedureComparison();
    res.json({ success: true, data: comparison });
  })
);

export default router;
