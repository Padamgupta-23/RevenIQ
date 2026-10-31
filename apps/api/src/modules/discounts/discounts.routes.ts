import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  listDiscountsQuerySchema,
  createDiscountSchema,
  updateDiscountSchema,
} from './discounts.schemas';
import {
  listDiscountsHandler,
  getDiscountHandler,
  createDiscountHandler,
  updateDiscountHandler,
  deleteDiscountHandler,
} from './discounts.controller';

export const discountsRouter = Router();

// Read operations: ADMIN and STAFF
discountsRouter.get(
  '/',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  validate({ query: listDiscountsQuerySchema }),
  listDiscountsHandler
);

discountsRouter.get(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  getDiscountHandler
);

// Write operations: ADMIN only
discountsRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createDiscountSchema }),
  createDiscountHandler
);

discountsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: updateDiscountSchema }),
  updateDiscountHandler
);

discountsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  deleteDiscountHandler
);

