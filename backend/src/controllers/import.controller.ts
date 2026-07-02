import { Request, Response, NextFunction } from 'express';
import { importService } from '../services/import.service';

export const importController = {
  async importExcel(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Файл не загружен. Пожалуйста, прикрепите Excel или CSV файл.'
        });
      }

      // Multer использует req.user, если мы передаем его из authMiddleware
      const userId = (req as any).user?.id;
      if (!userId) {
         return res.status(401).json({ success: false, error: 'Пользователь не авторизован' });
      }

      // Вызываем сервис для парсинга файла, который хранится в оперативной памяти (buffer)
      const result = await importService.importExcel(req.file.buffer, userId);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      next(error);
    }
  }
};
