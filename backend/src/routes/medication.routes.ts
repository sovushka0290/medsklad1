import { Router } from 'express';
import { medicationController } from '../controllers/medication.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleGuard } from '../middleware/role.middleware';

const router = Router();

// Все маршруты защищены авторизацией (КРИТ-4: было 5 открытых маршрутов)
router.get('/medications', authMiddleware, medicationController.getMedications);
router.get('/medications/search', authMiddleware, medicationController.searchMedications);
router.get('/medications/critical', authMiddleware, roleGuard(['ADMIN', 'MANAGER', 'HEAD_NURSE', 'STOREKEEPER']), medicationController.getCritical);
router.get('/inventory', authMiddleware, medicationController.getInventory);
router.put('/medications/:id', authMiddleware, roleGuard(['ADMIN', 'STOREKEEPER']), medicationController.updateMedication);
router.get('/locations', authMiddleware, medicationController.getLocations);

export default router;
