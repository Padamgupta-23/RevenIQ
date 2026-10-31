import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { signToken } from '../../middleware/auth.js';
import { Role, ProductType, BillingPeriod, SubscriptionStatus } from '@prisma/client';

const app = createApp();

describe('Subscriptions Module (P3-1)', () => {
  let adminToken: string;
  let staffToken: string;
  let customerToken: string;
  let otherCustomerToken: string;

  let testAdmin: any;
  let testCustomer: any;
  let otherCustomer: any;
  let testPlan: any;
  let testProduct: any;
  let testVariant: any;
  let testTemplate: any;

  beforeEach(async () => {
    testAdmin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
    testCustomer = await prisma.user.findFirst({ where: { role: Role.CUSTOMER } });
    
    // Find or create other customer
    otherCustomer = await prisma.user.findFirst({
      where: { role: Role.CUSTOMER, NOT: { id: testCustomer!.id } },
    });
    if (!otherCustomer) {
      otherCustomer = await prisma.user.create({
        data: {
          email: `other-${Date.now()}@test.com`,
          passwordHash: 'dummy',
          name: 'Other Customer',
          role: Role.CUSTOMER,
        },
      });
    }

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

    otherCustomerToken = signToken({
      userId: otherCustomer.id,
      role: Role.CUSTOMER,
      email: otherCustomer.email,
    });

    // Create a clean plan
    testPlan = await prisma.plan.create({
      data: {
        name: `Test Plan ${Date.now()}`,
        price: 99.0,
        billingPeriod: BillingPeriod.MONTHLY,
        minQuantity: 2,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2028-12-31T00:00:00Z'),
        pausable: true,
        closable: true,
        renewable: true,
        autoClose: false,
        isActive: true,
      },
    });

    // Create a test product with variant
    testProduct = await prisma.product.create({
      data: {
        name: `Test Software ${Date.now()}`,
        type: ProductType.SOFTWARE,
        salesPrice: 50.0,
        costPrice: 20.0,
        isActive: true,
      },
    });

    testVariant = await prisma.productVariant.create({
      data: {
        productId: testProduct.id,
        attribute: 'License',
        value: 'Enterprise',
        extraPrice: 25.0,
      },
    });

    // Create quotation template
    testTemplate = await prisma.quotationTemplate.create({
      data: {
        name: `Template ${Date.now()}`,
        planId: testPlan.id,
        validityDays: 14,
        isActive: true,
        lines: {
          create: [
            {
              productId: testProduct.id,
              variantId: testVariant.id,
              quantity: 2,
            },
          ],
        },
      },
    });
  });

  describe('POST /api/v1/subscriptions', () => {
    it('creates a subscription with auto-numbering and status DRAFT', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          customerId: testCustomer.id,
          planId: testPlan.id,
          startDate: '2026-06-01T00:00:00.000Z',
          expiryDate: '2027-06-01T00:00:00.000Z',
          paymentTermDays: 15,
          lines: [
            {
              productId: testProduct.id,
              variantId: testVariant.id,
              quantity: 2,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.number).toMatch(/^SUB-\d{6}$/);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.lines).toHaveLength(1);
      // unitPrice = 50 + 25 = 75.00, amount = 2 * 75 = 150.00
      expect(res.body.data.lines[0].unitPrice).toBe('75.00');
      expect(res.body.data.lines[0].amount).toBe('150.00');
    });

    it('enforces quantity >= plan.minQuantity (rejects quantity < minQuantity)', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          customerId: testCustomer.id,
          planId: testPlan.id,
          startDate: '2026-06-01T00:00:00.000Z',
          expiryDate: '2027-06-01T00:00:00.000Z',
          lines: [
            {
              productId: testProduct.id,
              quantity: 1, // minQuantity is 2
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/minimum quantity/i);
    });

    it('enforces plan availability on startDate', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          customerId: testCustomer.id,
          planId: testPlan.id,
          startDate: '2025-01-01T00:00:00.000Z', // plan starts 2026-01-01
          expiryDate: '2025-12-31T00:00:00.000Z',
          lines: [{ productId: testProduct.id, quantity: 2 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Plan is not available/i);
    });
  });

  describe('POST /api/v1/subscriptions/from-template/:templateId', () => {
    it('creates a quotation subscription from template with quotationValidUntil', async () => {
      const res = await request(app)
        .post(`/api/v1/subscriptions/from-template/${testTemplate.id}`)
        .set('Cookie', [`token=${staffToken}`])
        .send({
          customerId: testCustomer.id,
          startDate: '2026-06-01T00:00:00.000Z',
          expiryDate: '2027-06-01T00:00:00.000Z',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('QUOTATION');
      expect(res.body.data.templateId).toBe(testTemplate.id);
      expect(res.body.data.quotationValidUntil).toBeDefined();
      expect(res.body.data.lines).toHaveLength(1);
    });
  });

  describe('Transition Service & State Machine', () => {
    it('executes the full happy path: DRAFT -> QUOTATION -> CONFIRMED -> ACTIVE -> CLOSED', async () => {
      // 1. Create DRAFT
      const createRes = await request(app)
        .post('/api/v1/subscriptions')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          customerId: testCustomer.id,
          planId: testPlan.id,
          startDate: '2026-06-01T00:00:00.000Z',
          expiryDate: '2027-06-01T00:00:00.000Z',
          lines: [{ productId: testProduct.id, quantity: 2 }],
        });
      const subId = createRes.body.data.id;

      // 2. Quote: DRAFT -> QUOTATION
      const quoteRes = await request(app)
        .post(`/api/v1/subscriptions/${subId}/quote`)
        .set('Cookie', [`token=${adminToken}`]);
      expect(quoteRes.status).toBe(200);
      expect(quoteRes.body.data.status).toBe('QUOTATION');

      // 3. Confirm: QUOTATION -> CONFIRMED
      const confirmRes = await request(app)
        .post(`/api/v1/subscriptions/${subId}/confirm`)
        .set('Cookie', [`token=${adminToken}`]);
      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.status).toBe('CONFIRMED');

      // 4. Activate: CONFIRMED -> ACTIVE (sets nextBillingDate = startDate)
      const activateRes = await request(app)
        .post(`/api/v1/subscriptions/${subId}/activate`)
        .set('Cookie', [`token=${adminToken}`]);
      expect(activateRes.status).toBe(200);
      expect(activateRes.body.data.status).toBe('ACTIVE');
      expect(activateRes.body.data.nextBillingDate).toBe('2026-06-01T00:00:00.000Z');

      // 5. Close: ACTIVE -> CLOSED
      const closeRes = await request(app)
        .post(`/api/v1/subscriptions/${subId}/close`)
        .set('Cookie', [`token=${adminToken}`]);
      expect(closeRes.status).toBe(200);
      expect(closeRes.body.data.status).toBe('CLOSED');
      expect(closeRes.body.data.nextBillingDate).toBeNull();
    });

    it('rejects confirmation if quotation is expired (409 Conflict)', async () => {
      // Create subscription with expired quotationValidUntil
      const createRes = await request(app)
        .post('/api/v1/subscriptions')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          customerId: testCustomer.id,
          planId: testPlan.id,
          startDate: '2026-06-01T00:00:00.000Z',
          expiryDate: '2027-06-01T00:00:00.000Z',
          lines: [{ productId: testProduct.id, quantity: 2 }],
        });
      const subId = createRes.body.data.id;

      // Transition to quotation
      await request(app)
        .post(`/api/v1/subscriptions/${subId}/quote`)
        .set('Cookie', [`token=${adminToken}`]);

      // Artificially expire the quotation
      await prisma.subscription.update({
        where: { id: subId },
        data: { quotationValidUntil: new Date('2020-01-01T00:00:00Z') },
      });

      const confirmRes = await request(app)
        .post(`/api/v1/subscriptions/${subId}/confirm`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(confirmRes.status).toBe(409);
      expect(confirmRes.body.error.message).toMatch(/expired/i);
    });

    it('rejects editing lines once confirmed or active (409 Conflict)', async () => {
      const createRes = await request(app)
        .post('/api/v1/subscriptions')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          customerId: testCustomer.id,
          planId: testPlan.id,
          startDate: '2026-06-01T00:00:00.000Z',
          expiryDate: '2027-06-01T00:00:00.000Z',
          lines: [{ productId: testProduct.id, quantity: 2 }],
        });
      const subId = createRes.body.data.id;

      await request(app).post(`/api/v1/subscriptions/${subId}/confirm`).set('Cookie', [`token=${adminToken}`]);

      // Attempt editing lines
      const patchRes = await request(app)
        .patch(`/api/v1/subscriptions/${subId}`)
        .set('Cookie', [`token=${adminToken}`])
        .send({
          lines: [{ productId: testProduct.id, quantity: 3 }],
        });

      expect(patchRes.status).toBe(409);
      expect(patchRes.body.error.message).toMatch(/Subscription lines can only be edited/i);
    });

    it('respects plan.pausable flag (409 if plan not pausable)', async () => {
      const unpausablePlan = await prisma.plan.create({
        data: {
          name: `Unpausable Plan ${Date.now()}`,
          price: 50.0,
          billingPeriod: BillingPeriod.MONTHLY,
          startDate: new Date('2026-01-01T00:00:00Z'),
          pausable: false, // NOT pausable
          isActive: true,
        },
      });

      const createRes = await request(app)
        .post('/api/v1/subscriptions')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          customerId: testCustomer.id,
          planId: unpausablePlan.id,
          startDate: '2026-06-01T00:00:00.000Z',
          expiryDate: '2027-06-01T00:00:00.000Z',
          lines: [{ productId: testProduct.id, quantity: 1 }],
        });
      const subId = createRes.body.data.id;

      await request(app).post(`/api/v1/subscriptions/${subId}/confirm`).set('Cookie', [`token=${adminToken}`]);
      await request(app).post(`/api/v1/subscriptions/${subId}/activate`).set('Cookie', [`token=${adminToken}`]);

      const pauseRes = await request(app)
        .post(`/api/v1/subscriptions/${subId}/pause`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(pauseRes.status).toBe(409);
      expect(pauseRes.body.error.message).toMatch(/does not permit pausing/i);
    });

    it('respects plan.renewable flag (409 if plan not renewable)', async () => {
      const unrenewablePlan = await prisma.plan.create({
        data: {
          name: `Unrenewable Plan ${Date.now()}`,
          price: 50.0,
          billingPeriod: BillingPeriod.MONTHLY,
          startDate: new Date('2026-01-01T00:00:00Z'),
          renewable: false, // NOT renewable
          isActive: true,
        },
      });

      const createRes = await request(app)
        .post('/api/v1/subscriptions')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          customerId: testCustomer.id,
          planId: unrenewablePlan.id,
          startDate: '2026-06-01T00:00:00.000Z',
          expiryDate: '2027-06-01T00:00:00.000Z',
          lines: [{ productId: testProduct.id, quantity: 1 }],
        });
      const subId = createRes.body.data.id;

      await request(app).post(`/api/v1/subscriptions/${subId}/confirm`).set('Cookie', [`token=${adminToken}`]);
      await request(app).post(`/api/v1/subscriptions/${subId}/activate`).set('Cookie', [`token=${adminToken}`]);

      const renewRes = await request(app)
        .post(`/api/v1/subscriptions/${subId}/renew`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(renewRes.status).toBe(409);
      expect(renewRes.body.error.message).toMatch(/does not permit subscription renewal/i);
    });
  });

  describe('Customer Data Isolation', () => {
    it('CUSTOMER cannot access another customer subscription (returns 404)', async () => {
      const createRes = await request(app)
        .post('/api/v1/subscriptions')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          customerId: testCustomer.id, // Belongs to testCustomer
          planId: testPlan.id,
          startDate: '2026-06-01T00:00:00.000Z',
          expiryDate: '2027-06-01T00:00:00.000Z',
          lines: [{ productId: testProduct.id, quantity: 2 }],
        });
      const subId = createRes.body.data.id;

      // otherCustomer attempts to access
      const res = await request(app)
        .get(`/api/v1/subscriptions/${subId}`)
        .set('Cookie', [`token=${otherCustomerToken}`]);

      expect(res.status).toBe(404);
    });
  });
});

