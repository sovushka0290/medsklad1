import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Начало очистки старых данных...');
  await prisma.inventoryItem.deleteMany();
  await prisma.inventorySession.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.transaction.deleteMany();
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

  await prisma.batch.createMany({
    data: [
      // Достаточный объем (Ультракаин)
      { quantity: 120, medicationId: ultra.id, locationId: mainStorage.id },
      { quantity: 15, medicationId: ultra.id, locationId: cab1.id },
      { quantity: 8, medicationId: ultra.id, locationId: cab2.id },

      // Дефицит (Филтек Z250): всего 4 шт, минимум 5
      { quantity: 3, medicationId: filtek.id, locationId: mainStorage.id },
      { quantity: 1, medicationId: filtek.id, locationId: cab1.id },

      // Достаточный объем (Эстелайт): всего 14 шт, минимум 8
      { quantity: 10, medicationId: estelite.id, locationId: mainStorage.id },
      { quantity: 4, medicationId: estelite.id, locationId: cab1.id },

      // Дефицит (Перчатки нитриловые M): всего 15 шт, минимум 20
      { quantity: 5, medicationId: glovesM.id, locationId: cab1.id },
      { quantity: 10, medicationId: glovesM.id, locationId: cab3.id },

      // Достаточный объем (Маски): всего 430 шт, минимум 100
      { quantity: 400, medicationId: masks.id, locationId: mainStorage.id },
      { quantity: 30, medicationId: masks.id, locationId: cab1.id },

      // Дефицит (Альвожиль паста): всего 1 шт, минимум 3
      { quantity: 1, medicationId: alvogyl.id, locationId: cab2.id },

      // Дефицит (Максцем Элит): всего 3 шт, минимум 4
      { quantity: 2, medicationId: maxcem.id, locationId: mainStorage.id },
      { quantity: 1, medicationId: maxcem.id, locationId: cab1.id },

      // Прочие остатки
      { quantity: 50, medicationId: lido.id, locationId: mainStorage.id },
      { quantity: 8, medicationId: lido.id, locationId: cab2.id },
      { quantity: 40, medicationId: sept.id, locationId: mainStorage.id },
      { quantity: 12, medicationId: charisma.id, locationId: mainStorage.id },
      { quantity: 3, medicationId: charisma.id, locationId: cab1.id },
      { quantity: 6, medicationId: herculite.id, locationId: mainStorage.id },
      { quantity: 35, medicationId: glovesS.id, locationId: mainStorage.id },
      { quantity: 15, medicationId: glovesS.id, locationId: cab1.id },
      { quantity: 80, medicationId: cotton.id, locationId: mainStorage.id },
      { quantity: 15, medicationId: covers.id, locationId: mainStorage.id },
      { quantity: 5, medicationId: endosolv.id, locationId: mainStorage.id },
      { quantity: 25, medicationId: gipo.id, locationId: mainStorage.id },
      { quantity: 5, medicationId: gipo.id, locationId: cab1.id },
      { quantity: 8, medicationId: fuji.id, locationId: mainStorage.id },
      { quantity: 6, medicationId: adhesor.id, locationId: mainStorage.id },
    ],
  });

  console.log('Сидинг успешно завершен! Сгенерированы локации, номенклатура и остатки.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
