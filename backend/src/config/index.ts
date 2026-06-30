export const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'medsklad_default_secret_change_in_prod_2026',
  jwtExpiresIn: '12h',
  saltRounds: 12,
  apiKey: process.env.API_KEY, // Без fallback! Если не задан — API-ключ не работает
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 1000,
  },
  loginRateLimit: {
    windowMs: 1 * 60 * 1000, // 1 минута
    max: 5, // 5 попыток логина в минуту
  },
};
