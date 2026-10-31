import { describe, it, expect } from 'vitest';
import { nextNumber } from './numbering.js';
import { prisma } from './prisma.js';

describe('numbering lib', () => {
  it('generates sequential numbers with SUB prefix', async () => {
    const num1 = await nextNumber('subscription');
    expect(num1).toMatch(/^SUB-\d{6}$/);

    const num2 = await nextNumber('subscription');
    expect(num2).toMatch(/^SUB-\d{6}$/);

    const n1 = parseInt(num1.replace('SUB-', ''), 10);
    const n2 = parseInt(num2.replace('SUB-', ''), 10);
    expect(n2).toBeGreaterThan(n1);
  });

  it('generates sequential numbers with INV prefix', async () => {
    const num1 = await nextNumber('invoice');
    expect(num1).toMatch(/^INV-\d{6}$/);

    const num2 = await nextNumber('invoice');
    expect(num2).toMatch(/^INV-\d{6}$/);

    const n1 = parseInt(num1.replace('INV-', ''), 10);
    const n2 = parseInt(num2.replace('INV-', ''), 10);
    expect(n2).toBeGreaterThan(n1);
  });

  it('works inside a Prisma transaction', async () => {
    const num = await prisma.$transaction(async (tx) => {
      return nextNumber('subscription', tx);
    });
    expect(num).toMatch(/^SUB-\d{6}$/);
  });
});
