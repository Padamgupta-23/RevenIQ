import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { signToken } from '../../middleware/auth.js';
import { Role, BillingPeriod, InvoiceStatus, SubscriptionStatus } from '@prisma/client';

const app = createApp();

describe('Invoices Module (P3-3)', () => {
  let adminToken: string;
  let staffToken: string;
  let customerToken: string;

  let testAdmin: any;
  let testCustomer: any;
  let testPlan: any;
  let testSubscription: any;
  let testInvoice: any;

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

    customerToken = signToken({
      userId: testCustomer.id,
      role: Role.CUSTOMER,
      email: testCustomer.email,
    });

    testPlan = await prisma.plan.create({
      data: {
        name: `Plan ${Date.now()}`,
        price: 100.0,
        billingPeriod: BillingPeriod.MONTHLY,
        startDate: new Date('2026-01-01T00:00:00Z'),
        isActive: true,
      },
    });

    testSubscription = await prisma.subscription.create({
      data: {
        number: `SUB-INV-TEST-${Date.now()}`,
        customerId: testCustomer.id,
        planId: testPlan.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date('2026-01-01T00:00:00Z'),
        expiryDate: new Date('2027-01-01T00:00:00Z'),
        nextBillingDate: new Date('2026-02-01T00:00:00Z'),
        createdById: testAdmin.id,
      },
    });

    testInvoice = await prisma.invoice.create({
      data: {
        number: `INV-TEST-${Date.now()}`,
        subscriptionId: testSubscription.id,
        customerId: testCustomer.id,
        status: InvoiceStatus.DRAFT,
        periodStart: new Date('2026-01-01T00:00:00Z'),
        periodEnd: new Date('2026-02-01T00:00:00Z'),
        issueDate: new Date('2026-01-01T00:00:00Z'),
        dueDate: new Date('2026-01-16T00:00:00Z'),
        subtotal: 100.0,
        discountTotal: 0.0,
        taxTotal: 18.0,
        total: 118.0,
        amountPaid: 0.0,
        lines: {
          create: [
            {
              description: 'Enterprise Cloud Service Line',
              quantity: 1,
              unitPrice: 100.0,
              taxRate: 18.0,
              taxAmount: 18.0,
              amount: 100.0,
            },
          ],
        },
      },
    });
  });

  describe('GET /api/v1/invoices', () => {
    it('allows ADMIN and STAFF to list invoices with isOverdue and balance', async () => {
      const res = await request(app)
        .get('/api/v1/invoices?page=1&pageSize=10')
        .set('Cookie', [`token=${staffToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();

      const item = res.body.data.find((i: any) => i.id === testInvoice.id);
      expect(item).toBeDefined();
      expect(item.balance).toBe('118.00');
      expect(typeof item.isOverdue).toBe('boolean');
    });

    it('returns 403 for CUSTOMER (portal routes only)', async () => {
      const res = await request(app)
        .get('/api/v1/invoices')
        .set('Cookie', [`token=${customerToken}`]);

      expect(res.status).toBe(403);
    });

    it('filters overdue invoices correctly (overdue=true)', async () => {
      // Create confirmed invoice with past dueDate
      const overdueInvoice = await prisma.invoice.create({
        data: {
          number: `INV-OD-${Date.now()}`,
          subscriptionId: testSubscription.id,
          customerId: testCustomer.id,
          status: InvoiceStatus.CONFIRMED,
          periodStart: new Date('2025-01-01T00:00:00Z'),
          periodEnd: new Date('2025-02-01T00:00:00Z'),
          issueDate: new Date('2025-01-01T00:00:00Z'),
          dueDate: new Date('2025-01-15T00:00:00Z'), // in past
          subtotal: 50.0,
          discountTotal: 0.0,
          taxTotal: 0.0,
          total: 50.0,
          amountPaid: 0.0,
        },
      });

      const res = await request(app)
        .get('/api/v1/invoices?overdue=true')
        .set('Cookie', [`token=${adminToken}`]);

      expect(res.status).toBe(200);
      const found = res.body.data.find((i: any) => i.id === overdueInvoice.id);
      expect(found).toBeDefined();
      expect(found.isOverdue).toBe(true);
    });
  });

  describe('Invoice State Machine: confirm & cancel', () => {
    it('confirms a DRAFT invoice (DRAFT -> CONFIRMED)', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${testInvoice.id}/confirm`)
        .set('Cookie', [`token=${staffToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CONFIRMED');
    });

    it('rejects confirming an already confirmed invoice (409 Conflict)', async () => {
      await request(app)
        .post(`/api/v1/invoices/${testInvoice.id}/confirm`)
        .set('Cookie', [`token=${adminToken}`]);

      const res = await request(app)
        .post(`/api/v1/invoices/${testInvoice.id}/confirm`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/Cannot confirm/i);
    });

    it('cancels an invoice and does NOT roll back subscription nextBillingDate', async () => {
      const originalNextBilling = testSubscription.nextBillingDate.toISOString();

      const res = await request(app)
        .post(`/api/v1/invoices/${testInvoice.id}/cancel`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');

      // Verify subscription.nextBillingDate was NOT rolled back
      const sub = await prisma.subscription.findUnique({
        where: { id: testSubscription.id },
      });
      expect(sub?.nextBillingDate?.toISOString()).toBe(originalNextBilling);
    });

    it('rejects cancelling a PAID invoice (409 Conflict)', async () => {
      const paidInvoice = await prisma.invoice.create({
        data: {
          number: `INV-PAID-${Date.now()}`,
          subscriptionId: testSubscription.id,
          customerId: testCustomer.id,
          status: InvoiceStatus.PAID,
          periodStart: new Date('2026-02-01T00:00:00Z'),
          periodEnd: new Date('2026-03-01T00:00:00Z'),
          issueDate: new Date('2026-02-01T00:00:00Z'),
          dueDate: new Date('2026-02-15T00:00:00Z'),
          subtotal: 100.0,
          discountTotal: 0.0,
          taxTotal: 0.0,
          total: 100.0,
          amountPaid: 100.0,
        },
      });

      const res = await request(app)
        .post(`/api/v1/invoices/${paidInvoice.id}/cancel`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/PAID/i);
    });
  });

  describe('Invoice Communication & Printing', () => {
    it('sends invoice via email and records sentAt timestamp', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${testInvoice.id}/send`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.sentAt).toBeDefined();
      expect(new Date(res.body.data.sentAt).getTime()).toBeGreaterThan(0);
    });

    it('GET /api/v1/invoices/:id/print returns styled HTML document', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${testInvoice.id}/print`)
        .set('Cookie', [`token=${staffToken}`]);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('RevenIQ');
      expect(res.text).toContain(testInvoice.number);
      expect(res.text).toContain('Enterprise Cloud Service Line');
      expect(res.text).toContain('@media print');
    });
  });
});

