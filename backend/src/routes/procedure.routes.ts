import { Router } from 'express';
import {
  createProcedure,
  logProcedure,
  getProcedureComparison,
  getAllProcedures,
  getLogsJournal,
} from '../services/procedure.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleGuard } from '../middleware/role.middleware';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// ─── Ф-19: Создать шаблон процедуры со стандартом ───────────────────────────
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

// ─── Ф-20: Медсестра/медбрат вносит процедуру за смену ──────────────────────
router.post(
  '/log',
  authMiddleware,
  roleGuard(['ADMIN', 'NURSE', 'HEAD_NURSE', 'STOREKEEPER']),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const log = await logProcedure({ ...req.body, userId });
    res.status(201).json({ success: true, data: log });
  })
);

// ─── Ф-21, Ф-22: Сравнение Факт vs Норматив с фильтром по дате ──────────────
router.get(
  '/comparison',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER']),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as { from?: string; to?: string };
    const comparison = await getProcedureComparison({ from, to });
    res.json({ success: true, data: comparison });
  })
);

// Backward-compatible alias
router.get(
  '/compare',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER']),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as { from?: string; to?: string };
    const comparison = await getProcedureComparison({ from, to });
    res.json({ success: true, data: comparison });
  })
);

// ─── Ф-23, Ф-24: Журнал расхода — клиника→кабинет→сотрудник→МО ─────────────
router.get(
  '/logs',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER', 'NURSE']),
  asyncHandler(async (req, res) => {
    const {
      locationId, procedureId, userId,
      from, to, page, limit,
    } = req.query as Record<string, string>;

    const result = await getLogsJournal({
      locationId: locationId ? Number(locationId) : undefined,
      procedureId: procedureId ? Number(procedureId) : undefined,
      userId: userId ? Number(userId) : undefined,
      from,
      to,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    res.json({ success: true, ...result });
  })
);

export default router;
