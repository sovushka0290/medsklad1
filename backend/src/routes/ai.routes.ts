import { Router } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { recognizeImage } from '../controllers/ai.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { config } from '../config';

const router = Router();

// 🔐 SECURITY: Отдельный rate limit для AI (дорогие вызовы Gemini API)
const aiLimiter = rateLimit({
  windowMs: config.aiRateLimit.windowMs,
  max: config.aiRateLimit.max,
  message: { success: false, error: 'Превышен лимит AI-запросов (10/мин). Повторите позже.' },
});

// 🔐 SECURITY: Ограничение размера payload base64 Image до 2 МБ
router.post('/recognize', requireAuth, aiLimiter, express.json({ limit: '2mb' }), recognizeImage);

export default router;
