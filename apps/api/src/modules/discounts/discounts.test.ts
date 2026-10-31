import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../middleware/auth';
import { Role, DiscountType, DiscountScope } from '@prisma/client';

const app = createApp();

describe('Discounts Module (P2-3)', () => {
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

  describe('GET /api/v1/discounts', () => {
    it('allows ADMIN and STAFF to list discounts with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/discounts')
        .set('Cookie', [`token=${staffToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();
    });

    it('returns 403 for CUSTOMER', async () => {
      const res = await request(app)
        .get('/api/v1/discounts')
        .set('Cookie', [`token=${customerToken}`]);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/discounts (Creation & Rules)', () => {
    it('allows ADMIN to create a percentage discount (<= 100%)', async () => {
      const name = `Promo 25% - ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/discounts')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          name,
          type: DiscountType.PERCENTAGE,
          value: 25.0,
          scope: DiscountScope.SUBSCRIPTION,
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-12-31T00:00:00.000Z',
          usageLimit: 50,
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.discount.name).toBe(name);
      expect(res.body.data.discount.value).toBe('25.00');
      expect(res.body.data.discount.usedCount).toBe(0);
    });

    it('rejects percentage discount > 100%', async () => {
      const res = await request(app)
        .post('/api/v1/discounts')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          name: 'Invalid 150% Promo',
          type: DiscountType.PERCENTAGE,
          value: 150.0,
          scope: DiscountScope.SUBSCRIPTION,
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-12-31T00:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects discount when endDate <= startDate', async () => {
      const res = await request(app)
        .post('/api/v1/discounts')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          name: 'Invalid Date Promo',
          type: DiscountType.FIXED,
          value: 30.0,
          scope: DiscountScope.SUBSCRIPTION,
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2026-05-01T00:00:00.000Z',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 403 when STAFF attempts to create discount', async () => {
      const res = await request(app)
        .post('/api/v1/discounts')
        .set('Cookie', [`token=${staffToken}`])
        .send({
          name: 'Unauthorized Staff Promo',
          type: DiscountType.FIXED,
          value: 10.0,
          scope: DiscountScope.SUBSCRIPTION,
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-12-31T00:00:00.000Z',
        });

      expect(res.status).toBe(403);
    });
  });
});

