import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError, ZodRawShape } from 'zod';

export const validate = (schema: ZodObject<ZodRawShape>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Ошибка валидации данных',
          details: error.issues.map((e) => ({
            path: e.path.map(String).join('.'),
            message: e.message,
          })),
        });
      }
      return res.status(400).json({ success: false, error: 'Неверный запрос' });
    }
  };
};
