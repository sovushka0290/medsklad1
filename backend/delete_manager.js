const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const manager = await prisma.user.findFirst({ where: { email: 'manager@medsklad.kz' } });
    if (manager) {
      await prisma.user.delete({ where: { id: manager.id } });
      console.log('Manager deleted');
    } else {
      console.log('Manager not found');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
