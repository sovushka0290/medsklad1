import { Router } from 'express';
import multer from 'multer';
import { importController } from '../controllers/import.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { roleGuard } from '../middleware/role.middleware';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// 🔐 SECURITY: Храним загруженный файл в памяти (чтобы сразу передать в xlsx)
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
  'text/csv',                                                           // .csv
  'application/csv',
];

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 🔐 5 МБ максимум (было 10 МБ)
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только файлы .xlsx, .xls, .csv'));
    }
  },
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
