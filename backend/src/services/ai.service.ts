import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

export const recognizeMedicationFromImage = async (base64Image: string, mimeType: string = 'image/jpeg') => {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY не настроен. Возвращаем mock-данные для демонстрации.');
    
    // Препараты для демонстрации различных сценариев работы интерфейса
    const mockMeds = [
      { name: "Аспирин 500мг", form: "таблетки", manufacturer: "Bayer", confidence: 95 },
      { name: "Ибупрофен 400мг", form: "капсулы", manufacturer: "Reckitt Benckiser", confidence: 92 },
      { name: "Амоксициллин 500мг", form: "таблетки", manufacturer: "Sandoz", confidence: 88 },
      { name: "Лидокаин 2%", form: "раствор для инъекций", manufacturer: "Egis", confidence: 75 } // Этот вызовет предупреждение о низкой уверенности ИИ (< 80%)
    ];
    
    const randomIndex = Math.floor(Math.random() * mockMeds.length);
    return mockMeds[randomIndex];
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
