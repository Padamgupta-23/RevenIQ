import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import crypto from 'crypto';

describe('Auth Module (P1-1)', () => {
  const testEmail = 'user.test@reveniq.test';
  const validPassword = 'SecurePassword123!';

  beforeEach(async () => {
    // Clean up test data
    await prisma.passwordResetToken.deleteMany({
      where: { user: { email: { in: [testEmail, 'other@reveniq.test', 'inactive@reveniq.test'] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [testEmail, 'other@reveniq.test', 'inactive@reveniq.test'] } },
    });
  });

  describe('Password rules validation', () => {
    it('fails when password is 8 characters or fewer', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: testEmail,
          password: 'Pass1!a', // 7 chars
          name: 'Test User',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const msg = JSON.stringify(res.body.error.details);
      expect(msg).toContain('more than 8 characters');
    });

    it('fails when password is missing uppercase letter', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: testEmail,
          password: 'securepassword123!',
          name: 'Test User',
        });

      expect(res.status).toBe(400);
      const msg = JSON.stringify(res.body.error.details);
      expect(msg).toContain('uppercase letter');
    });

    it('fails when password is missing lowercase letter', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: testEmail,
          password: 'SECUREPASSWORD123!',
          name: 'Test User',
        });

      expect(res.status).toBe(400);
      const msg = JSON.stringify(res.body.error.details);
      expect(msg).toContain('lowercase letter');
    });

    it('fails when password is missing special character', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: testEmail,
          password: 'SecurePassword123',
          name: 'Test User',
        });

      expect(res.status).toBe(400);
      const msg = JSON.stringify(res.body.error.details);
      expect(msg).toContain('special character');
    });

    it('accepts password meeting all criteria and creates CUSTOMER role', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: '  User.Test@RevenIQ.test  ', // test lowercase and trim
          password: validPassword,
          name: 'Test User',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.body.data.user.role).toBe('CUSTOMER');
      expect(res.body.data).toHaveProperty('token');
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });

  describe('Duplicate email check', () => {
    it('returns 409 with clear "Email already registered" message', async () => {
      // First signup
      await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: testEmail,
          password: validPassword,
          name: 'First User',
        });

      // Duplicate signup with different casing
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: testEmail.toUpperCase(),
          password: validPassword,
          name: 'Duplicate User',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toBe('Email already registered');
    });
  });

  describe('Login flow', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: testEmail,
          password: validPassword,
          name: 'Login User',
        });
    });

    it('rejects wrong password with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('rejects non-existent email with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'unknown@reveniq.test',
          password: validPassword,
        });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('logs in successfully and sets httpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: validPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(testEmail);
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('token=');
      expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
    });

    it('clears cookie on logout', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(200);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('GET /api/v1/auth/me returns current user', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: validPassword });

      const cookie = loginRes.headers['set-cookie'];

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', cookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.email).toBe(testEmail);
      expect(meRes.body.data.name).toBe('Login User');
    });
  });

  describe('Forgot and Reset Password', () => {
    it('always returns generic response for forgot-password', async () => {
      const resNonExistent = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'ghost@reveniq.test' });

      expect(resNonExistent.status).toBe(200);
      expect(resNonExistent.body.data.message).toContain('If that email address is in our database');

      // Create user
      await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: testEmail, password: validPassword, name: 'User' });

      const resExistent = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testEmail });

      expect(resExistent.status).toBe(200);
      expect(resExistent.body.data.message).toContain('If that email address is in our database');
    });

    it('resets password with valid token and rejects token reuse', async () => {
      const signupRes = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: testEmail, password: validPassword, name: 'User' });
      const userId = signupRes.body.data.user.id;

      // Manually create a known reset token
      const rawToken = 'known-raw-reset-token-for-test-1234';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const newPassword = 'BrandNewPassword999#';

      // Reset password
      const resetRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          password: newPassword,
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.data.message).toContain('Password has been reset successfully');

      // Verify login with old password fails
      const oldLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: validPassword });
      expect(oldLoginRes.status).toBe(401);

      // Verify login with new password succeeds
      const newLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testEmail, password: newPassword });
      expect(newLoginRes.status).toBe(200);

      // Reusing the token must fail!
      const reuseRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          password: 'AnotherPassword888!',
        });

      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.error.code).toBe('VALIDATION_ERROR');
      expect(reuseRes.body.error.message).toContain('Invalid or expired reset token');
    });

    it('rejects expired token', async () => {
      const signupRes = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: testEmail, password: validPassword, name: 'User' });
      const userId = signupRes.body.data.user.id;

      const rawToken = 'expired-token-123';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() - 1000), // expired 1s ago
        },
      });

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          password: 'NewPassword999!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid or expired reset token');
    });
  });
});

