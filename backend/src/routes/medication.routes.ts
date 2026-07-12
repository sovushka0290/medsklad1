import { Router } from 'express';
import { medicationController } from '../controllers/medication.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleGuard } from '../middleware/role.middleware';

const router = Router();

// Все маршруты защищены авторизацией
router.get('/medications', authMiddleware, medicationController.getMedications);
router.get('/medications/search', authMiddleware, medicationController.searchMedications);
router.get('/medications/critical', authMiddleware, roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER']), medicationController.getCritical);
router.get('/inventory', authMiddleware, medicationController.getInventory);
// Создание нового медикамента (Ф-17: из экрана сканирования)
router.post('/medications', authMiddleware, roleGuard(['ADMIN', 'STOREKEEPER']), medicationController.createMedication);
router.post('/medication', authMiddleware, roleGuard(['ADMIN', 'STOREKEEPER']), medicationController.createMedication);
router.put('/medications/:id', authMiddleware, roleGuard(['ADMIN', 'STOREKEEPER']), medicationController.updateMedication);
router.get('/locations', authMiddleware, medicationController.getLocations);
router.get('/groups', authMiddleware, medicationController.getGroups);
router.post('/medication/scan', authMiddleware, medicationController.scanMedication);
router.post('/medications/scan', authMiddleware, medicationController.scanMedication);

export default router;

