import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../middleware/auth';
import { Role, ProductType } from '@prisma/client';

const app = createApp();

describe('Products & Variants Module (P2-1)', () => {
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

  describe('GET /api/v1/products', () => {
    it('allows ADMIN and STAFF to list products with type & search filters', async () => {
      const res = await request(app)
        .get('/api/v1/products?page=1&pageSize=10')
        .set('Cookie', [`token=${staffToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();

      if (res.body.data.length > 0) {
        const prod = res.body.data[0];
        expect(typeof prod.salesPrice).toBe('string');
        expect(prod.salesPrice).toMatch(/^\d+\.\d{2}$/);
      }
    });

    it('returns 403 for CUSTOMER', async () => {
      const res = await request(app)
        .get('/api/v1/products')
        .set('Cookie', [`token=${customerToken}`]);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/products & Variants', () => {
    it('allows ADMIN to create product with salesPrice and costPrice', async () => {
      const name = `CRM Enterprise - ${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/products')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          name,
          type: ProductType.SOFTWARE,
          salesPrice: 299.0,
          costPrice: 80.0,
          notes: 'Customer relationship system',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.product.name).toBe(name);
      expect(res.body.data.product.salesPrice).toBe('299.00');
      expect(res.body.data.product.costPrice).toBe('80.00');

      const productId = res.body.data.product.id;

      // Add variant: Brand = Odoo adds 560
      const variantRes = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Cookie', [`token=${adminToken}`])
        .send({
          attribute: 'Brand',
          value: 'Odoo',
          extraPrice: 560.0,
        });

      expect(variantRes.status).toBe(201);
      expect(variantRes.body.data.variant.attribute).toBe('Brand');
      expect(variantRes.body.data.variant.value).toBe('Odoo');
      expect(variantRes.body.data.variant.extraPrice).toBe('560.00');

      // Duplicate variant attribute + value rejected
      const dupRes = await request(app)
        .post(`/api/v1/products/${productId}/variants`)
        .set('Cookie', [`token=${adminToken}`])
        .send({
          attribute: 'Brand',
          value: 'Odoo',
          extraPrice: 560.0,
        });

      expect(dupRes.status).toBe(409);
    });

    it('rejects negative prices with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          name: 'Negative Price Item',
          type: ProductType.GOODS,
          salesPrice: -20.0,
          costPrice: 10.0,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 403 when STAFF attempts to create a product', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Cookie', [`token=${staffToken}`])
        .send({
          name: 'Staff Unauthorized Product',
          type: ProductType.SERVICE,
          salesPrice: 50.0,
          costPrice: 20.0,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/products/:id (Soft-deactivate rule)', () => {
    it('soft-deactivates product if used in subscription lines', async () => {
      // Create a product
      const product = await prisma.product.create({
        data: {
          name: `Subscribed Item ${Date.now()}`,
          type: ProductType.SERVICE,
          salesPrice: 100.0,
          costPrice: 30.0,
          isActive: true,
        },
      });

      // Find an active customer and plan to attach subscription line
      const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
      const customer = await prisma.user.findFirst({ where: { role: Role.CUSTOMER } });
      const plan = await prisma.plan.findFirst();

      const sub = await prisma.subscription.create({
        data: {
          number: `SUB-TEST-${Date.now()}`,
          customerId: customer!.id,
          createdById: admin!.id,
          planId: plan!.id,
          startDate: new Date(),
          expiryDate: new Date(Date.now() + 30 * 86400000),
          lines: {
            create: {
              productId: product.id,
              quantity: 1,
              unitPrice: 100.0,
              amount: 100.0,
            },
          },
        },
      });

      // Try to delete the product
      const delRes = await request(app)
        .delete(`/api/v1/products/${product.id}`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(delRes.status).toBe(200);
      expect(delRes.body.data.softDeleted).toBe(true);

      const dbProd = await prisma.product.findUnique({ where: { id: product.id } });
      expect(dbProd?.isActive).toBe(false);

      // Clean up test subscription
      await prisma.subscriptionLine.deleteMany({ where: { subscriptionId: sub.id } });
      await prisma.subscription.delete({ where: { id: sub.id } });
      await prisma.product.delete({ where: { id: product.id } });
    });
  });
});
