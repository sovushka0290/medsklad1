import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Некорректный email адрес').max(255),
    password: z.string()
      .min(6, 'Пароль должен содержать минимум 6 символов')
      .max(128, 'Пароль слишком длинный'),
  }),
});
