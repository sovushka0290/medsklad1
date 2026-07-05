import { Router } from 'express';
import { exportController } from '../controllers/export.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleGuard } from '../middleware/role.middleware';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Exports are available to Management and Storekeepers
router.get(
  '/transactions',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER']),
  asyncHandler(exportController.exportTransactions)
);

router.get(
  '/inventory',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER']),
  asyncHandler(exportController.exportInventory)
);

router.get(
  '/1c',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE']), // 1C export usually for upper management
  asyncHandler(exportController.export1C)
);

router.get(
  '/cabinets',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE']),
  asyncHandler(exportController.exportCabinets)
);

router.get(
  '/inventory-act',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER']),
  asyncHandler(exportController.exportInventoryAct)
);

router.get(
  '/excel',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER']),
  asyncHandler(exportController.excelExport)
);

router.get(
  '/csv',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER']),
  asyncHandler(exportController.csvExport)
);

router.get(
  '/pdf',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER']),
  asyncHandler(exportController.pdfExport)
);

export default router;
