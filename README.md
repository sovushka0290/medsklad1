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

## API Endpoints

Ниже приведена таблица основных эндпоинтов. Подробное описание всех методов, параметров и ответов доступно в файле `swagger.yaml`.

| Endpoint | Метод | Описание | Роли (x-role-guard) |
|----------|-------|----------|---------------------|
| `/api/auth/login` | POST | Авторизация пользователя | Все |
| `/api/auth/refresh` | POST | Обновление токена | Все |
| `/api/medications` | POST | Создание нового медикамента | ADMIN, STOREKEEPER |
| `/api/inventory/start` | POST | Начать сессию инвентаризации | ADMIN, STOREKEEPER, HEAD_NURSE |
| `/api/inventory/active` | GET | Получить активные сессии | ADMIN, STOREKEEPER, HEAD_NURSE, MANAGER |
| `/api/inventory/history` | GET | Получить закрытые сессии | ADMIN, STOREKEEPER, HEAD_NURSE, MANAGER |
| `/api/inventory/:id/scan` | PUT | Сканировать товар (добавить кол-во) | ADMIN, STOREKEEPER, HEAD_NURSE |
| `/api/inventory/:id/adjust` | PUT | Корректировка количества товара | ADMIN, STOREKEEPER, HEAD_NURSE |
| `/api/inventory/:id/close` | POST | Закрыть сессию инвентаризации | ADMIN, STOREKEEPER, HEAD_NURSE |
| `/api/procedures/comparison` | GET | Сравнение расхода и норм процедур | ADMIN, MANAGER, HEAD_NURSE |
| `/api/dashboard` | GET | Ключевые метрики (?filter=today/week/month) | ADMIN, MANAGER |

Для тестирования API можно использовать импорт `swagger.yaml` в Postman или Swagger UI.
