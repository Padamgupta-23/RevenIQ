import { describe, it, expect } from 'vitest';
import { DiscountType, DiscountScope, Prisma } from '@prisma/client';
import { evaluateDiscounts, DiscountDefinition } from './discountEngine';

describe('discountEngine.ts (evaluateDiscounts)', () => {
  const baseLines = [
    { productId: 'prod-1', quantity: 2, unitPrice: 100 }, // subtotal: 200
    { productId: 'prod-2', quantity: 1, unitPrice: 300 }, // subtotal: 300
  ]; // Total subtotal = 500

  it('applies percentage subscription discount correctly (10% of $500 = $50)', () => {
    const discount: DiscountDefinition = {
      id: 'disc-1',
      name: '10% Off',
      type: DiscountType.PERCENTAGE,
      value: 10,
      scope: DiscountScope.SUBSCRIPTION,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isActive: true,
    };

    const res = evaluateDiscounts({
      lines: baseLines,
      subscriptionDiscount: discount,
      now: new Date('2026-06-01'),
    });

    expect(res.subtotal.toString()).toBe('500');
    expect(res.discountTotal.toString()).toBe('50');
    expect(res.totalAfterDiscount.toString()).toBe('450');
    expect(res.appliedDiscounts.length).toBe(1);
    expect(res.appliedDiscounts[0].amount.toString()).toBe('50');
  });

  it('rejects expired discounts', () => {
    const expired: DiscountDefinition = {
      id: 'disc-expired',
      name: 'Expired 20%',
      type: DiscountType.PERCENTAGE,
      value: 20,
      scope: DiscountScope.SUBSCRIPTION,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      isActive: true,
    };

    const res = evaluateDiscounts({
      lines: baseLines,
      subscriptionDiscount: expired,
      now: new Date('2026-06-01'),
    });

    expect(res.discountTotal.toString()).toBe('0');
    expect(res.totalAfterDiscount.toString()).toBe('500');
    expect(res.appliedDiscounts.length).toBe(0);
  });

  it('rejects discount when usage limit has been reached', () => {
    const maxedOut: DiscountDefinition = {
      id: 'disc-maxed',
      name: 'Limit 10',
      type: DiscountType.FIXED,
      value: 50,
      scope: DiscountScope.SUBSCRIPTION,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      usageLimit: 10,
      usedCount: 10, // equal to limit
      isActive: true,
    };

    const res = evaluateDiscounts({
      lines: baseLines,
      subscriptionDiscount: maxedOut,
      now: new Date('2026-06-01'),
    });

    expect(res.discountTotal.toString()).toBe('0');
  });

  it('enforces minQuantity constraint', () => {
    const minQtyDisc: DiscountDefinition = {
      id: 'disc-qty',
      name: 'Min 5 Items',
      type: DiscountType.PERCENTAGE,
      value: 15,
      scope: DiscountScope.SUBSCRIPTION,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      minQuantity: 5, // We only have 3 items total in baseLines (2+1)
      isActive: true,
    };

    const res = evaluateDiscounts({
      lines: baseLines,
      subscriptionDiscount: minQtyDisc,
      now: new Date('2026-06-01'),
    });

    expect(res.discountTotal.toString()).toBe('0');
  });

  it('caps fixed discount at base amount so total is never negative', () => {
    const largeFixed: DiscountDefinition = {
      id: 'disc-large',
      name: '$1000 Voucher',
      type: DiscountType.FIXED,
      value: 1000, // Greater than $500 subtotal
      scope: DiscountScope.SUBSCRIPTION,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      isActive: true,
    };

    const res = evaluateDiscounts({
      lines: baseLines,
      subscriptionDiscount: largeFixed,
      now: new Date('2026-06-01'),
    });

    expect(res.discountTotal.toString()).toBe('500');
    expect(res.totalAfterDiscount.toString()).toBe('0');
    expect(res.totalAfterDiscount.greaterThanOrEqualTo(new Prisma.Decimal(0))).toBe(true);
  });

  it('correctly isolates PRODUCT scope discount to matching product lines only', () => {
    const productDisc: DiscountDefinition = {
      id: 'disc-prod1-only',
      name: '20% Off Prod-1',
      type: DiscountType.PERCENTAGE,
      value: 20,
      scope: DiscountScope.PRODUCT,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      productIds: ['prod-1'], // applies to 2 * 100 = 200 => 20% of 200 = 40
      isActive: true,
    };

    const res = evaluateDiscounts({
      lines: baseLines,
      productDiscounts: [productDisc],
      now: new Date('2026-06-01'),
    });

    expect(res.subtotal.toString()).toBe('500');
    expect(res.discountTotal.toString()).toBe('40');
    expect(res.totalAfterDiscount.toString()).toBe('460');

    const prod1Line = res.lineDiscounts.find((l) => l.productId === 'prod-1');
    const prod2Line = res.lineDiscounts.find((l) => l.productId === 'prod-2');

    expect(prod1Line?.discountAmount.toString()).toBe('40');
    expect(prod2Line?.discountAmount.toString()).toBe('0');
  });
});

