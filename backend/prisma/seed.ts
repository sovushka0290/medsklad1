import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Проверка наличия базовой структуры в БД...');

  // 1. Проверяем наличие пользователей
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    console.log('Пользователи не найдены. Создание дефолтного администратора...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    await prisma.user.create({
      data: {
        email: 'admin@medsklad.kz',
        password: hashedPassword,
        role: 'ADMIN',
        name: 'Главный администратор'
      }
    });
    console.log('Дефолтный администратор успешно создан (admin@medsklad.kz / password123).');
  } else {
    console.log('Пользователи уже существуют. Сидирование пользователей пропущено.');
  }

  // 2. Проверяем наличие локаций
  const locationCount = await prisma.location.count();
  if (locationCount === 0) {
    console.log('Локации не найдены. Создание главного склада...');
    await prisma.location.create({
      data: {
        id: 1,
        name: 'Главный склад',
        type: 'MAIN_STORAGE',
        description: 'Основной материальный склад клиники'
      }
    });
    console.log('Главный склад успешно создан.');
  } else {
    console.log('Локации уже существуют. Сидирование локаций пропущено.');
  }
}

main()
  .catch((e) => {
    console.error('Ошибка сидирования:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
