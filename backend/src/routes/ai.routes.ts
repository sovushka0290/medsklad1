import { Router } from 'express';
import { recognizeImage } from '../controllers/ai.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/recognize', requireAuth, recognizeImage);

export default router;
