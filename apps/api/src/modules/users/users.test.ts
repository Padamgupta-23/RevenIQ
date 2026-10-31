import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { signToken } from '../../middleware/auth';
import { Role } from '@prisma/client';

const app = createApp();

describe('Users & RBAC Module (P1-2)', () => {
  let adminUser: { id: string; email: string; role: Role };
  let staffUser: { id: string; email: string; role: Role };
  let customerUser: { id: string; email: string; role: Role };

  let adminToken: string;
  let staffToken: string;
  let customerToken: string;

  const adminEmail = 'admin.rbac@reveniq.test';
  const staffEmail = 'staff.rbac@reveniq.test';
  const customerEmail = 'customer.rbac@reveniq.test';
  const targetEmail = 'target.user@reveniq.test';
  const newStaffEmail = 'newstaff@reveniq.test';

  beforeEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            adminEmail,
            staffEmail,
            customerEmail,
            targetEmail,
            newStaffEmail,
            'another.customer@reveniq.test',
          ],
        },
      },
    });

    const hash = await bcrypt.hash('SecurePassword123!', 10);

    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hash,
        name: 'Admin Test',
        role: Role.ADMIN,
        isActive: true,
      },
    });

    staffUser = await prisma.user.create({
      data: {
        email: staffEmail,
        passwordHash: hash,
        name: 'Staff Test',
        role: Role.STAFF,
        isActive: true,
      },
    });

    customerUser = await prisma.user.create({
      data: {
        email: customerEmail,
        passwordHash: hash,
        name: 'Customer Test',
        role: Role.CUSTOMER,
        isActive: true,
      },
    });

    adminToken = signToken({
      userId: adminUser.id,
      role: adminUser.role,
      email: adminUser.email,
    });

    staffToken = signToken({
      userId: staffUser.id,
      role: staffUser.role,
      email: staffUser.email,
    });

    customerToken = signToken({
      userId: customerUser.id,
      role: customerUser.role,
      email: customerUser.email,
    });
  });

  describe('GET /api/v1/users (Listing & Filters)', () => {
    it('allows ADMIN to list all users with server-side pagination and meta', async () => {
      const res = await request(app)
        .get('/api/v1/users?page=1&pageSize=10')
        .set('Cookie', [`token=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.pageSize).toBe(10);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(3);

      // Verify passwordHash is never returned
      for (const u of res.body.data) {
        expect(u.passwordHash).toBeUndefined();
      }
    });

    it('allows ADMIN to filter users by role', async () => {
      const res = await request(app)
        .get('/api/v1/users?role=STAFF')
        .set('Cookie', [`token=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.every((u: any) => u.role === 'STAFF')).toBe(true);
    });

    it('allows ADMIN to search users by name or email', async () => {
      const res = await request(app)
        .get('/api/v1/users?search=Staff Test')
        .set('Cookie', [`token=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.some((u: any) => u.email === staffEmail)).toBe(true);
    });

    it('allows STAFF to list customers with ?role=CUSTOMER', async () => {
      const res = await request(app)
        .get('/api/v1/users?role=CUSTOMER')
        .set('Cookie', [`token=${staffToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.every((u: any) => u.role === 'CUSTOMER')).toBe(true);
    });

    it('returns 403 when STAFF attempts to list users without role=CUSTOMER', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Cookie', [`token=${staffToken}`]);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 403 when STAFF attempts to view staff or admin users', async () => {
      const res = await request(app)
        .get('/api/v1/users?role=STAFF')
        .set('Cookie', [`token=${staffToken}`]);

      expect(res.status).toBe(403);
    });

    it('returns 403 when CUSTOMER attempts to list users', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Cookie', [`token=${customerToken}`]);

      expect(res.status).toBe(403);
    });

    it('returns 403 when CUSTOMER attempts to list customers', async () => {
      const res = await request(app)
        .get('/api/v1/users?role=CUSTOMER')
        .set('Cookie', [`token=${customerToken}`]);

      expect(res.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/users/staff (Create Staff / Admin)', () => {
    it('allows ADMIN to create a new STAFF user', async () => {
      const res = await request(app)
        .post('/api/v1/users/staff')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          email: newStaffEmail,
          password: 'SecurePassword123!',
          name: 'New Staff Member',
          role: 'STAFF',
          company: 'RevenIQ Operations',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe(newStaffEmail);
      expect(res.body.data.user.role).toBe('STAFF');
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('allows ADMIN to create an ADMIN user', async () => {
      const res = await request(app)
        .post('/api/v1/users/staff')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          email: 'another.admin@reveniq.test',
          password: 'SecurePassword123!',
          name: 'Co-Admin User',
          role: 'ADMIN',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('ADMIN');

      // Cleanup
      await prisma.user.deleteMany({ where: { email: 'another.admin@reveniq.test' } });
    });

    it('fails with 409 if email is already registered', async () => {
      const res = await request(app)
        .post('/api/v1/users/staff')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          email: staffEmail,
          password: 'SecurePassword123!',
          name: 'Duplicate Staff',
          role: 'STAFF',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Email already registered');
    });

    it('fails with 400 when password violates security rules', async () => {
      const res = await request(app)
        .post('/api/v1/users/staff')
        .set('Cookie', [`token=${adminToken}`])
        .send({
          email: newStaffEmail,
          password: 'short',
          name: 'Bad Password Staff',
          role: 'STAFF',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 403 when STAFF tries to create a staff member', async () => {
      const res = await request(app)
        .post('/api/v1/users/staff')
        .set('Cookie', [`token=${staffToken}`])
        .send({
          email: newStaffEmail,
          password: 'SecurePassword123!',
          name: 'Unauthorized Staff',
          role: 'STAFF',
        });

      expect(res.status).toBe(403);
    });

    it('returns 403 when CUSTOMER tries to create a staff member', async () => {
      const res = await request(app)
        .post('/api/v1/users/staff')
        .set('Cookie', [`token=${customerToken}`])
        .send({
          email: newStaffEmail,
          password: 'SecurePassword123!',
          name: 'Unauthorized Customer',
          role: 'STAFF',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/users/:id (Update User)', () => {
    it('allows ADMIN to update a user profile (name, company, phone)', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${customerUser.id}`)
        .set('Cookie', [`token=${adminToken}`])
        .send({
          name: 'Updated Customer Name',
          company: 'Acme Corp Enterprise',
          phone: '+1-555-0199',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.name).toBe('Updated Customer Name');
      expect(res.body.data.user.company).toBe('Acme Corp Enterprise');
    });

    it('prevents an ADMIN from deactivating their own account (409 Conflict)', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${adminUser.id}`)
        .set('Cookie', [`token=${adminToken}`])
        .send({
          isActive: false,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Admin cannot deactivate their own account');
    });

    it('prevents an ADMIN from demoting their own account (409 Conflict)', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${adminUser.id}`)
        .set('Cookie', [`token=${adminToken}`])
        .send({
          role: 'STAFF',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Admin cannot demote their own account');
    });

    it('returns 403 when STAFF tries to update a user', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${customerUser.id}`)
        .set('Cookie', [`token=${staffToken}`])
        .send({
          name: 'Hacked Name',
        });

      expect(res.status).toBe(403);
    });

    it('returns 403 when CUSTOMER tries to update a user', async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${customerUser.id}`)
        .set('Cookie', [`token=${customerToken}`])
        .send({
          name: 'Self Update via Admin Endpoint',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/users/:id/deactivate (Deactivation)', () => {
    it('allows ADMIN to deactivate another user', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${customerUser.id}/deactivate`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.user.isActive).toBe(false);

      const dbUser = await prisma.user.findUnique({ where: { id: customerUser.id } });
      expect(dbUser?.isActive).toBe(false);
    });

    it('prevents an ADMIN from deactivating themselves via deactivate route (409)', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${adminUser.id}/deactivate`)
        .set('Cookie', [`token=${adminToken}`]);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Admin cannot deactivate their own account');
    });

    it('returns 403 when STAFF attempts to deactivate a user', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${customerUser.id}/deactivate`)
        .set('Cookie', [`token=${staffToken}`]);

      expect(res.status).toBe(403);
    });
  });
});

