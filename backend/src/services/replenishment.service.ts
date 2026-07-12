import { prisma } from '../lib/prisma';
import { BadRequestError } from '../lib/errors';
import { sendPushNotification } from './push.service';

export const replenishmentService = {
  /**
   * Медсестра создаёт запрос пополнения из своего кабинета (ТЗ 3.6)
   */
  async createRequest(data: {
    medicationId: number;
    locationId: number;
    requestedBy: number;
    quantity: number;
    comment?: string;
  }) {
    const { medicationId, locationId, requestedBy, quantity, comment } = data;

    if (quantity <= 0) {
      throw new BadRequestError('Количество должно быть больше нуля');
    }

    // Проверяем что медикамент и локация существуют
    const [medication, location] = await Promise.all([
      prisma.medication.findUnique({ where: { id: medicationId }, select: { id: true, name: true } }),
      prisma.location.findUnique({ where: { id: locationId }, select: { id: true, name: true } }),
    ]);

    if (!medication) throw new BadRequestError('Медикамент не найден');
    if (!location) throw new BadRequestError('Локация не найдена');

    const request = await prisma.replenishmentRequest.create({
      data: { medicationId, locationId, requestedBy, quantity, comment },
      include: {
        medication: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true, role: true } },
      },
    });

    // Уведомляем кладовщиков и руководство об новом запросе (не блокируем ответ)
    setImmediate(async () => {
      try {
        const storekeepers = await prisma.user.findMany({
          where: {
            role: { in: ['STOREKEEPER', 'HEAD_NURSE', 'ADMIN'] },
            isActive: true,
            pushToken: { not: null },
          },
          select: { pushToken: true },
        });
        const tokens = storekeepers.map((u) => u.pushToken).filter(Boolean) as string[];
        if (tokens.length > 0) {
          await sendPushNotification(
            tokens,
            '📦 Запрос пополнения',
            `${location.name} запрашивает ${quantity} шт. "${medication.name}"`,
            { requestId: request.id, screen: 'Replenishment' }
          );
        }
      } catch (err) {
        console.error('[Replenishment push error]:', err);
      }
    });

    return request;
  },

  /**
   * Получить список запросов (с фильтрами)
   */
  async getRequests(filters: {
    status?: string;
    locationId?: number;
    page?: number;
    limit?: number;
  }) {
    const { status, locationId, page = 1, limit = 50 } = filters;
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const where: any = {};
    if (status) where.status = status;
    if (locationId) where.locationId = locationId;

    const [data, total] = await Promise.all([
      prisma.replenishmentRequest.findMany({
        where,
        include: {
          medication: { select: { id: true, name: true, group: true } },
          location: { select: { id: true, name: true } },
          requester: { select: { id: true, name: true, role: true } },
          resolver: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.replenishmentRequest.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  },

  /**
   * Обновить статус запроса (кладовщик/руководство)
   */
  async resolveRequest(
    id: number,
    resolverId: number,
    newStatus: 'ACKNOWLEDGED' | 'FULFILLED' | 'REJECTED'
  ) {
    const existing = await prisma.replenishmentRequest.findUnique({ where: { id } });
    if (!existing) throw new BadRequestError('Запрос пополнения не найден');
    if (existing.status === 'FULFILLED' || existing.status === 'REJECTED') {
      throw new BadRequestError('Запрос уже завершён');
    }

    return prisma.replenishmentRequest.update({
      where: { id },
      data: {
        status: newStatus,
        resolvedBy: resolverId,
        resolvedAt: new Date(),
      },
      include: {
        medication: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
      },
    });
  },
};
