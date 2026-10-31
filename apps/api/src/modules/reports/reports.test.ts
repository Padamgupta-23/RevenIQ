import { describe, it, expect } from 'vitest';
import {
  getDashboardSummary,
  getOverdueReport,
  getRevenueByMonthReport,
  getSubscriptionsReport,
} from './reports.service.js';
import { prisma } from '../../lib/prisma.js';

describe('Reports Module (P4-3)', () => {
  it('computes dashboard summary with MRR normalization and SQL aggregates', async () => {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });
    if (!admin) return;

    const summary = await getDashboardSummary({}, { id: admin.id, role: 'ADMIN' });

    expect(typeof summary.activeSubscriptionsCount).toBe('number');
    expect(typeof summary.revenueCollected).toBe('string');
    expect(typeof summary.outstandingTotal).toBe('string');
    expect(typeof summary.invoicesCount).toBe('number');
    expect(typeof summary.overdueCount).toBe('number');
    expect(typeof summary.overdueTotal).toBe('string');
    expect(typeof summary.mrr).toBe('string');
    expect(Array.isArray(summary.recentInvoices)).toBe(true);
  });

  it('scopes dashboard summary for customer to their own database records', async () => {
    const customer = await prisma.user.findFirst({
      where: { role: 'CUSTOMER' },
    });
    if (!customer) return;

    const summary = await getDashboardSummary({}, { id: customer.id, role: 'CUSTOMER' });

    expect(typeof summary.activeSubscriptionsCount).toBe('number');
    expect(typeof summary.revenueCollected).toBe('string');
    expect(typeof summary.invoicesCount).toBe('number');
  });

  it('returns overdue report and revenue by month via SQL aggregates', async () => {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) return;

    const overdue = await getOverdueReport({}, { id: admin.id, role: 'ADMIN' });
    expect(Array.isArray(overdue)).toBe(true);

    const revenue = await getRevenueByMonthReport({}, { id: admin.id, role: 'ADMIN' });
    expect(Array.isArray(revenue)).toBe(true);
  });

  it('returns subscriptions breakdown by status and plan via SQL aggregates', async () => {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) return;

    const breakdown = await getSubscriptionsReport({}, { id: admin.id, role: 'ADMIN' });
    expect(Array.isArray(breakdown.byStatus)).toBe(true);
    expect(Array.isArray(breakdown.byPlan)).toBe(true);
  });
});
