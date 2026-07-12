import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Начало очистки старых данных...');
  await prisma.procedureLog.deleteMany();
  await prisma.procedureNorm.deleteMany();
  await prisma.procedure.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.inventorySession.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();

  console.log('Создание тестовых пользователей...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  await prisma.user.create({
    data: {
      email: 'admin@medsklad.kz',
      password: hashedPassword,
      role: 'ADMIN',
      name: 'Главный администратор'
    }
  });

  await prisma.user.create({
    data: {
      email: 'headnurse@medsklad.kz',
      password: hashedPassword,
      role: 'HEAD_NURSE',
      name: 'Главная медсестра'
    }
  });

  await prisma.user.create({
    data: {
      email: 'storekeeper@medsklad.kz',
      password: hashedPassword,
      role: 'STOREKEEPER',
      name: 'Кладовщик склада'
    }
  });

  await prisma.user.create({
    data: {
      email: 'nurse@medsklad.kz',
      password: hashedPassword,
      role: 'NURSE',
      name: 'Медсестра Кабинет 1'
    }
  });

  await prisma.user.create({
    data: {
      email: 'manager@medsklad.kz',
      password: hashedPassword,
      role: 'MANAGER',
      name: 'Менеджер клиники'
    }
  });

  console.log('Создание локаций...');
  const mainStorage = await prisma.location.create({
    data: { id: 1, name: 'Главный склад', type: 'MAIN_STORAGE', description: 'Основной материальный склад клиники' },
  });

  const cab1 = await prisma.location.create({
    data: { id: 2, name: 'Кабинет №1 (Терапия)', type: 'CABINET', description: 'Процедурный кабинет терапевтической стоматологии' },
  });

  const cab2 = await prisma.location.create({
    data: { id: 3, name: 'Кабинет №2 (Хирургия)', type: 'CABINET', description: 'Операционный кабинет хирургической стоматологии' },
  });

  const cab3 = await prisma.location.create({
    data: { id: 4, name: 'Кабинет №3 (Ортодонтия)', type: 'CABINET', description: 'Кабинет ортодонтического приема' },
  });

  console.log('Создание стоматологической номенклатуры (21 препарат)...');

  // Анестетики
  const ultra = await prisma.medication.create({
    data: { barcodes: ['2000000000010'], name: 'Ультракаин Д-С форте 2мл (анестетик)', minQuantity: 50 },
  });
  const lido = await prisma.medication.create({
    data: { barcodes: [], name: 'Лидокаин 2% 2мл (анестетик)', minQuantity: 30 },
  });
  const sept = await prisma.medication.create({
    data: { barcodes: [], name: 'Септанест с адреналином 4% (анестетик)', minQuantity: 40 },
  });
  const mepi = await prisma.medication.create({
    data: { barcodes: [], name: 'Мепивастезин 3% без адреналина', minQuantity: 30 },
  });

  // Пломбировочные материалы (композиты)
  const filtek = await prisma.medication.create({
    data: { barcodes: ['2000000000058'], name: 'Филтек Z250 композит (Filtek 4г)', minQuantity: 5 },
  });
  const estelite = await prisma.medication.create({
    data: { barcodes: [], name: 'Эстелайт Сигма Квик шприц 3.8г', minQuantity: 8 },
  });
  const charisma = await prisma.medication.create({
    data: { barcodes: [], name: 'Каризма Классик шприц 4г', minQuantity: 10 },
  });
  const herculite = await prisma.medication.create({
    data: { barcodes: [], name: 'Геркулайт Ультра шприц 4г', minQuantity: 5 },
  });

  // Расходники
  const glovesM = await prisma.medication.create({
    data: { barcodes: ['2000000000096'], name: 'Перчатки нитриловые синие (M)', minQuantity: 20 },
  });
  const glovesS = await prisma.medication.create({
    data: { barcodes: [], name: 'Перчатки нитриловые синие (S)', minQuantity: 20 },
  });
  const glovesL = await prisma.medication.create({
    data: { barcodes: [], name: 'Перчатки латексные опудренные (L)', minQuantity: 20 },
  });
  const masks = await prisma.medication.create({
    data: { barcodes: [], name: 'Маски медицинские трехслойные (пачка)', minQuantity: 100 },
  });
  const cotton = await prisma.medication.create({
    data: { barcodes: [], name: 'Ватные валики стоматологические (пачка)', minQuantity: 50 },
  });
  const covers = await prisma.medication.create({
    data: { barcodes: [], name: 'Бахилы медицинские одноразовые (пачка)', minQuantity: 10 },
  });

  // Препараты для эндодонтии / лечебные
  const alvogyl = await prisma.medication.create({
    data: { barcodes: [], name: 'Альвожиль (Alvogyl) паста 12г', minQuantity: 3 },
  });
  const endosolv = await prisma.medication.create({
    data: { barcodes: [], name: 'Эндосольв жидкость для распломбировки', minQuantity: 2 },
  });
  const gipo = await prisma.medication.create({
    data: { barcodes: ['2000000000171'], name: 'Гипохлорит натрия 3% раствор 100мл', minQuantity: 15 },
  });
  const cofferdam = await prisma.medication.create({
    data: { barcodes: [], name: 'Коффердам жидкий барьер (шприц)', minQuantity: 5 },
  });

  // Стоматологические цементы
  const fuji = await prisma.medication.create({
    data: { barcodes: [], name: 'Фуджи I (Fuji I) стеклоиономерный цемент', minQuantity: 4 },
  });
  const adhesor = await prisma.medication.create({
    data: { barcodes: [], name: 'Адгезор Карбофайн фосфатный цемент', minQuantity: 5 },
  });
  const maxcem = await prisma.medication.create({
    data: { barcodes: [], name: 'Максцем Элит (Maxcem Elite) самоадгезивный цемент', minQuantity: 4 },
  });

  console.log('Распределение партий по складам...');

  const now = new Date();
  const dateExpired = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 дней назад
  const dateExpiringSoon = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 дней вперед (истекает скоро)
  const dateFuture = new Date(now.getTime() + 240 * 24 * 60 * 60 * 1000); // 240 дней вперед (стабильный срок)

  await prisma.batch.createMany({
    data: [
      // Достаточный объем (Ультракаин)
      { quantity: 120, medicationId: ultra.id, locationId: mainStorage.id, price: 1500, serialNumber: 'ULT-1092', expirationDate: dateFuture, supplier: 'ТОО МедМаркет' },
      { quantity: 15, medicationId: ultra.id, locationId: cab1.id, price: 1500, serialNumber: 'ULT-1092', expirationDate: dateFuture, supplier: 'ТОО МедМаркет' },
      { quantity: 8, medicationId: ultra.id, locationId: cab2.id, price: 1500, serialNumber: 'ULT-0988', expirationDate: dateExpiringSoon, supplier: 'ТОО Стоматология-Снаб' },

      // Дефицит (Филтек Z250)
      { quantity: 3, medicationId: filtek.id, locationId: mainStorage.id, price: 8500, serialNumber: 'FIL-9921', expirationDate: dateFuture, supplier: 'ТОО Актобе-Фарм' },
      { quantity: 1, medicationId: filtek.id, locationId: cab1.id, price: 8500, serialNumber: 'FIL-9921', expirationDate: dateFuture, supplier: 'ТОО Актобе-Фарм' },

      // Достаточный объем (Эстелайт)
      { quantity: 10, medicationId: estelite.id, locationId: mainStorage.id, price: 12000, serialNumber: 'EST-4402', expirationDate: dateFuture, supplier: 'ТОО МедМаркет' },
      { quantity: 4, medicationId: estelite.id, locationId: cab1.id, price: 12000, serialNumber: 'EST-4402', expirationDate: dateFuture, supplier: 'ТОО МедМаркет' },

      // Дефицит (Перчатки нитриловые M)
      { quantity: 5, medicationId: glovesM.id, locationId: cab1.id, price: 250, serialNumber: 'GLV-M-01', expirationDate: dateFuture, supplier: 'ТОО Стоматология-Снаб' },
      { quantity: 10, medicationId: glovesM.id, locationId: cab3.id, price: 250, serialNumber: 'GLV-M-01', expirationDate: dateFuture, supplier: 'ТОО Стоматология-Снаб' },

      // Достаточный объем (Маски)
      { quantity: 400, medicationId: masks.id, locationId: mainStorage.id, price: 50, serialNumber: 'MSK-2026', expirationDate: dateFuture, supplier: 'АО ФармСтандарт' },
      { quantity: 30, medicationId: masks.id, locationId: cab1.id, price: 50, serialNumber: 'MSK-2026', expirationDate: dateFuture, supplier: 'АО ФармСтандарт' },

      // Дефицит (Альвожиль паста)
      { quantity: 1, medicationId: alvogyl.id, locationId: cab2.id, price: 14500, serialNumber: 'ALV-3301', expirationDate: dateExpiringSoon, supplier: 'ТОО Актобе-Фарм' },

      // Дефицит (Максцем Элит)
      { quantity: 2, medicationId: maxcem.id, locationId: mainStorage.id, price: 16500, serialNumber: 'MXC-9011', expirationDate: dateFuture, supplier: 'ТОО МедМаркет' },
      { quantity: 1, medicationId: maxcem.id, locationId: cab1.id, price: 16500, serialNumber: 'MXC-9011', expirationDate: dateFuture, supplier: 'ТОО МедМаркет' },

      // Прочие остатки
      { quantity: 50, medicationId: lido.id, locationId: mainStorage.id, price: 300, serialNumber: 'LID-5510', expirationDate: dateExpired, supplier: 'АО ФармСтандарт' }, // просрочено
      { quantity: 8, medicationId: lido.id, locationId: cab2.id, price: 300, serialNumber: 'LID-5511', expirationDate: dateFuture, supplier: 'АО ФармСтандарт' },
      { quantity: 40, medicationId: sept.id, locationId: mainStorage.id, price: 1800, serialNumber: 'SPT-1234', expirationDate: dateFuture, supplier: 'ТОО Актобе-Фарм' },
      { quantity: 12, medicationId: charisma.id, locationId: mainStorage.id, price: 7500, serialNumber: 'CHR-9912', expirationDate: dateFuture, supplier: 'ТОО МедМаркет' },
      { quantity: 3, medicationId: charisma.id, locationId: cab1.id, price: 7500, serialNumber: 'CHR-9912', expirationDate: dateFuture, supplier: 'ТОО МедМаркет' },
      { quantity: 6, medicationId: herculite.id, locationId: mainStorage.id, price: 9800, serialNumber: 'HER-4411', expirationDate: dateFuture, supplier: 'ТОО Стоматология-Снаб' },
      { quantity: 35, medicationId: glovesS.id, locationId: mainStorage.id, price: 250, serialNumber: 'GLV-S-02', expirationDate: dateFuture, supplier: 'ТОО Стоматология-Снаб' },
      { quantity: 15, medicationId: glovesS.id, locationId: cab1.id, price: 250, serialNumber: 'GLV-S-02', expirationDate: dateFuture, supplier: 'ТОО Стоматология-Снаб' },
      { quantity: 80, medicationId: cotton.id, locationId: mainStorage.id, price: 400, serialNumber: 'CTN-3011', expirationDate: dateFuture, supplier: 'АО ФармСтандарт' },
      { quantity: 15, medicationId: covers.id, locationId: mainStorage.id, price: 20, serialNumber: 'CVR-8890', expirationDate: dateFuture, supplier: 'АО ФармСтандарт' },
      { quantity: 5, medicationId: endosolv.id, locationId: mainStorage.id, price: 6200, serialNumber: 'END-0012', expirationDate: dateFuture, supplier: 'ТОО МедМаркет' },
      { quantity: 25, medicationId: gipo.id, locationId: mainStorage.id, price: 1100, serialNumber: 'GIP-2231', expirationDate: dateFuture, supplier: 'ТОО Актобе-Фарм' },
      { quantity: 5, medicationId: gipo.id, locationId: cab1.id, price: 1100, serialNumber: 'GIP-2231', expirationDate: dateFuture, supplier: 'ТОО Актобе-Фарм' },
      { quantity: 8, medicationId: fuji.id, locationId: mainStorage.id, price: 13500, serialNumber: 'FUJ-0091', expirationDate: dateFuture, supplier: 'ТОО МедМаркет' },
      { quantity: 6, medicationId: adhesor.id, locationId: mainStorage.id, price: 4200, serialNumber: 'ADH-7711', expirationDate: dateFuture, supplier: 'ТОО Стоматология-Снаб' },
    ],
  });

  console.log('Создание процедур и нормативов по ТЗ...');
  const proc1 = await prisma.procedure.create({
    data: {
      name: 'Лечение кариеса (пломбирование)',
      description: 'Стандартная процедура пломбирования композитным материалом светового отверждения с анестезией.',
      norms: {
        create: [
          { medicationId: ultra.id, expectedQuantity: 1.0, tolerancePercent: 20 },
          { medicationId: filtek.id, expectedQuantity: 1.0, tolerancePercent: 30 },
          { medicationId: glovesM.id, expectedQuantity: 2.0, tolerancePercent: 0 },
          { medicationId: cotton.id, expectedQuantity: 4.0, tolerancePercent: 50 },
          { medicationId: masks.id, expectedQuantity: 2.0, tolerancePercent: 0 },
        ],
      },
    },
  });

  const proc2 = await prisma.procedure.create({
    data: {
      name: 'Удаление зуба (простое)',
      description: 'Хирургическое удаление однокорневого или многокорневого зуба под местной анестезией.',
      norms: {
        create: [
          { medicationId: ultra.id, expectedQuantity: 1.0, tolerancePercent: 20 },
          { medicationId: glovesM.id, expectedQuantity: 2.0, tolerancePercent: 0 },
          { medicationId: cotton.id, expectedQuantity: 6.0, tolerancePercent: 50 },
          { medicationId: masks.id, expectedQuantity: 2.0, tolerancePercent: 0 },
        ],
      },
    },
  });

  const proc3 = await prisma.procedure.create({
    data: {
      name: 'Профессиональная гигиена полости рта',
      description: 'Ультразвуковая чистка зубов, AirFlow полировка и фторирование.',
      norms: {
        create: [
          { medicationId: glovesM.id, expectedQuantity: 2.0, tolerancePercent: 0 },
          { medicationId: cotton.id, expectedQuantity: 10.0, tolerancePercent: 20 },
          { medicationId: masks.id, expectedQuantity: 2.0, tolerancePercent: 0 },
        ],
      },
    },
  });

  console.log('Создание логов процедур и транзакций расхода для графиков дашборда...');
  const nurseUser = await prisma.user.findFirst({ where: { email: 'nurse@medsklad.kz' } });
  const nurseId = nurseUser ? nurseUser.id : 4;

  // Генерируем данные за последние 7 дней для графиков
  for (let i = 0; i < 7; i++) {
    const day = new Date();
    day.setDate(day.getDate() - i);

    // Добавляем логи процедур
    const count1 = Math.floor(Math.random() * 4) + 1;
    for (let k = 0; k < count1; k++) {
      await prisma.procedureLog.create({
        data: {
          procedureId: proc1.id,
          locationId: cab1.id,
          userId: nurseId,
          createdAt: day
        }
      });
    }

    const count2 = Math.floor(Math.random() * 3) + 1;
    for (let k = 0; k < count2; k++) {
      await prisma.procedureLog.create({
        data: {
          procedureId: proc2.id,
          locationId: cab2.id,
          userId: nurseId,
          createdAt: day
        }
      });
    }

    // Добавляем транзакции расхода
    await prisma.transaction.create({
      data: {
        type: 'OUTFLOW',
        quantity: Math.floor(Math.random() * 12) + 5,
        medicationId: ultra.id,
        locationId: cab1.id,
        userId: nurseId,
        reason: 'Лечение кариеса',
        createdAt: day
      }
    });

    await prisma.transaction.create({
      data: {
        type: 'WRITE_OFF',
        quantity: Math.floor(Math.random() * 5) + 1,
        medicationId: glovesM.id,
        locationId: cab1.id,
        userId: nurseId,
        reason: 'Списание по износу / браку',
        createdAt: day
      }
    });
  }

  console.log('Сидинг успешно завершен! Сгенерированы локации, номенклатура, детальные остатки, логи процедур и транзакции.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
