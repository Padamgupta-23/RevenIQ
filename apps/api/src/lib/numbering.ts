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
 * If a collision is encountered (e.g. from existing seeded rows), automatically advances
 * to the next available sequential number.
 * Usable inside or outside a Prisma transaction.
 */
export async function nextNumber(
  key: CounterKey,
  tx?: Prisma.TransactionClient | PrismaClient
): Promise<string> {
  const client = tx ?? defaultPrisma;

  while (true) {
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
    const candidate = `${prefix}-${numberStr}`;

    // Verify candidate does not collide with an existing row in database
    if (key === 'subscription') {
      const exists = await client.subscription.findUnique({
        where: { number: candidate },
        select: { id: true },
      });
      if (!exists) {
        return candidate;
      }
    } else if (key === 'invoice') {
      const exists = await client.invoice.findUnique({
        where: { number: candidate },
        select: { id: true },
      });
      if (!exists) {
        return candidate;
      }
    } else {
      return candidate;
    }
  }
}
