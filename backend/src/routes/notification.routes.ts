import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getOrCreateSettings,
  updateSettings,
  checkAndCreateNotifications,
  sendEmailNotification,
} from '../services/notification.service';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// GET /notifications — список последних 50 уведомлений
router.get('/', async (req: Request, res: Response) => {
  try {
    const onlyUnread = req.query.unread === 'true';
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });

    const notifications = await getUserNotifications(userId, onlyUnread);
    res.json({ data: notifications });
  } catch (error) {
    console.error('[notifications] GET /', error);
    res.status(500).json({ error: 'Ошибка получения уведомлений' });
  }
});

// GET /notifications/count — кол-во непрочитанных (для бейджа)
router.get('/count', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });

    const count = await getUnreadCount(userId);
    res.json({ count });
  } catch (error) {
    console.error('[notifications] GET /count', error);
    res.status(500).json({ error: 'Ошибка' });
  }
});

// PATCH /notifications/read — пометить прочитанными
// body: { ids?: number[] }  — если ids не передан → помечаем все
router.patch('/read', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });

    const { ids } = req.body as { ids?: number[] };
    if (ids && Array.isArray(ids) && ids.length > 0) {
      await markAsRead(userId, ids);
    } else {
      await markAllAsRead(userId);
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('[notifications] PATCH /read', error);
    res.status(500).json({ error: 'Ошибка' });
  }
});

// GET /notifications/settings — получить настройки
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });

    const settings = await getOrCreateSettings(userId);
    res.json({ data: settings });
  } catch (error) {
    console.error('[notifications] GET /settings', error);
    res.status(500).json({ error: 'Ошибка получения настроек' });
  }
});

// PUT /notifications/settings — обновить настройки
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Не авторизован' });

    const {
      criticalStockEnabled,
      deviationEnabled,
      expiringEnabled,
      deviationThreshold,
      emailEnabled,
      inAppEnabled,
      notifyEmail,
    } = req.body;

    // Валидация порога
    if (deviationThreshold !== undefined) {
      const pct = Number(deviationThreshold);
      if (isNaN(pct) || pct < 1 || pct > 200) {
        return res.status(400).json({ error: 'deviationThreshold должен быть от 1 до 200' });
      }
    }

    const settings = await updateSettings(userId, {
      criticalStockEnabled,
      deviationEnabled,
      expiringEnabled,
      deviationThreshold: deviationThreshold !== undefined ? Number(deviationThreshold) : undefined,
      emailEnabled,
      inAppEnabled,
      notifyEmail: notifyEmail || null,
    });
    res.json({ data: settings });
  } catch (error) {
    console.error('[notifications] PUT /settings', error);
    res.status(500).json({ error: 'Ошибка обновления настроек' });
  }
});

// POST /notifications/test — тестовое уведомление (только для ADMIN/MANAGER)
router.post('/test', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Не авторизован' });

    const { email } = req.body as { email?: string };
    const targetEmail = email || user.email;

    await sendEmailNotification(
      targetEmail,
      user.name ?? 'Руководитель',
      'Тестовое уведомление',
      'Система уведомлений МедСклад работает корректно. Это тестовое сообщение.'
    );
    res.json({ ok: true, sentTo: targetEmail });
  } catch (error: any) {
    console.error('[notifications] POST /test', error);
    res.status(500).json({ error: `Ошибка отправки: ${error.message}` });
  }
});

// POST /notifications/trigger — ручной запуск проверки (ADMIN only)
router.post('/trigger', async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }
  try {
    // Запускаем в фоне — не ждём
    checkAndCreateNotifications().catch(console.error);
    res.json({ ok: true, message: 'Проверка запущена в фоне' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка' });
  }
});

export default router;
