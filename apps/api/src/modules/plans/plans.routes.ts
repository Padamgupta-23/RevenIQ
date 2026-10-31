import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  listPlansQuerySchema,
  createPlanSchema,
  updatePlanSchema,
} from './plans.schemas';
import {
  listPlansHandler,
  listAvailablePlansHandler,
  getPlanHandler,
  createPlanHandler,
  updatePlanHandler,
  deletePlanHandler,
} from './plans.controller';

export const plansRouter = Router();

// Read operations: ADMIN and STAFF
plansRouter.get(
  '/available',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  listAvailablePlansHandler
);

plansRouter.get(
  '/',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  validate({ query: listPlansQuerySchema }),
  listPlansHandler
);

plansRouter.get(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  getPlanHandler
);

// Write operations: ADMIN only
plansRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createPlanSchema }),
  createPlanHandler
);

plansRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: updatePlanSchema }),
  updatePlanHandler
);

plansRouter.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  deletePlanHandler
);

