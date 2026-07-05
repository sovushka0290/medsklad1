import { Request, Response } from 'express';
import { recognizeMedicationFromImage } from '../services/ai.service';

export const recognizeImage = async (req: Request, res: Response) => {
  try {
    const { base64Image, mimeType } = req.body;

    if (!base64Image) {
      return res.status(400).json({ error: 'Не передано изображение (base64Image)' });
    }

    // 🔐 SECURITY: Ограничиваем размер base64-изображения (DoS защита)
    const MAX_BASE64_BYTES = 2 * 1024 * 1024; // 2 MB decoded
    if (typeof base64Image !== 'string' || Buffer.byteLength(base64Image, 'base64') > MAX_BASE64_BYTES) {
      return res.status(400).json({ error: 'Изображение слишком большое (макс. 2 МБ)' });
    }

    const result = await recognizeMedicationFromImage(base64Image, mimeType);
    
    // Нормализуем confidence в диапазон 0..1
    let confidence = Number(result.confidence);
    if (isNaN(confidence)) {
      confidence = 0.0;
    } else if (confidence > 1) {
      confidence = confidence / 100.0;
    }

    if (confidence < 0.8) {
      return res.json({
        success: false,
        status: 'low_confidence',
        confidence: confidence,
        message: 'Низкая уверенность распознавания. Пожалуйста, введите данные вручную.',
      });
    }

    res.json({
      success: true,
      status: 'success',
      confidence: confidence,
      data: result,
    });
  } catch (error: any) {
    // 🔐 SECURITY: Не раскрываем внутренние ошибки в продакшне
    const message = process.env.NODE_ENV === 'production'
      ? 'Ошибка при распознавании изображения'
      : error.message;
    res.status(500).json({ error: message });
  }
};
