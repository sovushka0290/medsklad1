import { prisma } from '../lib/prisma';
import { NotificationType, Role, Prisma } from '@prisma/client';
import nodemailer from 'nodemailer';

// ─── Email транспорт ──────────────────────────────────────────────────────────

const getMailTransport = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// ─── Дедупликация: не создавать дубль уведомления за последние 24 часа ───────

async function isDuplicate(
  userId: number,
  type: NotificationType,
  meta: Record<string, unknown>
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // Для CRITICAL_STOCK и EXPIRING_SOON — проверяем по medicationId
  if (meta.medicationId) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type,
        createdAt: { gte: since },
        meta: { path: ['medicationId'], equals: meta.medicationId as number },
      },
    });
    return !!existing;
  }
  // Для DEVIATION_EXCEEDED — проверяем по locationId
  if (meta.locationId) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type,
        createdAt: { gte: since },
        meta: { path: ['locationId'], equals: meta.locationId as number },
      },
    });
    return !!existing;
  }
  return false;
}

// ─── Создать уведомление + (опционально) email ────────────────────────────────

async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  body: string,
  meta: Record<string, unknown> = {}
): Promise<void> {
  const settings = await prisma.notificationSettings.findUnique({
    where: { userId },
  });

  // Если настроек нет — создаём дефолтные
  const cfg = settings ?? { inAppEnabled: true, emailEnabled: false, notifyEmail: null };

  if (!cfg.inAppEnabled) return;
  if (await isDuplicate(userId, type, meta)) return;

  await prisma.notification.create({
    data: { userId, type, title, body, meta: meta as Prisma.InputJsonValue },
  });

  // Email
  if (cfg.emailEnabled) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    const toEmail = cfg.notifyEmail || user?.email;
    if (toEmail) {
      await sendEmailNotification(toEmail, user?.name ?? 'Руководитель', title, body).catch(console.error);
    }
  }
}

// ─── Email-отправщик ─────────────────────────────────────────────────────────

export async function sendEmailNotification(
  to: string,
  recipientName: string,
  subject: string,
  text: string
): Promise<void> {
  const transport = getMailTransport();
  if (!transport) {
    console.warn('[NotificationService] SMTP не настроен — email не отправлен');
    return;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="background: #0e7490; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
        <h2 style="color: white; margin: 0; font-size: 18px;">МедСклад — Уведомление</h2>
      </div>
      <p style="color: #475569; font-size: 14px;">Здравствуйте, <strong>${recipientName}</strong>!</p>
      <div style="background: #f8fafc; border-left: 4px solid #0e7490; border-radius: 4px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #1e293b; font-size: 15px;">${text}</p>
      </div>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
        Это автоматическое сообщение системы МедСклад. Не отвечайте на него.
      </p>
    </div>
  `;

  await transport.sendMail({
    from: process.env.SMTP_FROM || `"МедСклад" <${process.env.SMTP_USER}>`,
    to,
    subject: `[МедСклад] ${subject}`,
    text,
    html,
  });
}

// ─── Основная функция проверки — запускается по расписанию ───────────────────

export async function checkAndCreateNotifications(): Promise<void> {
  console.log('[NotificationService] Запуск проверки уведомлений...');

  // Получаем всех руководителей (ADMIN, HEAD_NURSE, MANAGER) с их настройками
  const managers = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: [Role.ADMIN, Role.HEAD_NURSE, Role.MANAGER] },
    },
    include: { notificationSettings: true },
  });

  if (managers.length === 0) return;

  // ── 1. Критические остатки (CRITICAL_STOCK) ───────────────────────────────
  const allMeds = await prisma.medication.findMany({
    select: {
      id: true,
      name: true,
      minQuantity: true,
      batches: { select: { quantity: true } },
    },
  });

  const criticalMeds = allMeds.filter((med) => {
    const total = med.batches.reduce((s, b) => s + b.quantity, 0);
    return total <= med.minQuantity && med.minQuantity > 0;
  });

  // ── 2. Истекающие сроки (EXPIRING_SOON) ──────────────────────────────────
  const threshold30 = new Date();
  threshold30.setDate(threshold30.getDate() + 30);

  const expiringBatches = await prisma.batch.findMany({
    where: {
      expirationDate: { lte: threshold30, gte: new Date() },
      quantity: { gt: 0 },
    },
    include: { medication: { select: { id: true, name: true } } },
    distinct: ['medicationId'],
  });

  // ── 3. Отклонения от нормы (DEVIATION_EXCEEDED) ───────────────────────────
  // Ленивый импорт чтобы не создавать циклических зависимостей
  const { getProcedureComparison } = await import('./procedure.service');
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 7);
  const comparisons = await getProcedureComparison({
    from: dateFrom.toISOString(),
    to:   new Date().toISOString(),
  });

  // Строим карту превышений: locationId → { cabinetName, maxDeviationPct }
  const deviationMap = new Map<number, { cabinetName: string; maxDeviationPct: number }>();
  for (const comp of comparisons) {
    if (!comp.locationId) continue;
    for (const usage of comp.usage) {
      if (!usage.isViolation) continue;
      const pct = usage.expectedTotal > 0
        ? Math.round(((usage.actualTotal - usage.expectedTotal) / usage.expectedTotal) * 100)
        : 100;
      const existing = deviationMap.get(comp.locationId);
      if (!existing || pct > existing.maxDeviationPct) {
        deviationMap.set(comp.locationId, { cabinetName: comp.cabinetName || 'Кабинет', maxDeviationPct: pct });
      }
    }
  }

  // ── Рассылаем уведомления каждому руководителю ────────────────────────────
  for (const manager of managers) {
    const settings = manager.notificationSettings;
    const criticalEnabled  = settings?.criticalStockEnabled  ?? true;
    const expiringEnabled  = settings?.expiringEnabled        ?? true;
    const deviationEnabled = settings?.deviationEnabled       ?? true;
    const deviationThreshold = settings?.deviationThreshold  ?? 20;

    // CRITICAL_STOCK
    if (criticalEnabled) {
      for (const med of criticalMeds) {
        const stock = med.batches.reduce((s, b) => s + b.quantity, 0);
        await createNotification(
          manager.id,
          NotificationType.CRITICAL_STOCK,
          `Дефицит: ${med.name}`,
          `Остаток ${stock} шт. ниже минимума (${med.minQuantity} шт.). Необходимо пополнение.`,
          { medicationId: med.id }
        );
      }
    }

    // EXPIRING_SOON
    if (expiringEnabled) {
      for (const batch of expiringBatches) {
        const daysLeft = Math.ceil(
          (new Date(batch.expirationDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        await createNotification(
          manager.id,
          NotificationType.EXPIRING_SOON,
          `Истекает срок: ${batch.medication.name}`,
          `Срок годности истекает через ${daysLeft} дн. (${new Date(batch.expirationDate!).toLocaleDateString('ru-RU')}). Проверьте партию.`,
          { medicationId: batch.medication.id }
        );
      }
    }

    // DEVIATION_EXCEEDED
    if (deviationEnabled) {
      for (const [locationId, info] of deviationMap.entries()) {
        if (info.maxDeviationPct < deviationThreshold) continue;
        await createNotification(
          manager.id,
          NotificationType.DEVIATION_EXCEEDED,
          `Перерасход: ${info.cabinetName}`,
          `Превышение норматива на ${info.maxDeviationPct}% в "${info.cabinetName}" за последние 7 дней.`,
          { locationId, deviationPct: info.maxDeviationPct }
        );
      }
    }
  }

  console.log('[NotificationService] Проверка завершена.');
}

// ─── CRUD для API ─────────────────────────────────────────────────────────────

export async function getUserNotifications(userId: number, onlyUnread = false) {
  return prisma.notification.findMany({
    where: {
      userId,
      ...(onlyUnread ? { isRead: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function getUnreadCount(userId: number): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markAsRead(userId: number, ids: number[]): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, id: { in: ids } },
    data:  { isRead: true },
  });
}

export async function markAllAsRead(userId: number): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data:  { isRead: true },
  });
}

export async function getOrCreateSettings(userId: number) {
  const existing = await prisma.notificationSettings.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.notificationSettings.create({ data: { userId } });
}

export async function updateSettings(
  userId: number,
  data: Partial<{
    criticalStockEnabled: boolean;
    deviationEnabled:     boolean;
    expiringEnabled:      boolean;
    deviationThreshold:   number;
    emailEnabled:         boolean;
    inAppEnabled:         boolean;
    notifyEmail:          string | null;
  }>
) {
  return prisma.notificationSettings.upsert({
    where:  { userId },
    create: { userId, ...data },
    update: data,
  });
}
