import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  listTaxesQuerySchema,
  createTaxSchema,
  updateTaxSchema,
} from './taxes.schemas';
import {
  listTaxesHandler,
  getTaxHandler,
  createTaxHandler,
  updateTaxHandler,
  deleteTaxHandler,
} from './taxes.controller';

export const taxesRouter = Router();

// Read operations: ADMIN and STAFF
taxesRouter.get(
  '/',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  validate({ query: listTaxesQuerySchema }),
  listTaxesHandler
);

taxesRouter.get(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  getTaxHandler
);

// Write operations: ADMIN only
taxesRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createTaxSchema }),
  createTaxHandler
);

taxesRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: updateTaxSchema }),
  updateTaxHandler
);

taxesRouter.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  deleteTaxHandler
);

