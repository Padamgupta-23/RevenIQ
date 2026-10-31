import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  listTemplatesQuerySchema,
  createTemplateSchema,
  updateTemplateSchema,
} from './templates.schemas';
import {
  listTemplatesHandler,
  getTemplateHandler,
  createTemplateHandler,
  updateTemplateHandler,
  deleteTemplateHandler,
} from './templates.controller';

export const templatesRouter = Router();

// Read: ADMIN and STAFF
templatesRouter.get(
  '/',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  validate({ query: listTemplatesQuerySchema }),
  listTemplatesHandler
);

templatesRouter.get(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  getTemplateHandler
);

// Write: ADMIN only
templatesRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createTemplateSchema }),
  createTemplateHandler
);

templatesRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: updateTemplateSchema }),
  updateTemplateHandler
);

templatesRouter.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  deleteTemplateHandler
);

