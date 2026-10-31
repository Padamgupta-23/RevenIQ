import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createPaymentSchema } from './payments.schemas.js';
import * as paymentsController from './payments.controller.js';

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

// Record payment (ADMIN and STAFF)
paymentsRouter.post(
  '/',
  requireRole('ADMIN', 'STAFF'),
  validate(createPaymentSchema),
  paymentsController.createPaymentHandler
);

// List payments (ADMIN and STAFF)
paymentsRouter.get('/', requireRole('ADMIN', 'STAFF'), paymentsController.listPaymentsHandler);

// Payments for a specific invoice
paymentsRouter.get(
  '/invoice/:id',
  requireRole('ADMIN', 'STAFF'),
  paymentsController.getInvoicePaymentsHandler
);
