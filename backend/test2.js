const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);
  const roles = [
    { email: 'admin@medsklad.kz', role: 'ADMIN', name: 'Главный Администратор' },
    { email: 'nurse@medsklad.kz', role: 'NURSE', name: 'Медсестра Анна' },
    { email: 'headnurse@medsklad.kz', role: 'HEAD_NURSE', name: 'Старшая медсестра Елена' },
    { email: 'manager@medsklad.kz', role: 'MANAGER', name: 'Менеджер отдела' },
    { email: 'storekeeper@medsklad.kz', role: 'STOREKEEPER', name: 'Кладовщик Иван' }
  ];

  for (const r of roles) {
    await prisma.user.upsert({
      where: { email: r.email },
      update: { role: r.role, name: r.name, password },
      create: { email: r.email, role: r.role, name: r.name, password }
    });
  }
  console.log('Users created/updated');
}
main().finally(() => prisma.$disconnect());
