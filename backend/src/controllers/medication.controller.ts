import { Request, Response } from 'express';
import { medicationService } from '../services/medication.service';

export const medicationController = {
  async getMedications(req: Request, res: Response) {
    try {
      const barcode = req.query.barcode as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      const medications = await medicationService.getAllMedications(barcode, page, limit);
      res.json(medications);
    } catch (error) {
      console.error('Error fetching medications:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getInventory(req: Request, res: Response) {
    try {
      const inventory = await medicationService.getInventorySummary();
      res.json(inventory);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async searchMedications(req: Request, res: Response) {
    try {
      const q = (req.query.q as string) || '';
      const medications = await medicationService.searchMedications(q);
      res.json(medications);
    } catch (error) {
      console.error('Error searching medications:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async updateMedication(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { barcode } = req.body;
      if (!barcode) {
        return res.status(400).json({ error: 'Barcode is required' });
      }
      const updated = await medicationService.updateMedicationBarcode(id, barcode);
      res.json(updated);
    } catch (error) {
      console.error('Error updating medication barcode:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getLocations(req: Request, res: Response) {
    try {
      const locations = await medicationService.getLocations();
      res.json(locations);
    } catch (error) {
      console.error('Error fetching locations:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async getCritical(req: Request, res: Response) {
    try {
      const medications = await medicationService.getCriticalMedications();
      res.json(medications);
    } catch (error) {
      console.error('Error fetching critical medications:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};
