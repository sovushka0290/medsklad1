import xlsx from 'xlsx';
import { prisma } from '../lib/prisma';
import { TransactionType } from '@prisma/client';

export const importService = {
  async importExcel(buffer: Buffer, userId: number) {
    // Парсим Excel/CSV файл
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Преобразуем лист в JSON (массив объектов)
    const data = xlsx.utils.sheet_to_json(sheet) as any[];

    if (!data || data.length === 0) {
      throw new Error('Файл пуст или не содержит данных');
    }

    // 🔐 SECURITY: Защита от DoS через огромные файлы (10K строк максимум)
    if (data.length > 10000) {
      throw new Error('Слишком много строк (макс. 10 000). Разбейте файл на части.');
    }

    // Ищем Главный склад
    let mainStorage = await prisma.location.findFirst({
      where: { type: 'MAIN_STORAGE' }
    });

    if (!mainStorage) {
      // Если по какой-то причине его нет, создаем
      mainStorage = await prisma.location.create({
        data: { name: 'Главный склад', type: 'MAIN_STORAGE' }
      });
    }

    // Собираем все уникальные штрихкоды из Excel для пакетной загрузки
    const barcodesInExcel: string[] = [];
    for (const row of data) {
      const barcode = (row['Штрихкод'] || row['Barcode'] || row['barcode'])?.toString().trim();
      if (barcode) {
        barcodesInExcel.push(barcode);
      }
    }

    // Пакетная загрузка существующих медикаментов со штрихкодами и их партий на главном складе
    const existingMeds = await prisma.medication.findMany({
      where: {
        barcodes: {
          hasSome: barcodesInExcel
        }
      },
      include: {
        batches: {
          where: { locationId: mainStorage.id }
        }
      }
    });

    // Строим кэш-таблицы в оперативной памяти для O(1) поиска
    const medMap = new Map<string, any>();
    for (const med of existingMeds) {
      for (const bc of med.barcodes) {
        medMap.set(bc, med);
      }
    }

    const batchMap = new Map<number, any>();
    for (const med of existingMeds) {
      if (med.batches && med.batches.length > 0) {
        batchMap.set(med.id, med.batches[0]);
      }
    }

    let successCount = 0;
    const errors: string[] = [];

    // Обрабатываем каждую строку отдельно, чтобы одна ошибка не валила весь импорт
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      // Поддерживаем разные варианты названий колонок
      const barcode = (row['Штрихкод'] || row['Barcode'] || row['barcode'])?.toString().trim();
      const name = (row['Название'] || row['Наименование'] || row['Name'] || row['name'])?.toString().trim();
      const qtyRaw = row['Количество'] || row['Кол-во'] || row['Quantity'] || row['quantity'];
      const quantity = parseInt(qtyRaw) || 0;
      const mnn = (row['МНН'] || row['MNN'])?.toString().trim();
      const group = (row['Группа'] || row['Group'])?.toString().trim();
      const priceRaw = row['Цена'] || row['Стоимость'] || row['Price'] || row['price'];
      const price = parseFloat(priceRaw) || 0.0;

      if (!barcode || !name) {
        errors.push(`Строка ${i + 2}: Отсутствует штрихкод или название`);
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          // Ищем медикамент в локальном кэше
          let medication = medMap.get(barcode);

          // Создаем если нет
          if (!medication) {
            medication = await tx.medication.create({
              data: {
                name,
                barcodes: [barcode],
                mnn,
                group,
                minQuantity: 10
              }
            });
            // Обновляем кэш
            medMap.set(barcode, medication);
          }

          if (quantity > 0) {
            // Ищем партию на складе в локальном кэше
            let batch = batchMap.get(medication.id);

            if (!batch) {
              // Если в локальном кэше нет, проверяем в бд (на случай параллельного добавления)
              batch = await tx.batch.findFirst({
                where: {
                  medicationId: medication.id,
                  locationId: mainStorage!.id
                }
              });
            }

            if (batch) {
              const updatedBatch = await tx.batch.update({
                where: { id: batch.id },
                data: { 
                  quantity: batch.quantity + quantity,
                  ...(price > 0 && { price })
                }
              });
              // Обновляем кэш
              batchMap.set(medication.id, updatedBatch);
            } else {
              const newBatch = await tx.batch.create({
                data: {
                  medicationId: medication.id,
                  locationId: mainStorage!.id,
                  quantity,
                  price: price > 0 ? price : null
                }
              });
              // Обновляем кэш
              batchMap.set(medication.id, newBatch);
            }

            // Создаем транзакцию Прихода
            await tx.transaction.create({
              data: {
                type: TransactionType.INCOME,
                quantity,
                medicationId: medication.id,
                locationId: mainStorage!.id,
                userId,
                reason: 'Импорт из Excel/1C'
              }
            });
          }
        });
        
        successCount++;
      } catch (err: any) {
        errors.push(`Строка ${i + 2} (${name}): ${err.message}`);
      }
    }

    return {
      total: data.length,
      successCount,
      errors
    };
  }
};
