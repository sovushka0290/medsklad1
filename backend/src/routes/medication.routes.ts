import { Router } from 'express';
import { medicationController } from '../controllers/medication.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/medications', medicationController.getMedications);
router.get('/medications/search', medicationController.searchMedications);
router.get('/medications/critical', medicationController.getCritical);
router.get('/inventory', medicationController.getInventory);
router.put('/medications/:id', authMiddleware, medicationController.updateMedication);
router.get('/locations', medicationController.getLocations);

export default router;
