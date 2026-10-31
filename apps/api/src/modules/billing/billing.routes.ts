import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { runBillingSchema, previewBillingSchema } from './billing.schemas.js';
import * as controller from './billing.controller.js';

export const billingRouter = Router();

billingRouter.use(requireAuth);

billingRouter.post(
  '/run',
  requireRole('ADMIN', 'STAFF'),
  validate({ body: runBillingSchema }),
  controller.runBilling
);

billingRouter.get(
  '/preview',
  requireRole('ADMIN', 'STAFF'),
  validate({ query: previewBillingSchema }),
  controller.previewBilling
);
