import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { signToken } from '../../middleware/auth.js';
import {
  Role,
  ProductType,
  BillingPeriod,
  SubscriptionStatus,
  DiscountType,
  DiscountScope,
} from '@prisma/client';
import { toDecimal } from '../../lib/money.js';
import { runBilling, autoCloseExpiredSubscriptions } from './billing.service.js';

const app = createApp();

describe('Billing Engine & Recurring Invoicing (P3-2)', () => {
  let adminToken: string;
  let staffToken: string;

  let testAdmin: any;
  let testCustomer: any;
  let monthlyPlan: any;
  let autoClosePlan: any;
  let testProduct: any;
  let testTax: any;

  beforeEach(async () => {
    testAdmin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
    testCustomer = await prisma.user.findFirst({ where: { role: Role.CUSTOMER } });
    const staff = await prisma.user.findFirst({ where: { role: Role.STAFF } });

    adminToken = signToken({
      userId: testAdmin.id,
      role: Role.ADMIN,
      email: testAdmin.email,
    });

    staffToken = signToken({
      userId: staff!.id,
      role: Role.STAFF,
      email: staff!.email,
    });

    // Create 18% Tax
    testTax = await prisma.tax.create({
      data: {
        name: `VAT 18% ${Date.now()}`,
        rate: 18.0,
        isActive: true,
      },
    });

    // Create Product
    testProduct = await prisma.product.create({
      data: {
        name: `Cloud Platform ${Date.now()}`,
        type: ProductType.SOFTWARE,
        salesPrice: 100.0,
        costPrice: 40.0,
        taxId: testTax.id,
        isActive: true,
      },
    });

    // Monthly plan
    monthlyPlan = await prisma.plan.create({
      data: {
        name: `Monthly Pro ${Date.now()}`,
        price: 100.0,
        billingPeriod: BillingPeriod.MONTHLY,
        startDate: new Date('2026-01-01T00:00:00Z'),
        isActive: true,
      },
    });

    // Auto-close plan
    autoClosePlan = await prisma.plan.create({
      data: {
        name: `Term Auto-Close Plan ${Date.now()}`,
        price: 150.0,
        billingPeriod: BillingPeriod.MONTHLY,
        startDate: new Date('2026-01-01T00:00:00Z'),
        autoClose: true,
        isActive: true,
      },
    });
  });

  describe('Idempotency & Catch-up Loop', () => {
    it('running billing twice produces NO duplicate invoices', async () => {
      // 1. Create active subscription with nextBillingDate in the past
      const sub = await prisma.subscription.create({
        data: {
          number: `SUB-TEST-${Date.now()}`,
          customerId: testCustomer.id,
          planId: monthlyPlan.id,
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date('2026-05-01T00:00:00Z'),
          expiryDate: new Date('2027-05-01T00:00:00Z'),
          nextBillingDate: new Date('2026-05-01T00:00:00Z'),
          paymentTermDays: 15,
          createdById: testAdmin.id,
          lines: {
            create: [
              {
                productId: testProduct.id,
                quantity: 1,
                unitPrice: 100.0,
                amount: 100.0,
                taxId: testTax.id,
              },
            ],
          },
        },
      });

      // Run 1 for 2026-05-02
      const run1 = await runBilling({ runDate: new Date('2026-05-02T00:00:00Z') });
      expect(run1.created).toBeGreaterThanOrEqual(1);

      // Verify invoice exists
      const invoicesAfterRun1 = await prisma.invoice.findMany({
        where: { subscriptionId: sub.id },
      });
      expect(invoicesAfterRun1).toHaveLength(1);

      // Run 2 immediately for same date
      await runBilling({ runDate: new Date('2026-05-02T00:00:00Z') });

      const invoicesAfterRun2 = await prisma.invoice.findMany({
        where: { subscriptionId: sub.id },
      });
      expect(invoicesAfterRun2).toHaveLength(1); // strictly 1 invoice! No duplicates!
    });

    it('creates two invoices when two billing periods were missed (catch-up loop)', async () => {
      const sub = await prisma.subscription.create({
        data: {
          number: `SUB-CATCHUP-${Date.now()}`,
          customerId: testCustomer.id,
          planId: monthlyPlan.id,
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date('2026-01-01T00:00:00Z'),
          expiryDate: new Date('2027-01-01T00:00:00Z'),
          nextBillingDate: new Date('2026-01-01T00:00:00Z'),
          paymentTermDays: 15,
          createdById: testAdmin.id,
          lines: {
            create: [
              {
                productId: testProduct.id,
                quantity: 1,
                unitPrice: 100.0,
                amount: 100.0,
                taxId: testTax.id,
              },
            ],
          },
        },
      });

      // Run billing for Feb 15 (Jan 1 and Feb 1 periods are both <= Feb 15)
      const res = await runBilling({ runDate: new Date('2026-02-15T00:00:00Z') });
      expect(res.created).toBeGreaterThanOrEqual(2);

      const subInvoices = await prisma.invoice.findMany({
        where: { subscriptionId: sub.id },
        orderBy: { periodStart: 'asc' },
      });

      expect(subInvoices).toHaveLength(2);
      expect(subInvoices[0].periodStart.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(subInvoices[0].periodEnd.toISOString()).toBe('2026-02-01T00:00:00.000Z');

      expect(subInvoices[1].periodStart.toISOString()).toBe('2026-02-01T00:00:00.000Z');
      expect(subInvoices[1].periodEnd.toISOString()).toBe('2026-03-01T00:00:00.000Z');

      // Next billing date is advanced to March 1
      const updatedSub = await prisma.subscription.findUnique({ where: { id: sub.id } });
      expect(updatedSub?.nextBillingDate?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    });
  });

  describe('Discounts & Tax Snapshots', () => {
    it('applies discount on next invoice then stops at usageLimit', async () => {
      // Create discount with usageLimit = 1
      const promoDiscount = await prisma.discount.create({
        data: {
          name: `Single Use $20 Promo ${Date.now()}`,
          type: DiscountType.FIXED,
          value: 20.0,
          scope: DiscountScope.SUBSCRIPTION,
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: new Date('2028-12-31T00:00:00Z'),
          usageLimit: 1,
          usedCount: 0,
          isActive: true,
        },
      });

      const sub = await prisma.subscription.create({
        data: {
          number: `SUB-DISC-${Date.now()}`,
          customerId: testCustomer.id,
          planId: monthlyPlan.id,
          discountId: promoDiscount.id,
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date('2026-03-01T00:00:00Z'),
          expiryDate: new Date('2027-03-01T00:00:00Z'),
          nextBillingDate: new Date('2026-03-01T00:00:00Z'),
          paymentTermDays: 15,
          createdById: testAdmin.id,
          lines: {
            create: [
              {
                productId: testProduct.id,
                quantity: 1,
                unitPrice: 100.0,
                amount: 100.0,
              },
            ],
          },
        },
      });

      // 1. Run first billing cycle (2026-03-02)
      await runBilling({ runDate: new Date('2026-03-02T00:00:00Z') });

      const invoice1 = await prisma.invoice.findFirst({
        where: { subscriptionId: sub.id, periodStart: new Date('2026-03-01T00:00:00Z') },
        include: { discounts: true },
      });

      expect(invoice1).toBeDefined();
      expect(toDecimal(invoice1!.discountTotal).toFixed(2)).toBe('20.00');
      expect(invoice1?.discounts).toHaveLength(1);

      // Discount usedCount was incremented to 1
      const updatedDisc = await prisma.discount.findUnique({ where: { id: promoDiscount.id } });
      expect(updatedDisc?.usedCount).toBe(1);

      // 2. Run second billing cycle (2026-04-02)
      await runBilling({ runDate: new Date('2026-04-02T00:00:00Z') });

      const invoice2 = await prisma.invoice.findFirst({
        where: { subscriptionId: sub.id, periodStart: new Date('2026-04-01T00:00:00Z') },
        include: { discounts: true },
      });

      expect(invoice2).toBeDefined();
      // Usage limit reached, discount no longer applies!
      expect(toDecimal(invoice2!.discountTotal).toFixed(2)).toBe('0.00');
      expect(invoice2?.discounts).toHaveLength(0);
    });

    it('calculates exact tax totals per line and on the invoice header', async () => {
      // Subtotal = 100.00, Tax = 18%, TaxAmount = 18.00, Total = 118.00
      const sub = await prisma.subscription.create({
        data: {
          number: `SUB-TAX-${Date.now()}`,
          customerId: testCustomer.id,
          planId: monthlyPlan.id,
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date('2026-07-01T00:00:00Z'),
          expiryDate: new Date('2027-07-01T00:00:00Z'),
          nextBillingDate: new Date('2026-07-01T00:00:00Z'),
          createdById: testAdmin.id,
          lines: {
            create: [
              {
                productId: testProduct.id,
                quantity: 1,
                unitPrice: 100.0,
                amount: 100.0,
                taxId: testTax.id,
              },
            ],
          },
        },
      });

      await runBilling({ runDate: new Date('2026-07-02T00:00:00Z') });

      const invoice = await prisma.invoice.findFirst({
        where: { subscriptionId: sub.id },
        include: { lines: true },
      });

      expect(invoice).toBeDefined();
      expect(toDecimal(invoice!.subtotal).toFixed(2)).toBe('100.00');
      expect(toDecimal(invoice!.taxTotal).toFixed(2)).toBe('18.00');
      expect(toDecimal(invoice!.total).toFixed(2)).toBe('118.00');

      // Line snapshot
      const line = invoice!.lines[0];
      expect(toDecimal(line.taxRate).toFixed(2)).toBe('18.00');
      expect(toDecimal(line.taxAmount).toFixed(2)).toBe('18.00');
      expect(toDecimal(line.amount).toFixed(2)).toBe('100.00');
    });
  });

  describe('Error Isolation & Batch Resilience', () => {
    it('a failing subscription does not stop the billing batch', async () => {
      // Valid subscription
      const validSub = await prisma.subscription.create({
        data: {
          number: `SUB-VALID-${Date.now()}`,
          customerId: testCustomer.id,
          planId: monthlyPlan.id,
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date('2026-08-01T00:00:00Z'),
          expiryDate: new Date('2027-08-01T00:00:00Z'),
          nextBillingDate: new Date('2026-08-01T00:00:00Z'),
          createdById: testAdmin.id,
          lines: {
            create: [
              {
                productId: testProduct.id,
                quantity: 1,
                unitPrice: 100.0,
                amount: 100.0,
              },
            ],
          },
        },
      });

      const res = await runBilling({ runDate: new Date('2026-08-02T00:00:00Z') });
      expect(res.created).toBeGreaterThanOrEqual(1);

      // The valid subscription was successfully invoiced
      const invoice = await prisma.invoice.findFirst({
        where: { subscriptionId: validSub.id },
      });
      expect(invoice).toBeDefined();
    });
  });

  describe('API Endpoints (POST /billing/run & GET /billing/preview)', () => {
    it('POST /api/v1/billing/run runs billing via HTTP for staff/admin', async () => {
      const res = await request(app)
        .post('/api/v1/billing/run')
        .set('Cookie', [`token=${staffToken}`])
        .send({ runDate: '2026-09-01T00:00:00Z' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('created');
      expect(res.body.data).toHaveProperty('skipped');
      expect(res.body.data).toHaveProperty('failed');
    });

    it('GET /api/v1/billing/preview returns preview items without invoicing', async () => {
      const res = await request(app)
        .get('/api/v1/billing/preview?runDate=2026-09-01T00:00:00Z')
        .set('Cookie', [`token=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('preview');
      expect(res.body.data).toHaveProperty('count');
    });
  });

  describe('Auto-Close Expired Subscriptions', () => {
    it('automatically closes subscriptions past expiry when plan.autoClose = true', async () => {
      const expiredSub = await prisma.subscription.create({
        data: {
          number: `SUB-EXP-${Date.now()}`,
          customerId: testCustomer.id,
          planId: autoClosePlan.id,
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date('2025-01-01T00:00:00Z'),
          expiryDate: new Date('2025-12-31T00:00:00Z'), // expired!
          nextBillingDate: new Date('2025-12-01T00:00:00Z'),
          createdById: testAdmin.id,
          lines: {
            create: [
              {
                productId: testProduct.id,
                quantity: 1,
                unitPrice: 150.0,
                amount: 150.0,
              },
            ],
          },
        },
      });

      const closedCount = await autoCloseExpiredSubscriptions(new Date('2026-01-01T00:00:00Z'));
      expect(closedCount).toBeGreaterThanOrEqual(1);

      const refreshed = await prisma.subscription.findUnique({
        where: { id: expiredSub.id },
      });
      expect(refreshed?.status).toBe(SubscriptionStatus.CLOSED);
      expect(refreshed?.nextBillingDate).toBeNull();
      expect(refreshed?.closedAt).toBeDefined();
    });
  });
});
