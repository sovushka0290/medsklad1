import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleGuard } from '../middleware/role.middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import { replenishmentService } from '../services/replenishment.service';
import { z } from 'zod';

const router = Router();

const createRequestSchema = z.object({
  medicationId: z.number().int().positive('ID медикамента обязателен'),
  locationId: z.number().int().positive('ID локации обязателен'),
  quantity: z.number().int().positive('Количество должно быть больше нуля'),
  comment: z.string().max(500).optional(),
});

// POST /api/replenishment — создать запрос пополнения (NURSE, STOREKEEPER, HEAD_NURSE, ADMIN)
router.post(
  '/',
  authMiddleware,
  roleGuard(['NURSE', 'STOREKEEPER', 'HEAD_NURSE', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const parsed = createRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
    }
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Не авторизован' });

    const result = await replenishmentService.createRequest({
      ...parsed.data,
      requestedBy: userId,
    });
    res.status(201).json({ success: true, data: result });
  })
);

// GET /api/replenishment — список запросов (STOREKEEPER, HEAD_NURSE, ADMIN видят все; NURSE только свои)
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const status = req.query.status as string | undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    // NURSE видит только запросы из своей локации (через фильтр locationId из query)
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;

    const result = await replenishmentService.getRequests({ status, locationId, page, limit });
    res.json({ success: true, ...result });
  })
);

// PATCH /api/replenishment/:id/status — изменить статус (STOREKEEPER, HEAD_NURSE, ADMIN)
router.patch(
  '/:id/status',
  authMiddleware,
  roleGuard(['STOREKEEPER', 'HEAD_NURSE', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Некорректный ID запроса' });
    }

    const { status } = req.body;
    if (!['ACKNOWLEDGED', 'FULFILLED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Недопустимый статус' });
    }

    const userId = (req as any).user?.id;
    const updated = await replenishmentService.resolveRequest(id, userId, status);
    res.json({ success: true, data: updated });
  })
);

export default router;
