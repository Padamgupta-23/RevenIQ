import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { requireAuth, requireRole, signToken } from './auth.js';
import { errorHandler } from './errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { Role } from '@prisma/client';

describe('auth middleware', () => {
  let activeUserId: string;
  let inactiveUserId: string;

  beforeEach(async () => {
    // Clear and create test users
    await prisma.user.deleteMany({
      where: { email: { in: ['test-active@brightloop.test', 'test-inactive@brightloop.test'] } },
    });

    const activeUser = await prisma.user.create({
      data: {
        email: 'test-active@brightloop.test',
        passwordHash: 'dummy-hash',
        name: 'Active Staff',
        role: Role.STAFF,
        isActive: true,
      },
    });
    activeUserId = activeUser.id;

    const inactiveUser = await prisma.user.create({
      data: {
        email: 'test-inactive@brightloop.test',
        passwordHash: 'dummy-hash',
        name: 'Inactive User',
        role: Role.CUSTOMER,
        isActive: false,
      },
    });
    inactiveUserId = inactiveUser.id;
  });

  const createApp = () => {
    const testApp = express();
    testApp.use(cookieParser());
    testApp.use(express.json());

    testApp.get('/protected', requireAuth, (req, res) => {
      res.json({ user: req.user });
    });

    testApp.get('/admin-only', requireAuth, requireRole(Role.ADMIN), (req, res) => {
      res.json({ user: req.user });
    });

    testApp.get('/staff-or-admin', requireAuth, requireRole(Role.ADMIN, Role.STAFF), (req, res) => {
      res.json({ user: req.user });
    });

    testApp.use(errorHandler);
    return testApp;
  };

  it('rejects unauthenticated requests with 401', async () => {
    const testApp = createApp();
    const res = await request(testApp).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('accepts valid JWT cookie and loads user data', async () => {
    const testApp = createApp();
    const token = signToken({
      userId: activeUserId,
      role: Role.STAFF,
      email: 'test-active@brightloop.test',
    });

    const res = await request(testApp)
      .get('/protected')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: activeUserId,
      role: Role.STAFF,
      email: 'test-active@brightloop.test',
    });
  });

  it('rejects deactivated user with 403', async () => {
    const testApp = createApp();
    const token = signToken({
      userId: inactiveUserId,
      role: Role.CUSTOMER,
      email: 'test-inactive@brightloop.test',
    });

    const res = await request(testApp)
      .get('/protected')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('deactivated');
  });

  it('enforces role restrictions (requireRole)', async () => {
    const testApp = createApp();
    const token = signToken({
      userId: activeUserId,
      role: Role.STAFF,
      email: 'test-active@brightloop.test',
    });

    // Staff allowed
    const resAllowed = await request(testApp)
      .get('/staff-or-admin')
      .set('Cookie', [`token=${token}`]);
    expect(resAllowed.status).toBe(200);

    // Admin-only forbidden for staff
    const resForbidden = await request(testApp)
      .get('/admin-only')
      .set('Cookie', [`token=${token}`]);
    expect(resForbidden.status).toBe(403);
    expect(resForbidden.body.error.code).toBe('FORBIDDEN');
  });
});
