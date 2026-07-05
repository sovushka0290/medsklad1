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

      if (!barcode || !name) {
        errors.push(`Строка ${i + 2}: Отсутствует штрихкод или название`);
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          // Ищем медикамент
          let medication = await tx.medication.findFirst({
            where: { barcodes: { has: barcode } }
          });

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
          } else {
             // Если название поменялось, мы можем обновить, но пока просто оставляем как есть
          }

          if (quantity > 0) {
            // Ищем партию на складе
            let batch = await tx.batch.findFirst({
              where: {
                medicationId: medication.id,
                locationId: mainStorage!.id
              }
            });

            if (batch) {
              await tx.batch.update({
                where: { id: batch.id },
                data: { quantity: batch.quantity + quantity }
              });
            } else {
              await tx.batch.create({
                data: {
                  medicationId: medication.id,
                  locationId: mainStorage!.id,
                  quantity
                }
              });
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
