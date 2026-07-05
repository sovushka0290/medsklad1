import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const recognizeMedicationFromImage = async (base64Image: string, mimeType: string = 'image/jpeg') => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY не настроен');
  }

  const prompt = `
    Ты - эксперт-фармацевт. Посмотри на это изображение и определи медицинский препарат.
    Верни ТОЛЬКО валидный JSON со следующей структурой, без markdown разметки:
    {
      "name": "Название препарата (торговое)",
      "form": "Форма выпуска (таблетки, ампулы и т.д.)",
      "manufacturer": "Производитель",
      "confidence": "Уверенность в распознавании в процентах (число от 0 до 100)"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || '{}';
    return JSON.parse(text);
  } catch (error: any) {
    console.error('Ошибка Gemini API:', error);
    throw new Error('Ошибка при распознавании изображения');
  }
};
