// 🔐 Устанавливаем env vars ДО импорта config (fail-secure требует JWT_SECRET)
process.env.JWT_SECRET = 'test_jwt_secret_32_chars_min_length_ok';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret_32_chars_min_length';

// Мокаем prisma и getProcedureComparison
jest.mock('../src/lib/prisma', () => ({
  prisma: {
    transaction: { findMany: jest.fn() },
    batch: { findMany: jest.fn() },
    inventorySession: { findFirst: jest.fn() },
  }
}));

jest.mock('../src/services/procedure.service', () => ({
  getProcedureComparison: jest.fn()
}));

import { prisma } from '../src/lib/prisma';
import { getProcedureComparison } from '../src/services/procedure.service';
import { exportService } from '../src/services/export.service';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

describe('Export Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Should generate Excel workbook for transactions', async () => {
    const mockTxs = [
      {
        id: 1,
        type: 'INCOME',
        quantity: 100,
        quantityAfter: 150,
        createdAt: new Date(),
        medication: { name: 'Аспирин', barcodes: ['123'] },
        location: { name: 'Главный склад' },
        user: { name: 'Иван' }
      }
    ];

    (prisma.transaction.findMany as jest.Mock).mockResolvedValue(mockTxs);

    const workbook = await exportService.generateExcelWorkbook('transactions', {});
    expect(workbook).toBeInstanceOf(ExcelJS.Workbook);
    
    const sheet = workbook.getWorksheet('Транзакции');
    expect(sheet).toBeDefined();
    expect(sheet?.rowCount).toBeGreaterThanOrEqual(2); // Header + 1 Row
  });

  test('Should generate PDF document for inventory', async () => {
    const mockBatches = [
      {
        id: 1,
        quantity: 50,
        expirationDate: new Date(),
        medication: { name: 'Парацетамол', barcodes: ['456'], unit: 'уп.' },
        location: { name: 'Кабинет 1' }
      }
    ];

    (prisma.batch.findMany as jest.Mock).mockResolvedValue(mockBatches);

    const pdfDoc = await exportService.generatePdfDoc('inventory', {});
    expect(pdfDoc).toBeInstanceOf(PDFDocument);
  });

  test('Should generate 1C JSON structure', async () => {
    const mockTxs = [
      {
        id: 5,
        type: 'OUTFLOW',
        quantity: 10,
        createdAt: new Date('2026-07-06T00:00:00.000Z'),
        medication: { id: 2, name: 'Анальгин', barcodes: ['789'] },
        location: { name: 'Кабинет 2' }
      }
    ];

    (prisma.transaction.findMany as jest.Mock).mockResolvedValue(mockTxs);

    const jsonStr = await exportService.generate1CJson();
    const parsed = JSON.parse(jsonStr);

    expect(parsed).toHaveProperty('export_date');
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].operation_id).toBe(5);
    expect(parsed.data[0].location).toBe('Кабинет 2');
  });
});
