import { prisma } from '../lib/prisma';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { getProcedureComparison, getLogsJournal } from './procedure.service';

// Пути к кириллическим шрифтам (локально сгруппированным)
const REGULAR_FONT_PATH = path.join(__dirname, '..', '..', 'assets', 'fonts', 'Roboto-Regular.ttf');
const BOLD_FONT_PATH = path.join(__dirname, '..', '..', 'assets', 'fonts', 'Roboto-Bold.ttf');

/**
 * Инициализирует PDF-документ с поддержкой кириллицы.
 */
function createPDFDoc(): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  
  if (process.env.NODE_ENV !== 'test' && fs.existsSync(REGULAR_FONT_PATH)) {
    doc.registerFont('Roboto', REGULAR_FONT_PATH);
    doc.font('Roboto');
  }
  if (process.env.NODE_ENV !== 'test' && fs.existsSync(BOLD_FONT_PATH)) {
    doc.registerFont('Roboto-Bold', BOLD_FONT_PATH);
  }
  
  return doc;
}

/**
 * Устанавливает шрифт Bold или регулярный.
 */
function setPdfFont(doc: PDFKit.PDFDocument, bold = false) {
  if (process.env.NODE_ENV !== 'test' && bold && fs.existsSync(BOLD_FONT_PATH)) {
    doc.font('Roboto-Bold');
  } else if (process.env.NODE_ENV !== 'test' && fs.existsSync(REGULAR_FONT_PATH)) {
    doc.font('Roboto');
  } else {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
  }
}

export const exportService = {
  // --- 1. EXCEL/CSV GENERATION ---

  async generateExcelWorkbook(type: string, queryParams: any): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    
    if (type === 'transactions') {
      const sheet = workbook.addWorksheet('Транзакции');
      sheet.columns = [
        { header: 'Дата', key: 'date', width: 20 },
        { header: 'Тип', key: 'type', width: 15 },
        { header: 'Препарат', key: 'medication', width: 30 },
        { header: 'Штрихкоды', key: 'barcodes', width: 20 },
        { header: 'Локация (Откуда/Где)', key: 'location', width: 20 },
        { header: 'Кол-во', key: 'qty', width: 10 },
        { header: 'Остаток после', key: 'qtyAfter', width: 15 },
        { header: 'Сотрудник', key: 'user', width: 20 },
        { header: 'Номер партии', key: 'batchNumber', width: 15 },
        { header: 'Серийный №', key: 'serialNumber', width: 15 },
        { header: 'Срок годности', key: 'expDate', width: 15 },
        { header: 'Цена', key: 'price', width: 12 },
        { header: 'Поставщик', key: 'supplier', width: 20 },
        { header: 'Цель выдачи', key: 'purpose', width: 20 },
        { header: 'Получатель', key: 'receiver', width: 20 },
        { header: 'Кабинет-получатель', key: 'targetCabinet', width: 20 },
        { header: 'Причина', key: 'reason', width: 25 },
      ];

      const [transactions, locations] = await Promise.all([
        prisma.transaction.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            medication: { select: { name: true, barcodes: true } },
            location: { select: { name: true } },
            user: { select: { name: true } },
          },
        }),
        prisma.location.findMany(),
      ]);

      transactions.forEach(tx => {
        const targetCabinet = tx.targetLocationId 
          ? locations.find(l => l.id === tx.targetLocationId)?.name || '' 
          : '';
        sheet.addRow({
          date: tx.createdAt.toLocaleString('ru-RU'),
          type: tx.type,
          medication: tx.medication.name,
          barcodes: tx.medication.barcodes.join(', '),
          location: tx.location.name,
          qty: tx.quantity,
          qtyAfter: tx.quantityAfter,
          user: tx.user?.name || '',
          batchNumber: tx.batchNumber || '',
          serialNumber: tx.serialNumber || '',
          expDate: tx.expirationDate ? tx.expirationDate.toISOString().split('T')[0] : '',
          price: tx.price || '',
          supplier: tx.supplier || '',
          purpose: tx.purpose || '',
          receiver: tx.receiver || '',
          targetCabinet,
          reason: tx.reason || '',
        });
      });
    }
    
    else if (type === 'write-off-act') {
      const sheet = workbook.addWorksheet('Акт списания');
      sheet.columns = [
        { header: 'Параметр', key: 'param', width: 25 },
        { header: 'Значение', key: 'value', width: 45 },
      ];

      const transactionId = queryParams.transactionId ? Number(queryParams.transactionId) : null;
      let transaction;
      if (transactionId) {
        transaction = await prisma.transaction.findUnique({
          where: { id: transactionId },
          include: { medication: true, location: true, user: true },
        });
      } else {
        transaction = await prisma.transaction.findFirst({
          where: { type: 'WRITE_OFF' },
          orderBy: { createdAt: 'desc' },
          include: { medication: true, location: true, user: true },
        });
      }

      if (transaction) {
        sheet.addRow({ param: 'Акт №', value: transaction.id });
        sheet.addRow({ param: 'Дата составления', value: transaction.createdAt.toLocaleString('ru-RU') });
        sheet.addRow({ param: 'Локация списания', value: transaction.location.name });
        sheet.addRow({ param: 'Ответственное лицо', value: transaction.user?.name || '' });
        sheet.addRow({ param: 'Препарат', value: transaction.medication.name });
        sheet.addRow({ param: 'МНН', value: transaction.medication.mnn || '' });
        sheet.addRow({ param: 'Количество', value: `${transaction.quantity} ${transaction.medication.unit || 'шт.'}` });
        sheet.addRow({ param: 'Причина списания', value: transaction.reason || '' });
      }
    }
    
    else if (type === 'inventory') {
      const sheet = workbook.addWorksheet('Остатки');
      sheet.columns = [
        { header: 'Препарат', key: 'medication', width: 30 },
        { header: 'Штрихкоды', key: 'barcodes', width: 20 },
        { header: 'Ед. изм.', key: 'unit', width: 10 },
        { header: 'Локация', key: 'location', width: 20 },
        { header: 'Кол-во', key: 'qty', width: 10 },
        { header: 'Срок годности', key: 'exp', width: 15 },
      ];

      const batches = await prisma.batch.findMany({
        include: {
          medication: { select: { name: true, barcodes: true, unit: true } },
          location: { select: { name: true } },
        },
      });

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
    } 
    
    else if (type === 'cabinets') {
      const sheet = workbook.addWorksheet('Кабинеты');
      sheet.columns = [
        { header: 'Кабинет / Процедура', key: 'cabinet', width: 40 },
        { header: 'Препарат', key: 'medication', width: 30 },
        { header: 'Факт', key: 'fact', width: 15 },
        { header: 'Норматив', key: 'norm', width: 15 },
        { header: 'Нарушение', key: 'violation', width: 15 },
      ];

      const comparisons = await getProcedureComparison();
      comparisons.forEach(comp => {
        comp.usage.forEach(use => {
          sheet.addRow({
            cabinet: `${comp.cabinetName} (${comp.procedureName})`,
            medication: use.medicationName,
            fact: use.actualTotal,
            norm: use.expectedTotal,
            violation: use.isViolation ? 'Да' : 'Нет',
          });
        });
      });
    } 
    
    else if (type === 'inventory-act') {
      const sheet = workbook.addWorksheet('Акт');
      sheet.columns = [
        { header: 'Препарат', key: 'medication', width: 30 },
        { header: 'Ожидалось', key: 'expected', width: 15 },
        { header: 'Фактически', key: 'actual', width: 15 },
        { header: 'Разница', key: 'diff', width: 15 },
      ];

      const sessionId = queryParams.sessionId ? Number(queryParams.sessionId) : null;
      let session;
      if (sessionId) {
        session = await prisma.inventorySession.findUnique({
          where: { id: sessionId },
          include: { items: { include: { medication: true } } },
        });
      } else {
        session = await prisma.inventorySession.findFirst({
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { medication: true } } },
        });
      }

      if (session) {
        session.items.forEach(item => {
          sheet.addRow({
            medication: item.medication.name,
            expected: item.expectedQuantity,
            actual: item.actualQuantity ?? 0,
            diff: item.difference ?? -(item.expectedQuantity),
          });
        });
      }
    }

    // Ф-23: Журнал расхода по процедурам (кабинет, сотрудник, процедура)
    else if (type === 'procedure-journal') {
      const sheet = workbook.addWorksheet('Журнал процедур');
      sheet.columns = [
        { header: 'Дата', key: 'date', width: 20 },
        { header: 'Кабинет', key: 'location', width: 25 },
        { header: 'Сотрудник', key: 'user', width: 25 },
        { header: 'Должность', key: 'role', width: 15 },
        { header: 'Процедура', key: 'procedure', width: 30 },
        { header: 'Стандарт', key: 'standard', width: 20 },
        { header: 'Кол-во манипул.', key: 'quantity', width: 15 },
        { header: 'Примечание', key: 'note', width: 30 },
      ];

      // Apply header style
      sheet.getRow(1).eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      });

      const result = await getLogsJournal({
        locationId: queryParams.locationId ? Number(queryParams.locationId) : undefined,
        procedureId: queryParams.procedureId ? Number(queryParams.procedureId) : undefined,
        from: queryParams.from,
        to: queryParams.to,
        limit: 5000,
        page: 1,
      });

      result.data.forEach(log => {
        const row = sheet.addRow({
          date: new Date(log.createdAt).toLocaleString('ru-RU'),
          location: log.location.name,
          user: log.user.name || '-',
          role: log.user.role,
          procedure: log.procedure.name,
          standard: log.procedure.standard || '-',
          quantity: log.quantity,
          note: log.note || '',
        });
        // Highlight row background on note
        if (log.note) {
          row.getCell('note').font = { italic: true, color: { argb: 'FF64748B' } };
        }
      });
    }

    return workbook;
  },

  // --- 2. PDF GENERATION ---

  async generatePdfDoc(type: string, queryParams: any): Promise<PDFKit.PDFDocument> {
    const doc = createPDFDoc();

    if (type === 'transactions') {
      setPdfFont(doc, true);
      doc.fontSize(16).text('Журнал операций склада', { align: 'center' });
      doc.moveDown();

      const [transactions, locations] = await Promise.all([
        prisma.transaction.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            medication: { select: { name: true, unit: true } },
            location: { select: { name: true } },
            user: { select: { name: true } },
          },
        }),
        prisma.location.findMany(),
      ]);

      setPdfFont(doc, false);
      transactions.forEach((tx, idx) => {
        const targetCabinet = tx.targetLocationId 
          ? locations.find(l => l.id === tx.targetLocationId)?.name || '' 
          : '';
        doc.fontSize(10).text(`${idx + 1}. ${tx.createdAt.toLocaleString('ru-RU')} — [${tx.type}] — ${tx.medication.name}`);
        
        let details = `   Кол-во: ${tx.quantity} ${tx.medication.unit || 'шт.'}, Остаток: ${tx.quantityAfter}, Локация: ${tx.location.name}`;
        if (tx.batchNumber) details += `, Парт: ${tx.batchNumber}`;
        if (tx.serialNumber) details += `, Сер.№: ${tx.serialNumber}`;
        if (tx.price) details += `, Цена: ${tx.price}₸`;
        if (tx.supplier) details += `, Пост: ${tx.supplier}`;
        doc.text(details);

        if (tx.purpose || tx.receiver || targetCabinet) {
          let dest = `   Цель: ${tx.purpose || '-'}`;
          if (tx.receiver) dest += `, Получатель: ${tx.receiver}`;
          if (targetCabinet) dest += `, Кабинет: ${targetCabinet}`;
          doc.text(dest);
        }

        doc.text(`   Исполнитель: ${tx.user?.name || '-'}, Причина/Комментарий: ${tx.reason || '-'}`);
        doc.moveDown(0.5);
      });
    } 
    
    else if (type === 'write-off-act') {
      setPdfFont(doc, true);
      doc.fontSize(16).text('Акт списания медикаментов', { align: 'center' });
      doc.moveDown();

      const transactionId = queryParams.transactionId ? Number(queryParams.transactionId) : null;
      let transaction;
      if (transactionId) {
        transaction = await prisma.transaction.findUnique({
          where: { id: transactionId },
          include: { medication: true, location: true, user: true },
        });
      } else {
        transaction = await prisma.transaction.findFirst({
          where: { type: 'WRITE_OFF' },
          orderBy: { createdAt: 'desc' },
          include: { medication: true, location: true, user: true },
        });
      }

      setPdfFont(doc, false);
      if (transaction) {
        doc.fontSize(11).text(`Акт № ${transaction.id}`);
        doc.text(`Дата составления: ${transaction.createdAt.toLocaleString('ru-RU')}`);
        doc.text(`Локация списания: ${transaction.location.name}`);
        doc.text(`Ответственное лицо: ${transaction.user?.name || 'Не указано'}`);
        doc.moveDown();

        setPdfFont(doc, true);
        doc.text('Сведения о списываемых ценностях:', { underline: true });
        doc.moveDown(0.5);
        setPdfFont(doc, false);

        doc.fontSize(10).text(`1. Препарат: ${transaction.medication.name}`);
        if (transaction.medication.mnn) {
          doc.text(`   МНН: ${transaction.medication.mnn}`);
        }
        if (transaction.batchNumber) {
          doc.text(`   Номер партии: ${transaction.batchNumber}`);
        }
        if (transaction.serialNumber) {
          doc.text(`   Серийный номер: ${transaction.serialNumber}`);
        }
        doc.text(`   Количество к списанию: ${transaction.quantity} ${transaction.medication.unit || 'шт.'}`);
        doc.text(`   Причина списания: ${transaction.reason || 'Причина не указана'}`);
        
        doc.moveDown(2);
        doc.text('Списание произведено в присутствии комиссии:');
        doc.moveDown();
        doc.text('Член комиссии: ________________________ (подпись)');
        doc.text('Член комиссии: ________________________ (подпись)');
      } else {
        doc.text('Операции списания не найдены.');
      }
    }
    
    else if (type === 'inventory') {
      setPdfFont(doc, true);
      doc.fontSize(16).text('Сводный отчет по остаткам', { align: 'center' });
      doc.moveDown();

      const batches = await prisma.batch.findMany({
        include: {
          medication: { select: { name: true, barcodes: true, unit: true } },
          location: { select: { name: true } },
        },
      });

      setPdfFont(doc, false);
      batches.forEach((b, idx) => {
        doc.fontSize(10).text(`${idx + 1}. ${b.medication.name} (Локация: ${b.location.name})`);
        doc.text(`   Текущий остаток: ${b.quantity} ${b.medication.unit || 'шт.'}, Штрихкоды: ${b.medication.barcodes.join(', ')}`);
        if (b.expirationDate) {
          doc.text(`   Срок годности: ${b.expirationDate.toISOString().split('T')[0]}`);
        }
        doc.moveDown(0.5);
      });
    } 
    
    else if (type === 'cabinets') {
      setPdfFont(doc, true);
      doc.fontSize(16).text('Отчёт по расходу кабинетов', { align: 'center' });
      doc.moveDown();

      const comparisons = await getProcedureComparison();

      setPdfFont(doc, false);
      comparisons.forEach((comp, idx) => {
        setPdfFont(doc, true);
        doc.fontSize(11).text(`${idx + 1}. Кабинет: ${comp.cabinetName} (Процедура: ${comp.procedureName}, Выполнено: ${comp.timesPerformed})`);
        setPdfFont(doc, false);
        
        comp.usage.forEach(use => {
          doc.fontSize(9).text(`   • Препарат: ${use.medicationName}`);
          doc.text(`     Использовано: ${use.actualTotal}, Норматив: ${use.expectedTotal} (Отклонение: ${use.tolerancePercent}%)`);
          if (use.isViolation) {
            doc.fillColor('red').text(`     Внимание: Превышен лимит отклонения!`).fillColor('black');
          }
        });
        doc.moveDown(0.5);
      });
    } 
    
    else if (type === 'inventory-act') {
      setPdfFont(doc, true);
      doc.fontSize(16).text('Акт инвентаризации', { align: 'center' });
      doc.moveDown();

      const sessionId = queryParams.sessionId ? Number(queryParams.sessionId) : null;
      let session;
      if (sessionId) {
        session = await prisma.inventorySession.findUnique({
          where: { id: sessionId },
          include: { items: { include: { medication: true } }, location: true, user: true },
        });
      } else {
        session = await prisma.inventorySession.findFirst({
          orderBy: { createdAt: 'desc' },
          include: { items: { include: { medication: true } }, location: true, user: true },
        });
      }

      setPdfFont(doc, false);
      if (session) {
        doc.fontSize(11).text(`Дата создания: ${session.createdAt.toLocaleString('ru-RU')}`);
        doc.text(`Локация: ${session.location.name}`);
        doc.text(`Проверяющий: ${session.user.name}`);
        doc.text(`Статус: ${session.status}`);
        doc.moveDown();

        setPdfFont(doc, true);
        doc.text('Результаты проверки:', { underline: true });
        doc.moveDown(0.5);
        setPdfFont(doc, false);

        session.items.forEach((item, idx) => {
          const diff = item.difference ?? -(item.expectedQuantity);
          const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
          doc.fontSize(10).text(`${idx + 1}. Препарат: ${item.medication.name}`);
          doc.text(`   Ожидалось: ${item.expectedQuantity}, Фактически: ${item.actualQuantity ?? 0} (Разница: ${diffStr})`);
          doc.moveDown(0.3);
        });

        doc.moveDown();
        doc.text('Подписи членов комиссии: ________________________');
      } else {
        doc.text('Сессии инвентаризации не найдены.');
      }
    }
    
    else if (type === 'procedure-journal') {
      setPdfFont(doc, true);
      doc.fontSize(16).text('Журнал использования медикаментов по процедурам', { align: 'center' });
      doc.moveDown();

      const result = await getLogsJournal({
        locationId: queryParams.locationId ? Number(queryParams.locationId) : undefined,
        procedureId: queryParams.procedureId ? Number(queryParams.procedureId) : undefined,
        from: queryParams.from,
        to: queryParams.to,
        limit: 5000,
        page: 1,
      });

      setPdfFont(doc, false);
      doc.fontSize(10);
      result.data.forEach((log, idx) => {
        setPdfFont(doc, true);
        doc.text(`${idx + 1}. Дата: ${new Date(log.createdAt).toLocaleString('ru-RU')}`);
        setPdfFont(doc, false);
        doc.text(`   Кабинет: ${log.location.name}`);
        doc.text(`   Процедура: ${log.procedure.name} ${log.procedure.standard ? `(${log.procedure.standard})` : ''}`);
        doc.text(`   Количество выполненных манипуляций: ${log.quantity}`);
        doc.text(`   Исполнитель: ${log.user.name} (${log.user.role})`);
        if (log.note) {
          doc.text(`   Примечание: ${log.note}`);
        }
        doc.moveDown(0.5);
      });
      if (result.data.length === 0) {
        doc.text('Записей о проведении процедур за выбранный период не найдено.');
      }
    }

    doc.end();
    return doc;
  },

  // --- 3. 1C INTEGRATION (JSON) ---

  async generate1CJson(): Promise<string> {
    const transactions = await prisma.transaction.findMany({
      where: { type: { in: ['INCOME', 'OUTFLOW', 'WRITE_OFF'] } },
      orderBy: { createdAt: 'desc' },
      include: {
        medication: { select: { id: true, name: true, barcodes: true } },
        location: { select: { name: true } },
      },
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

    return JSON.stringify({ export_date: new Date().toISOString(), data: payload }, null, 2);
  }
};
