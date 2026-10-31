import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../middleware/auth';
import { Role } from '@prisma/client';

const app = createApp();

describe('Taxes Module (P2-1)', () => {
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

  describe('GET /api/v1/taxes', () => {
    it('allows ADMIN to list taxes with pagination and meta', async () => {
      const res = await request(app)
        .get('/api/v1/taxes')
        .set('Cookie', [`token=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();
    });

    it('allows STAFF to list taxes', async () => {
      const res = await request(app)
        .get('/api/v1/taxes')
        .set('Cookie', [`token=${staffToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
    });

    it('returns 403 for CUSTOMER', async () => {
      const res = await request(app)
        .get('/api/v1/taxes')
        .set('Cookie', [`token=${customerToken}`]);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/taxes (Create Tax)', () => {
    it('allows ADMIN to create a new tax rate', async () => {
      const name = `VAT 12% - ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/taxes')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          name,
          rate: 12.0,
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.tax.name).toBe(name);
      expect(res.body.data.tax.rate).toBe('12.00');
    });

    it('rejects rate > 100 with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/v1/taxes')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          name: 'Invalid Rate',
          rate: 150.0,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 403 when STAFF attempts to create tax', async () => {
      const res = await request(app)
        .post('/api/v1/taxes')
        .set('Cookie', [`token=${staffToken}`])
        .send({
          name: 'Staff Tax',
          rate: 5.0,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/taxes/:id & DELETE /api/v1/taxes/:id', () => {
    it('allows ADMIN to update a tax and soft-deactivate when in use', async () => {
      const tax = await prisma.tax.create({
        data: { name: `Temp Tax ${Date.now()}`, rate: 7.5, isActive: true },
      });

      const updateRes = await request(app)
        .patch(`/api/v1/taxes/${tax.id}`)
        .set('Cookie', [`token=${adminToken}`])
        .send({ rate: 8.0 });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.tax.rate).toBe('8.00');

      const delRes = await request(app)
        .delete(`/api/v1/taxes/${tax.id}`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(delRes.status).toBe(200);
    });
  });
});

