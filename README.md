# MedSklad 💊

Система управления медицинским складом с поддержкой ИИ, ролевой моделью и мобильным приложением.

## Архитектура
Проект состоит из трех основных частей:
- **Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL
- **Web Dashboard**: React + Vite + TailwindCSS + Recharts
- **Mobile App**: React Native (Expo) + NativeWind + React Navigation

## Запуск проекта локально (Docker)

Для быстрого старта бэкенда и дашборда мы используем `docker-compose`.

1. Убедитесь, что установлен [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. В корневой папке проекта выполните команду:
   ```bash
   docker-compose up -d --build
   ```
3. Сервисы будут доступны по следующим адресам:
   - **Dashboard**: `http://localhost`
   - **Backend API**: `http://localhost/api`
   - **Postgres**: `localhost:5432`

## Запуск мобильного приложения

Мобильное приложение (клиент для медсестер и кладовщиков) запускается через Expo.

1. Перейдите в папку `mobile`:
   ```bash
   cd mobile
   ```
2. Установите зависимости:
   ```bash
   npm install
   ```
3. Запустите приложение:
   ```bash
   npx expo start
   ```
4. Для тестирования на телефоне используйте приложение Expo Go (iOS/Android), отсканировав QR-код.
   *Примечание: убедитесь, что телефон находится в той же локальной сети, что и компьютер.*
   
*Для указания другого API URL можно задать переменную окружения `EXPO_PUBLIC_API_URL`, например в файле `.env` в папке `mobile`.*

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

