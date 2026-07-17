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

export const recognizeMedicationFromImage = async (
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<MedicationRecognitionResult> => {
  const openaiApiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  if (!openaiApiKey) {
    throw new Error('Модуль ИИ не настроен: отсутствуют ключи API (OPENAI_API_KEY/GEMINI_API_KEY)');
  }

  const prompt = `Ты — эксперт-фармацевт с опытом работы в стоматологических клиниках Казахстана.
Внимательно изучи изображение медицинского препарата или расходного материала.

Извлеки следующую информацию из ТЕКСТА НА УПАКОВКЕ (OCR-распознавание):
- Торговое название препарата
- Форма выпуска (таблетки, ампулы, карпулы, флаконы, крем и т.д.)
- Производитель
- Серийный/лот номер (если виден)
- Срок годности (в формате YYYY-MM, если виден)
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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(text);

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
    console.error('[AI] Ошибка OpenAI API:', error?.message);
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
  const openaiApiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  if (!openaiApiKey) {
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

  try {
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

Формат вывода — строго JSON-объект следующего вида:
{
  "insights": [
    {
      "type": "DEFICIT" | "REALLOCATION" | "ANOMALY",
      "title": "Заголовок рекомендации",
      "description": "Описание с конкретными цифрами и фактами",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "actionable": "Конкретный шаг решения"
    }
  ]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(text);
    return parsed.insights || parsed;
  } catch (error: any) {
    console.error('[AI Dashboard Insights] Ошибка OpenAI API:', error?.message);
    return generateDashboardInsights({ ...data, criticalItems: data.criticalItems });
  }
};

