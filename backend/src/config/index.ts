// 🔐 SECURITY: Отказываем в запуске если JWT_SECRET не задан (fail-secure)
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('[CRITICAL] JWT_SECRET must be set in environment (min 32 chars). Refusing to start.');
}

const jwtRefreshSecret = process.env.REFRESH_TOKEN_SECRET || jwtSecret + '_refresh';

export const config = {
  port: process.env.PORT || 3000,
  jwtSecret,
  jwtExpiresIn: '30m',
  jwtRefreshSecret,
  jwtRefreshExpiresIn: '7d',
  saltRounds: 12,
  apiKey: process.env.API_KEY, // Без fallback! Если не задан — API-ключ не работает
  cors: {
    // 🔐 SECURITY: Запрещён wildcard '*' — только явно заданные origins
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o: string) => o.trim())
      : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 1000,
  },
  loginRateLimit: {
    windowMs: 1 * 60 * 1000, // 1 минута
    max: 5, // 5 попыток логина в минуту
  },
  aiRateLimit: {
    windowMs: 1 * 60 * 1000, // 1 минута
    max: 10, // 10 AI-запросов в минуту (дорогие вызовы Gemini)
  },
};

