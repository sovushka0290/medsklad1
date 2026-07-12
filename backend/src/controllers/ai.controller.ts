import { Request, Response } from 'express';
import { recognizeMedicationFromImage } from '../services/ai.service';
import { prisma } from '../lib/prisma';

export const recognizeImage = async (req: Request, res: Response) => {
  try {
    let imageStr = req.body.base64Image || req.body.image;
    const mimeType = req.body.mimeType;

    if (!imageStr) {
      return res.status(400).json({ error: 'Не передано изображение (base64Image / image)' });
    }

    // Очищаем base64 от data URI префикса, если он есть
    if (typeof imageStr === 'string' && imageStr.startsWith('data:')) {
      const match = imageStr.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        imageStr = match[2];
      }
    }

    // 🔐 SECURITY: Ограничиваем размер base64-изображения (DoS защита)
    const MAX_BASE64_BYTES = 2 * 1024 * 1024; // 2 MB decoded
    if (typeof imageStr !== 'string' || Buffer.byteLength(imageStr, 'base64') > MAX_BASE64_BYTES) {
      return res.status(400).json({ error: 'Изображение слишком большое (макс. 2 МБ)' });
    }

    const result = await recognizeMedicationFromImage(imageStr, mimeType);

    // Нормализуем confidence в диапазон 0..100
    let confidence = Number(result.confidence);
    if (isNaN(confidence)) confidence = 0;
    confidence = Math.min(100, Math.max(0, Math.round(confidence)));

    // Ищем соответствующий медикамент в базе данных по названию
    const nameToSearch = result.name || '';
    const matchedMed = nameToSearch.length > 2
      ? await prisma.medication.findFirst({
          where: {
            name: {
              contains: nameToSearch,
              mode: 'insensitive',
            },
          },
        })
      : null;

    // Если нашли по имени — возвращаем данные с БД
    let medicationResponse = null;
    if (matchedMed) {
      medicationResponse = {
        ...matchedMed,
        barcode: matchedMed.barcodes[0] || 'Распознано ИИ'
      };
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        text: result.name || 'Неизвестно',
        confidence,
        // Расширенные данные с упаковки (OCR)
        form: result.form || null,
        manufacturer: result.manufacturer || null,
        serialNumber: result.serialNumber || null,
        expirationDate: result.expirationDate || null,
        dosage: result.dosage || null,
        ocrText: result.ocrText || null,
        // Найденный в базе медикамент (если есть)
        medication: medicationResponse
      }
    });
  } catch (error: any) {
    // 🔐 SECURITY: Не раскрываем внутренние ошибки в продакшне
    const message = process.env.NODE_ENV === 'production'
      ? 'Ошибка при распознавании изображения'
      : error.message;
    res.status(500).json({ error: message });
  }
};
