import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../middleware/auth';
import { Role } from '@prisma/client';

const app = createApp();

describe('Templates Module (P2-3)', () => {
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

  describe('GET /api/v1/templates', () => {
    it('allows ADMIN and STAFF to list quotation templates', async () => {
      const res = await request(app)
        .get('/api/v1/templates')
        .set('Cookie', [`token=${staffToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();
    });

    it('returns 403 for CUSTOMER', async () => {
      const res = await request(app)
        .get('/api/v1/templates')
        .set('Cookie', [`token=${customerToken}`]);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/templates (Creation with lines)', () => {
    it('allows ADMIN to create a template with lines', async () => {
      const plan = await prisma.plan.findFirst();
      const product = await prisma.product.findFirst();

      const name = `Custom Bundle - ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/templates')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          name,
          planId: plan!.id,
          validityDays: 45,
          lines: [
            {
              productId: product!.id,
              quantity: 2,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.template.name).toBe(name);
      expect(res.body.data.template.validityDays).toBe(45);
      expect(res.body.data.template.lines.length).toBe(1);
      expect(res.body.data.template.lines[0].quantity).toBe(2);
    });

    it('returns 403 when STAFF attempts to create a template', async () => {
      const plan = await prisma.plan.findFirst();
      const product = await prisma.product.findFirst();

      const res = await request(app)
        .post('/api/v1/templates')
        .set('Cookie', [`token=${staffToken}`])
        .send({
          name: 'Staff Unauthorized Template',
          planId: plan!.id,
          lines: [{ productId: product!.id, quantity: 1 }],
        });

      expect(res.status).toBe(403);
    });
  });
});

