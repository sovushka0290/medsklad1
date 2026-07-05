import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export const exportController = {
  // Экспорт транзакций (Журнал операций)
  async exportTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const format = req.query.format as string || 'xlsx';
      const transactions = await prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          medication: { select: { id: true, name: true, barcodes: true, unit: true } },
          location: { select: { id: true, name: true } },
          user: { select: { id: true, name: true } },
        },
      });

      if (format === 'pdf') {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Disposition', 'attachment; filename="transactions.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);

        doc.fontSize(16).text('Журнал операций', { align: 'center' });
        doc.moveDown();

        transactions.forEach((tx, idx) => {
          doc.fontSize(10).text(`${idx + 1}. ${tx.createdAt.toLocaleString('ru-RU')} - ${tx.type} - ${tx.medication.name}`);
          doc.text(`   Кол-во: ${tx.quantity}, Остаток после: ${tx.quantityAfter}, Локация: ${tx.location.name}`);
          doc.text(`   Сотрудник: ${tx.user?.name}, Причина: ${tx.reason || '-'}`);
          doc.moveDown(0.5);
        });

        doc.end();
      } else {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Транзакции');
        sheet.columns = [
          { header: 'Дата', key: 'date', width: 20 },
          { header: 'Тип', key: 'type', width: 15 },
          { header: 'Препарат', key: 'medication', width: 30 },
          { header: 'Штрихкоды', key: 'barcodes', width: 20 },
          { header: 'Локация', key: 'location', width: 20 },
          { header: 'Кол-во', key: 'qty', width: 10 },
          { header: 'Остаток после', key: 'qtyAfter', width: 15 },
          { header: 'Сотрудник', key: 'user', width: 20 },
        ];

        transactions.forEach(tx => {
          sheet.addRow({
            date: tx.createdAt.toLocaleString('ru-RU'),
            type: tx.type,
            medication: tx.medication.name,
            barcodes: tx.medication.barcodes.join(', '),
            location: tx.location.name,
            qty: tx.quantity,
            qtyAfter: tx.quantityAfter,
            user: tx.user?.name || '',
          });
        });

        res.setHeader('Content-Disposition', 'attachment; filename="transactions.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await workbook.xlsx.write(res);
        res.end();
      }
    } catch (error) {
      next(error);
    }
  },

  // Экспорт остатков
  async exportInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const format = req.query.format as string || 'xlsx';
      const batches = await prisma.batch.findMany({
        include: {
          medication: { select: { id: true, name: true, barcodes: true, unit: true } },
          location: { select: { id: true, name: true } },
        },
      });

      if (format === 'pdf') {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Disposition', 'attachment; filename="inventory.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);

        doc.fontSize(16).text('Сводный отчет по складу', { align: 'center' });
        doc.moveDown();

        batches.forEach((b, idx) => {
          doc.fontSize(10).text(`${idx + 1}. ${b.medication.name} (Штрихкоды: ${b.medication.barcodes.join(', ')})`);
          doc.text(`   Кол-во: ${b.quantity} ${b.medication.unit || 'шт.'}, Локация: ${b.location.name}`);
          if (b.expirationDate) {
            doc.text(`   Срок годности: ${b.expirationDate.toISOString().split('T')[0]}`);
          }
          doc.moveDown(0.5);
        });

        doc.end();
      } else {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Остатки');
        sheet.columns = [
          { header: 'Препарат', key: 'medication', width: 30 },
          { header: 'Штрихкоды', key: 'barcodes', width: 20 },
          { header: 'Ед. изм.', key: 'unit', width: 10 },
          { header: 'Локация', key: 'location', width: 20 },
          { header: 'Кол-во', key: 'qty', width: 10 },
          { header: 'Срок годности', key: 'exp', width: 15 },
        ];

        batches.forEach(b => {
          sheet.addRow({
            medication: b.medication.name,
            barcodes: b.medication.barcodes.join(', '),
            unit: b.medication.unit || '',
            location: b.location.name,
            qty: b.quantity,
            exp: b.expirationDate ? b.expirationDate.toISOString().split('T')[0] : '',
          });
        });

        res.setHeader('Content-Disposition', 'attachment; filename="inventory.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await workbook.xlsx.write(res);
        res.end();
      }
    } catch (error) {
      next(error);
    }
  },

  // Экспорт для 1С (JSON)
  async export1C(req: Request, res: Response, next: NextFunction) {
    try {
      const transactions = await prisma.transaction.findMany({
        where: { type: { in: ['INCOME', 'OUTFLOW', 'WRITE_OFF'] } },
        orderBy: { createdAt: 'desc' },
        include: { medication: { select: { id: true, name: true, barcodes: true } }, location: { select: { id: true, name: true } } },
      });

      const payload = transactions.map(tx => ({
        operation_id: tx.id,
        operation_type: tx.type,
        date: tx.createdAt.toISOString(),
        items: [
          {
            medication_id: tx.medication.id,
            medication_name: tx.medication.name,
            barcodes: tx.medication.barcodes,
            quantity: tx.quantity,
          }
        ],
        location: tx.location.name,
      }));

      res.setHeader('Content-Disposition', 'attachment; filename="1c_export.json"');
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ export_date: new Date().toISOString(), data: payload }, null, 2));
    } catch (error) {
      next(error);
    }
  },

  // Экспорт по кабинетам
  async exportCabinets(req: Request, res: Response, next: NextFunction) {
    try {
      const format = req.query.format as string || 'xlsx';
      
      if (format === 'pdf') {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Disposition', 'attachment; filename="cabinets.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);
        doc.fontSize(16).text('Отчёт по кабинетам', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text('Данные по расходу кабинетов (Сгенерировано автоматически)');
        doc.end();
      } else {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Кабинеты');
        sheet.columns = [
          { header: 'Кабинет', key: 'cabinet', width: 30 },
          { header: 'Факт', key: 'fact', width: 15 },
          { header: 'Норматив', key: 'norm', width: 15 },
        ];
        res.setHeader('Content-Disposition', 'attachment; filename="cabinets.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await workbook.xlsx.write(res);
        res.end();
      }
    } catch (error) {
      next(error);
    }
  },

  // Акт инвентаризации
  async exportInventoryAct(req: Request, res: Response, next: NextFunction) {
    try {
      const format = req.query.format as string || 'xlsx';
      
      if (format === 'pdf') {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Disposition', 'attachment; filename="inventory_act.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        doc.pipe(res);
        doc.fontSize(16).text('Акт инвентаризации', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text('Подписи членов комиссии: _________________');
        doc.end();
      } else {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Акт');
        sheet.columns = [
          { header: 'Препарат', key: 'medication', width: 30 },
          { header: 'Ожидалось', key: 'expected', width: 15 },
          { header: 'Фактически', key: 'actual', width: 15 },
          { header: 'Разница', key: 'diff', width: 15 },
        ];
        res.setHeader('Content-Disposition', 'attachment; filename="inventory_act.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await workbook.xlsx.write(res);
        res.end();
      }
    } catch (error) {
      next(error);
    }
  }
};
