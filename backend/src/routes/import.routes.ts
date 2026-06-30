import { Router } from 'express';
import multer from 'multer';
import { importController } from '../controllers/import.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleGuard } from '../middleware/role.middleware';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Храним загруженный файл в памяти (чтобы сразу передать в xlsx)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 МБ лимит
  }
});

// Доступ к импорту только у Администратора и Кладовщика
router.post(
  '/excel',
  authMiddleware,
  roleGuard(['ADMIN', 'STOREKEEPER']),
  upload.single('file'), // 'file' - это имя поля в FormData
  asyncHandler(importController.importExcel)
);

export default router;
