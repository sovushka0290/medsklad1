import { Request, Response, NextFunction } from 'express';
import { exportService } from '../services/export.service';

export const exportController = {
  // Старые эндпоинты (для обратной совместимости с дашбордом)
  async exportTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const format = req.query.format as string || 'xlsx';
      if (format === 'pdf') {
        res.setHeader('Content-Disposition', 'attachment; filename="transactions.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        const doc = await exportService.generatePdfDoc('transactions', req.query);
        doc.pipe(res);
      } else {
        const workbook = await exportService.generateExcelWorkbook('transactions', req.query);
        res.setHeader('Content-Disposition', 'attachment; filename="transactions.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await workbook.xlsx.write(res);
        res.end();
      }
    } catch (error) {
      next(error);
    }
  },

  async exportInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const format = req.query.format as string || 'xlsx';
      if (format === 'pdf') {
        res.setHeader('Content-Disposition', 'attachment; filename="inventory.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        const doc = await exportService.generatePdfDoc('inventory', req.query);
        doc.pipe(res);
      } else {
        const workbook = await exportService.generateExcelWorkbook('inventory', req.query);
        res.setHeader('Content-Disposition', 'attachment; filename="inventory.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await workbook.xlsx.write(res);
        res.end();
      }
    } catch (error) {
      next(error);
    }
  },

  async export1C(req: Request, res: Response, next: NextFunction) {
    try {
      const json = await exportService.generate1CJson();
      res.setHeader('Content-Disposition', 'attachment; filename="1c_export.json"');
      res.setHeader('Content-Type', 'application/json');
      res.send(json);
    } catch (error) {
      next(error);
    }
  },

  async exportCabinets(req: Request, res: Response, next: NextFunction) {
    try {
      const format = req.query.format as string || 'xlsx';
      if (format === 'pdf') {
        res.setHeader('Content-Disposition', 'attachment; filename="cabinets.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        const doc = await exportService.generatePdfDoc('cabinets', req.query);
        doc.pipe(res);
      } else {
        const workbook = await exportService.generateExcelWorkbook('cabinets', req.query);
        res.setHeader('Content-Disposition', 'attachment; filename="cabinets.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await workbook.xlsx.write(res);
        res.end();
      }
    } catch (error) {
      next(error);
    }
  },

  async exportInventoryAct(req: Request, res: Response, next: NextFunction) {
    try {
      const format = req.query.format as string || 'xlsx';
      if (format === 'pdf') {
        res.setHeader('Content-Disposition', 'attachment; filename="inventory_act.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        const doc = await exportService.generatePdfDoc('inventory-act', req.query);
        doc.pipe(res);
      } else {
        const workbook = await exportService.generateExcelWorkbook('inventory-act', req.query);
        res.setHeader('Content-Disposition', 'attachment; filename="inventory_act.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        await workbook.xlsx.write(res);
        res.end();
      }
    } catch (error) {
      next(error);
    }
  },

  // Новые роуты: /export/excel, /export/csv, /export/pdf с параметром ?type=...
  async excelExport(req: Request, res: Response, next: NextFunction) {
    try {
      const type = (req.query.type as string) || 'inventory';
      // 🔐 SECURITY: Валидация типа экспорта
      const ALLOWED = ['transactions', 'inventory', 'cabinets', 'inventory-act'];
      if (!ALLOWED.includes(type)) {
        return res.status(400).json({ success: false, error: `Недопустимый тип экспорта: ${type}` });
      }
      const workbook = await exportService.generateExcelWorkbook(type, req.query);
      res.setHeader('Content-Disposition', `attachment; filename="${type}.xlsx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  },

  async csvExport(req: Request, res: Response, next: NextFunction) {
    try {
      const type = (req.query.type as string) || 'inventory';
      // 🔐 SECURITY: Валидация типа экспорта
      const ALLOWED = ['transactions', 'inventory', 'cabinets', 'inventory-act'];
      if (!ALLOWED.includes(type)) {
        return res.status(400).json({ success: false, error: `Недопустимый тип экспорта: ${type}` });
      }
      const workbook = await exportService.generateExcelWorkbook(type, req.query);
      res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
      res.setHeader('Content-Type', 'text/csv');
      await workbook.csv.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  },

  async pdfExport(req: Request, res: Response, next: NextFunction) {
    try {
      const type = (req.query.type as string) || 'inventory';
      // 🔐 SECURITY: Валидация типа экспорта
      const ALLOWED = ['transactions', 'inventory', 'cabinets', 'inventory-act'];
      if (!ALLOWED.includes(type)) {
        return res.status(400).json({ success: false, error: `Недопустимый тип экспорта: ${type}` });
      }
      res.setHeader('Content-Disposition', `attachment; filename="${type}.pdf"`);
      res.setHeader('Content-Type', 'application/pdf');
      const doc = await exportService.generatePdfDoc(type, req.query);
      doc.pipe(res);
    } catch (error) {
      next(error);
    }
  }
};
