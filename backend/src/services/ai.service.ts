import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

export interface MedicationRecognitionResult {
  name: string;
  form?: string;
  manufacturer?: string;
  serialNumber?: string;
  expirationDate?: string;
  dosage?: string;
  confidence: number;
  ocrText?: string;
}

const MOCK_MEDS: MedicationRecognitionResult[] = [
  {
    name: 'Ультракаин Д-С Форте',
    form: 'раствор для инъекций',
    manufacturer: 'Sanofi',
    dosage: '1,7 мл/карпула',
    expirationDate: '2027-03',
    confidence: 94,
    ocrText: 'Ultracain D-S forte Articaine 40mg + Epinephrine 0.01mg'
  },
  {
    name: 'Септанест 4% с адреналином',
    form: 'карпула',
    manufacturer: 'Septodont',
    dosage: '1,7 мл',
    expirationDate: '2026-09',
    confidence: 91,
    ocrText: 'Septanest 4% Articaine Adrenaline 1:100000'
  },
  {
    name: 'Лидокаин 2%',
    form: 'раствор для инъекций',
    manufacturer: 'Эгис',
    dosage: '2 мл/ампула',
    expirationDate: '2026-12',
    confidence: 78, // Низкая уверенность — покажет предупреждение
    ocrText: 'Lidocaine hydrochloride 2% EGIS'
  },
  {
    name: 'Аргосульфан 2%',
    form: 'крем',
    manufacturer: 'Jelfa',
    expirationDate: '2027-06',
    confidence: 87,
    ocrText: 'Argosulfan cream 2% silver sulfathiazole'
  }
];

export const recognizeMedicationFromImage = async (
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<MedicationRecognitionResult> => {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[AI] GEMINI_API_KEY не настроен. Возвращаем mock-данные.');
    return MOCK_MEDS[Math.floor(Math.random() * MOCK_MEDS.length)];
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `Ты — эксперт-фармацевт с опытом работы в стоматологических клиниках Казахстана.
Внимательно изучи изображение медицинского препарата или расходного материала.

Извлеки следующую информацию из ТЕКСТА НА УПАКОВКЕ (OCR-распознавание):
- Торговое название препарата
- Форма выпуска (таблетки, ампулы, карпулы, флаконы, крем и т.д.)
- Производитель
- Серийный/лот номер (если виден)
- Срок годности (в формате MM/YYYY или YYYY-MM, если виден)
- Дозировка/концентрация

Верни ТОЛЬКО валидный JSON без markdown-разметки, строго в этом формате:
{
  "name": "Полное торговое название",
  "form": "Форма выпуска",
  "manufacturer": "Производитель",
  "serialNumber": "Серия/Лот (или null)",
  "expirationDate": "Срок годности в формате YYYY-MM (или null)",
  "dosage": "Дозировка/концентрация (или null)",
  "confidence": число от 0 до 100,
  "ocrText": "Весь текст который удалось распознать с упаковки"
}

Если изображение нечёткое или препарат не распознаётся — установи confidence < 50.`;

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
        responseMimeType: 'application/json',
        thinkingConfig: {
          thinkingBudget: 512
        }
      }
    });

    const text = response.text || '{}';

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Если JSON сломан — извлечём name из текста
      const nameMatch = text.match(/"name"\s*:\s*"([^"]+)"/);
      return {
        name: nameMatch?.[1] ?? 'Неизвестный препарат',
        confidence: 30,
        ocrText: text.substring(0, 200)
      };
    }

    // Нормализуем confidence
    let confidence = Number(parsed.confidence ?? 0);
    if (isNaN(confidence)) confidence = 0;
    if (confidence > 100) confidence = 100;
    if (confidence < 0) confidence = 0;

    return {
      name: parsed.name ?? 'Неизвестный препарат',
      form: parsed.form ?? undefined,
      manufacturer: parsed.manufacturer ?? undefined,
      serialNumber: parsed.serialNumber ?? undefined,
      expirationDate: parsed.expirationDate ?? undefined,
      dosage: parsed.dosage ?? undefined,
      confidence,
      ocrText: parsed.ocrText ?? undefined
    };
  } catch (error: any) {
    console.error('[AI] Ошибка Gemini API:', error?.message);
    throw new Error('Ошибка при распознавании изображения через ИИ');
  }
};
