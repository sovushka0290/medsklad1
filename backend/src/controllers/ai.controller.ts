import { Request, Response } from 'express';
import { recognizeMedicationFromImage } from '../services/ai.service';

export const recognizeImage = async (req: Request, res: Response) => {
  try {
    const { base64Image, mimeType } = req.body;

    if (!base64Image) {
      return res.status(400).json({ error: 'Не передано изображение (base64Image)' });
    }

    const result = await recognizeMedicationFromImage(base64Image, mimeType);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
