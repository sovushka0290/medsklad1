import { Request, Response } from 'express';
import * as inventoryService from '../services/inventory.service';

export const startSession = async (req: Request, res: Response) => {
  try {
    const { locationId } = req.body;
    const userId = (req as any).user?.id;

    if (!locationId) return res.status(400).json({ error: 'Необходимо указать locationId' });

    const session = await inventoryService.startInventorySession(locationId, userId);
    res.status(201).json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getActive = async (req: Request, res: Response) => {
  try {
    const sessions = await inventoryService.getActiveSessions();
    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const scanItem = async (req: Request, res: Response) => {
  try {
    const sessionId = Number(req.params.id);
    const { barcode, quantityToAdd = 1 } = req.body;

    if (!barcode) return res.status(400).json({ error: 'Необходимо указать barcode' });

    const item = await inventoryService.scanInventoryItem(sessionId, barcode, quantityToAdd);
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const completeSession = async (req: Request, res: Response) => {
  try {
    const sessionId = Number(req.params.id);
    const session = await inventoryService.completeInventorySession(sessionId);
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
