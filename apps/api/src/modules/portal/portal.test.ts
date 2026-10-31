import { describe, it, expect, beforeAll } from 'vitest';
import {
  getCustomerSubscriptions,
  getCustomerSubscriptionDetail,
  customerSubscriptionAction,
  getCustomerInvoices,
  getCustomerInvoiceDetail,
} from './portal.service.js';
import { prisma } from '../../lib/prisma.js';
import { SubscriptionStatus } from '@prisma/client';

describe('Portal Module & Customer Data Isolation (P4-4)', () => {
  let customerA: any;
  let customerB: any;
  let subA: any;
  let subB: any;
  let invA: any;
  let invB: any;

  beforeAll(async () => {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      take: 2,
    });

    customerA = customers[0];
    customerB = customers[1];

    if (!customerA || !customerB || !admin) return;

    // Plan with pausable flag
    const plan = await prisma.plan.findFirst({ where: { pausable: true } });
    if (!plan) return;

    // Create a subscription for Customer A
    subA = await prisma.subscription.create({
      data: {
        number: `SUB-PA-${Date.now()}`,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 365 * 86400000),
        paymentTermDays: 15,
        customer: { connect: { id: customerA.id } },
        createdBy: { connect: { id: admin.id } },
        plan: { connect: { id: plan.id } },
      },
    });

    // Create a subscription for Customer B
    subB = await prisma.subscription.create({
      data: {
        number: `SUB-PB-${Date.now()}`,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 365 * 86400000),
        paymentTermDays: 15,
        customer: { connect: { id: customerB.id } },
        createdBy: { connect: { id: admin.id } },
        plan: { connect: { id: plan.id } },
      },
    });

    // Create an invoice for Customer A
    invA = await prisma.invoice.create({
      data: {
        number: `INV-PA-${Date.now()}`,
        status: 'CONFIRMED',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 15 * 86400000),
        subtotal: 50,
        discountTotal: 0,
        taxTotal: 0,
        total: 50,
        amountPaid: 0,
        customer: { connect: { id: customerA.id } },
        subscription: { connect: { id: subA.id } },
      },
    });

    // Create an invoice for Customer B
    invB = await prisma.invoice.create({
      data: {
        number: `INV-PB-${Date.now()}`,
        status: 'CONFIRMED',
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 15 * 86400000),
        subtotal: 75,
        discountTotal: 0,
        taxTotal: 0,
        total: 75,
        amountPaid: 0,
        customer: { connect: { id: customerB.id } },
        subscription: { connect: { id: subB.id } },
      },
    });
  });

  it('Customer A cannot read Customer B subscription (returns 404)', async () => {
    if (!customerA || !customerB || !subB) return;

    await expect(
      getCustomerSubscriptionDetail(customerA.id, subB.id)
    ).rejects.toThrow(/Subscription not found/);
  });

  it('Customer A cannot pause Customer B subscription (returns 404)', async () => {
    if (!customerA || !customerB || !subB) return;

    await expect(
      customerSubscriptionAction(customerA.id, subB.id, 'pause')
    ).rejects.toThrow(/Subscription not found/);
  });

  it('Customer A cannot read Customer B invoice (returns 404)', async () => {
    if (!customerA || !customerB || !invB) return;

    await expect(
      getCustomerInvoiceDetail(customerA.id, invB.id)
    ).rejects.toThrow(/Invoice not found/);
  });

  it('Customer A can list their own subscriptions and invoices without seeing Customer B data', async () => {
    if (!customerA || !customerB) return;

    const mySubs = await getCustomerSubscriptions(customerA.id, {});
    const myInvs = await getCustomerInvoices(customerA.id, {});

    // None should belong to customer B
    expect(mySubs.data.some((s) => s.id === subB?.id)).toBe(false);
    expect(myInvs.data.some((i) => i.id === invB?.id)).toBe(false);

    // Should include own
    expect(mySubs.data.some((s) => s.id === subA?.id)).toBe(true);
    expect(myInvs.data.some((i) => i.id === invA?.id)).toBe(true);
  });

  it('Customer A can pause their own subscription if plan allows', async () => {
    if (!customerA || !subA) return;

    const paused = await customerSubscriptionAction(customerA.id, subA.id, 'pause');
    expect(paused.status).toBe(SubscriptionStatus.PAUSED);
  });
});
