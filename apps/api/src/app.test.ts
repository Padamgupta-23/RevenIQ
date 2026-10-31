import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './app.js';
import { z } from 'zod';
import { validate } from './middleware/validate.js';
import express from 'express';
import { errorHandler, ConflictError } from './middleware/errorHandler.js';

describe('API Health and Core Middleware', () => {
  it('GET /api/v1/health returns ok status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.service).toBe('reveniq-api');
    expect(res.body.data).toHaveProperty('timestamp');
  });

  it('returns 404 for unknown endpoints in standard format', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBe('API route not found');
  });

  it('validates request bodies with Zod and returns 400 with details', async () => {
    const testApp = express();
    testApp.use(express.json());

    const schema = z.object({
      name: z.string().min(3),
      age: z.number().int().positive(),
    });

    testApp.post('/test-val', validate(schema), (_req, res) => {
      res.json({ success: true });
    });
    testApp.use(errorHandler);

    const res = await request(testApp)
      .post('/test-val')
      .send({ name: 'ab', age: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeInstanceOf(Array);
    expect(res.body.error.details.length).toBe(2);
  });

  it('formats custom AppError to standard JSON response', async () => {
    const testApp = express();
    testApp.get('/test-conflict', () => {
      throw new ConflictError('Cannot transition from DRAFT to CLOSED');
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/test-conflict');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toBe('Cannot transition from DRAFT to CLOSED');
  });
});

