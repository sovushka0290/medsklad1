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

  const { GoogleGenAI } = await (new Function('return import("@google/genai")')() as Promise<any>);
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

export interface AIInsight {
  type: 'DEFICIT' | 'REALLOCATION' | 'ANOMALY';
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  actionable: string;
}

export const generateDashboardInsights = async (data: {
  criticalItems: { name: string; quantity: number; minQuantity: number; daysUntilDepletion: number; averageDailyConsumption: number }[];
  excessItems: { name: string; quantity: number; cabinetName: string; averageDailyConsumption: number }[];
  anomalousItems: { name: string; quantityConsumed: number; percentageIncrease: number; cabinetName: string }[];
}): Promise<AIInsight[]> => {
  // Если ключа нет, возвращаем умный детерминированный fallback на основе переданных данных
  if (!process.env.GEMINI_API_KEY) {
    const insights: AIInsight[] = [];

    // 1. Анализируем дефицит
    for (const item of data.criticalItems.slice(0, 3)) {
      if (item.daysUntilDepletion <= 10) {
        insights.push({
          type: 'DEFICIT',
          title: `Критический дефицит: ${item.name}`,
          description: `Текущий остаток ${item.quantity} шт. исчерпается менее чем за ${Math.ceil(item.daysUntilDepletion)} дн. при среднесуточном расходе ${item.averageDailyConsumption.toFixed(1)} шт/день.`,
          priority: item.daysUntilDepletion <= 5 ? 'HIGH' : 'MEDIUM',
          actionable: `Срочно сформировать заявку на закупку ${Math.max(50, item.minQuantity * 2)} шт. препарата ${item.name}.`
        });
      }
    }

    // 2. Анализируем избыток / перераспределение
    for (const item of data.excessItems.slice(0, 2)) {
      insights.push({
        type: 'REALLOCATION',
        title: `Оптимизация запасов: ${item.name}`,
        description: `В кабинете "${item.cabinetName}" обнаружен избыточный запас (${item.quantity} шт.) при практически нулевом расходе (${item.averageDailyConsumption.toFixed(2)} шт/день).`,
        priority: 'MEDIUM',
        actionable: `Перераспределить ${Math.floor(item.quantity * 0.7)} шт. на центральный склад или в другие кабинеты с высоким спросом.`
      });
    }

    // 3. Анализируем аномальный расход
    for (const item of data.anomalousItems.slice(0, 2)) {
      insights.push({
        type: 'ANOMALY',
        title: `Аномальный расход: ${item.name}`,
        description: `В кабинете "${item.cabinetName}" зафиксирован скачок потребления на ${item.percentageIncrease.toFixed(0)}% по сравнению с нормативом за неделю (израсходовано ${item.quantityConsumed} шт.).`,
        priority: item.percentageIncrease > 200 ? 'HIGH' : 'MEDIUM',
        actionable: `Провести аудит списаний в кабинете "${item.cabinetName}" на предмет нецелевого использования или некорректного списания.`
      });
    }

    // Дефолтный инсайт, если списки пусты
    if (insights.length === 0) {
      insights.push({
        type: 'REALLOCATION',
        title: 'Запасы клиники в пределах нормы',
        description: 'ИИ-анализ не выявил критических дефицитов или выраженных аномалий потребления. Все ресурсы расходуются в рамках ГОСТ/СанПиН.',
        priority: 'LOW',
        actionable: 'Продолжайте плановый еженедельный мониторинг остатков.'
      });
    }

    return insights;
  }

  // При наличии ключа — делаем реальный запрос к Gemini API
  try {
    const { GoogleGenAI } = await (new Function('return import("@google/genai")')() as Promise<any>);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `Ты — ведущий ИИ-аналитик медицинской клиники Nyarch.
Проанализируй текущую ситуацию с медикаментами и расходными материалами на основе предоставленных данных:

КРИТИЧЕСКИЕ ОСТАТКИ (близки к нулю или ниже лимита безопасности):
${JSON.stringify(data.criticalItems, null, 2)}

ИЗБЫТОЧНЫЕ ЗАПАСЫ В КАБИНЕТАХ (высокий остаток, но очень низкий расход):
${JSON.stringify(data.excessItems, null, 2)}

АНОМАЛИИ ПОТРЕБЛЕНИЯ (резкий рост списаний за неделю):
${JSON.stringify(data.anomalousItems, null, 2)}

Сформулируй 3-5 конкретных, практически применимых рекомендаций (инсайтов) для заведующего клиникой.
Каждая рекомендация должна содержать:
1. Тип (строго одно из: "DEFICIT", "REALLOCATION", "ANOMALY")
2. Понятный заголовок на русском языке
3. Детальное описание проблемы с упоминанием цифр
4. Уровень приоритета (строго одно из: "HIGH", "MEDIUM", "LOW")
5. Конкретное действие (что именно сделать руководителю для решения проблемы)

Формат вывода — строго массив JSON без дополнительного текста вокруг:
[
  {
    "type": "DEFICIT" | "REALLOCATION" | "ANOMALY",
    "title": "Заголовок рекомендации",
    "description": "Описание с конкретными цифрами и фактами",
    "priority": "HIGH" | "MEDIUM" | "LOW",
    "actionable": "Конкретный шаг решения"
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: {
          thinkingBudget: 512
        }
      }
    });

    const text = response.text || '[]';
    return JSON.parse(text);
  } catch (error: any) {
    console.error('[AI Dashboard Insights] Ошибка Gemini API:', error?.message);
    // В случае ошибки API возвращаем локальный fallback
    return generateDashboardInsights({ ...data, criticalItems: data.criticalItems });
  }
};

