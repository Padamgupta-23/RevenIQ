import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from './prisma.js';

export type CounterKey = 'subscription' | 'invoice';

const KEY_PREFIX_MAP: Record<CounterKey, string> = {
  subscription: 'SUB',
  invoice: 'INV',
};

/**
 * Generates the next sequential number atomically using the Counter table.
 * Returns formatted string like SUB-000001 or INV-000001.
 * Usable inside or outside a Prisma transaction.
 */
export async function nextNumber(
  key: CounterKey,
  tx?: Prisma.TransactionClient | PrismaClient
): Promise<string> {
  const client = tx ?? defaultPrisma;

  const counter = await client.counter.upsert({
    where: { key },
    update: {
      value: { increment: 1 },
    },
    create: {
      key,
      value: 1,
    },
  });

  const prefix = KEY_PREFIX_MAP[key];
  const numberStr = String(counter.value).padStart(6, '0');
  return `${prefix}-${numberStr}`;
}

