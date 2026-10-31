import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../middleware/auth';
import { Role, BillingPeriod } from '@prisma/client';

const app = createApp();

describe('Plans Module (P2-2)', () => {
  let adminToken: string;
  let staffToken: string;
  let customerToken: string;

  beforeEach(async () => {
    const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
    const staff = await prisma.user.findFirst({ where: { role: Role.STAFF } });
    const customer = await prisma.user.findFirst({ where: { role: Role.CUSTOMER } });

    adminToken = signToken({
      userId: admin!.id,
      role: Role.ADMIN,
      email: admin!.email,
    });

    staffToken = signToken({
      userId: staff!.id,
      role: Role.STAFF,
      email: staff!.email,
    });

    customerToken = signToken({
      userId: customer!.id,
      role: Role.CUSTOMER,
      email: customer!.email,
    });
  });

  describe('GET /api/v1/plans & /api/v1/plans/available', () => {
    it('allows ADMIN and STAFF to list plans with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/plans')
        .set('Cookie', [`token=${staffToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();

      if (res.body.data.length > 0) {
        expect(typeof res.body.data[0].price).toBe('string');
        expect(res.body.data[0].price).toMatch(/^\d+\.\d{2}$/);
      }
    });

    it('allows STAFF to fetch available plans for today', async () => {
      const res = await request(app)
        .get('/api/v1/plans/available')
        .set('Cookie', [`token=${staffToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.plans).toBeInstanceOf(Array);
      expect(res.body.data.plans.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 403 for CUSTOMER', async () => {
      const res = await request(app)
        .get('/api/v1/plans')
        .set('Cookie', [`token=${customerToken}`]);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/plans (Validation & Creation)', () => {
    it('allows ADMIN to create a plan with all flags', async () => {
      const name = `Pro Plan - ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          name,
          price: 149.0,
          billingPeriod: BillingPeriod.MONTHLY,
          minQuantity: 2,
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2027-01-01T00:00:00.000Z',
          autoClose: false,
          closable: true,
          pausable: true,
          renewable: true,
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.plan.name).toBe(name);
      expect(res.body.data.plan.price).toBe('149.00');
      expect(res.body.data.plan.minQuantity).toBe(2);
      expect(res.body.data.plan.pausable).toBe(true);
    });

    it('rejects creation when endDate is before or equal to startDate', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          name: 'Invalid Date Plan',
          price: 99.0,
          billingPeriod: BillingPeriod.MONTHLY,
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2026-05-01T00:00:00.000Z', // Earlier!
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects creation when minQuantity < 1', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          name: 'Zero Qty Plan',
          price: 99.0,
          billingPeriod: BillingPeriod.MONTHLY,
          minQuantity: 0,
          startDate: '2026-01-01T00:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 403 when STAFF attempts to create a plan', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Cookie', [`token=${staffToken}`])
        .send({
          name: 'Staff Plan',
          price: 99.0,
          billingPeriod: BillingPeriod.MONTHLY,
          startDate: '2026-01-01T00:00:00.000Z',
        });

      expect(res.status).toBe(403);
    });
  });
});

