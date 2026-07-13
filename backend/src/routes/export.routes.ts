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
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER']),
  asyncHandler(exportController.exportTransactions)
);

router.get(
  '/inventory',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER']),
  asyncHandler(exportController.exportInventory)
);

router.get(
  '/1c',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'MANAGER']), // 1C export usually for upper management
  asyncHandler(exportController.export1C)
);

router.get(
  '/cabinets',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'MANAGER']),
  asyncHandler(exportController.exportCabinets)
);

router.get(
  '/inventory-act',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER']),
  asyncHandler(exportController.exportInventoryAct)
);

router.get(
  '/write-off-act',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER']),
  asyncHandler(exportController.exportWriteOffAct)
);

router.get(
  '/excel',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER']),
  asyncHandler(exportController.excelExport)
);

router.get(
  '/csv',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER']),
  asyncHandler(exportController.csvExport)
);

router.get(
  '/pdf',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER']),
  asyncHandler(exportController.pdfExport)
);

router.get(
  '/procedure-journal',
  authMiddleware,
  roleGuard(['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER', 'NURSE']),
  asyncHandler(exportController.exportProcedureJournal)
);

export default router;
