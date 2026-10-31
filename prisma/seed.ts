import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  // Seed initial counters if not present
  await prisma.counter.upsert({
    where: { key: 'subscription' },
    update: {},
    create: { key: 'subscription', value: 0 },
  });

  await prisma.counter.upsert({
    where: { key: 'invoice' },
    update: {},
    create: { key: 'invoice', value: 0 },
  });

  console.log('Database seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

