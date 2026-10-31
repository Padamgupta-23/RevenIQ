import { describe, it, expect, beforeEach } from 'vitest';
import { nextNumber } from './numbering.js';
import { prisma } from './prisma.js';

describe('numbering lib', () => {
  beforeEach(async () => {
    // Reset counter for test idempotency
    await prisma.counter.deleteMany({
      where: { key: { in: ['subscription', 'invoice'] } },
    });
  });

  it('generates sequential numbers with SUB prefix', async () => {
    const num1 = await nextNumber('subscription');
    expect(num1).toBe('SUB-000001');

    const num2 = await nextNumber('subscription');
    expect(num2).toBe('SUB-000002');
  });

  it('generates sequential numbers with INV prefix', async () => {
    const num1 = await nextNumber('invoice');
    expect(num1).toBe('INV-000001');

    const num2 = await nextNumber('invoice');
    expect(num2).toBe('INV-000002');
  });

  it('works inside a Prisma transaction', async () => {
    const num = await prisma.$transaction(async (tx) => {
      return nextNumber('subscription', tx);
    });
    expect(num).toBe('SUB-000001');
  });
});

