import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { refreshController } from '../controllers/refresh.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { loginSchema } from '../validators/auth.validator';
import rateLimit from 'express-rate-limit';
import { config } from '../config';

const router = Router();

// Отдельный rate limiter для логина (КРИТ: защита от brute-force)
const loginLimiter = rateLimit({
  windowMs: config.loginRateLimit.windowMs,
  max: config.loginRateLimit.max,
  message: { success: false, error: 'Слишком много попыток входа, попробуйте через минуту' },
});

router.post('/auth/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/auth/refresh', refreshController);
router.get('/auth/me', authMiddleware, authController.me);

export default router;
