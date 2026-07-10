# MedSklad Inventory Management System

MedSklad — это современная система управления медицинским складом с интеграцией штрих-кодов, аналитикой и строгим контролем ролей (RBAC).

## Запуск проекта

### Backend (Express + Prisma)
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Dashboard (React + Vite)
```bash
cd dashboard
npm install
npm run dev
```

### Mobile (Flutter)
```bash
cd mobile
flutter pub get
flutter run
```

## Ключевые возможности
- **Инвентаризация и сканирование штрихкодов**
- **ИИ-распознавание медикаментов**
- **Отслеживание критических остатков (Push-уведомления)**
- **Экспорт отчетов в Excel**
- **Контроль факта/норматива (ГОСТ)**
- **Динамика расхода (графики)**

## Ролевая модель (Пользователи для тестов)
В системе предусмотрено 4 роли:
- `admin@medsklad.kz` — Администратор
- `headnurse@medsklad.kz` — Старшая медсестра
- `storekeeper@medsklad.kz` — Кладовщик
- `nurse@medsklad.kz` — Медсестра
Пароль по умолчанию для всех: `password123`.

## API Endpoints

Ниже приведена таблица основных эндпоинтов. Подробное описание всех методов, параметров и ответов доступно в файле `swagger.yaml`. Для тестирования API можно использовать импорт `swagger.yaml` в Postman или Swagger UI.

| Метод | Путь | Описание | Роли | Параметры / Тело |
|---|---|---|---|---|
| **POST** | `/api/auth/login` | Вход в систему | Все | `{ email, password }` |
| **POST** | `/api/auth/refresh` | Обновление пары JWT токенов | Все | `{ refreshToken }` |
| **GET** | `/api/medications` | Список медикаментов | Все | `page`, `limit`, `barcode` |
| **POST** | `/api/medications` | Создать новый медикамент | `ADMIN`, `STOREKEEPER` | `{ name, mnn, form, unit, group, minQuantity, barcodes }` |
| **POST** | `/api/medication/scan` | Сканировать медикамент по штрихкоду | Все | `{ barcode }` |
| **POST** | `/api/inventory/start` | Начать сессию инвентаризации | `ADMIN`, `STOREKEEPER`, `HEAD_NURSE` | `{ locationId }` |
| **GET** | `/api/inventory/active` | Список активных сессий | `ADMIN`, `STOREKEEPER`, `HEAD_NURSE`, `MANAGER` | - |
| **GET** | `/api/inventory/history` | История завершённых сессий | `ADMIN`, `STOREKEEPER`, `HEAD_NURSE` | - |
| **PUT** | `/api/inventory/:id/scan` | Добавить скан в инвентаризацию | `ADMIN`, `STOREKEEPER`, `HEAD_NURSE` | `{ barcode, quantityToAdd }` |
| **POST** | `/api/inventory/:id/close` | Закрыть сессию инвентаризации | `ADMIN`, `STOREKEEPER`, `HEAD_NURSE` | - |
| **POST** | `/api/inventory/:id/adjust` | Корректировка количества позиции | `ADMIN`, `STOREKEEPER`, `HEAD_NURSE` | `{ barcode, quantityAdjustment }` |
| **GET** | `/api/procedures/comparison` | Сравнение расхода Факт/Норма | `ADMIN`, `HEAD_NURSE` | - |
| **GET** | `/api/dashboard/metrics` | Статистика склада с фильтром по датам | `ADMIN`, `MANAGER`, `HEAD_NURSE`, `STOREKEEPER` | `filter`, `startDate`, `endDate` |
