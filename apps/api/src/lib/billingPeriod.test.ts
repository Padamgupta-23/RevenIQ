import { describe, it, expect } from 'vitest';
import { BillingPeriod } from '@prisma/client';
import { addPeriod } from './billingPeriod';

describe('billingPeriod.ts (addPeriod)', () => {
  it('correctly adds daily periods', () => {
    const start = new Date('2026-03-10T00:00:00Z');
    const next = addPeriod(start, BillingPeriod.DAILY, 1);
    expect(next.toISOString()).toBe('2026-03-11T00:00:00.000Z');
  });

  it('correctly adds weekly periods (+7 days)', () => {
    const start = new Date('2026-03-10T00:00:00Z');
    const next = addPeriod(start, BillingPeriod.WEEKLY, 1);
    expect(next.toISOString()).toBe('2026-03-17T00:00:00.000Z');
  });

  it('handles month-end clamping from Jan 31 to Feb 28 in non-leap year', () => {
    const start = new Date('2026-01-31T00:00:00Z');
    const next = addPeriod(start, BillingPeriod.MONTHLY, 1);
    expect(next.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('handles month-end clamping from Jan 31 to Feb 29 in leap year (2024)', () => {
    const start = new Date('2024-01-31T00:00:00Z');
    const next = addPeriod(start, BillingPeriod.MONTHLY, 1);
    expect(next.toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });

  it('handles month-end clamping from Aug 31 to Sep 30', () => {
    const start = new Date('2026-08-31T00:00:00Z');
    const next = addPeriod(start, BillingPeriod.MONTHLY, 1);
    expect(next.toISOString()).toBe('2026-09-30T00:00:00.000Z');
  });

  it('preserves standard days when not overflowing (Jan 15 to Feb 15)', () => {
    const start = new Date('2026-01-15T00:00:00Z');
    const next = addPeriod(start, BillingPeriod.MONTHLY, 1);
    expect(next.toISOString()).toBe('2026-02-15T00:00:00.000Z');
  });

  it('handles yearly additions with leap day clamping (Feb 29, 2024 + 1 year => Feb 28, 2025)', () => {
    const start = new Date('2024-02-29T00:00:00Z');
    const next = addPeriod(start, BillingPeriod.YEARLY, 1);
    expect(next.toISOString()).toBe('2025-02-28T00:00:00.000Z');
  });
});

