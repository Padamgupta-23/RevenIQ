import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  createFromTemplateSchema,
  listSubscriptionsQuerySchema,
} from './subscriptions.schemas.js';
import * as controller from './subscriptions.controller.js';

export const subscriptionsRouter = Router();

// All subscription routes require authentication
subscriptionsRouter.use(requireAuth);

// 1. List subscriptions
subscriptionsRouter.get(
  '/',
  requireRole('ADMIN', 'STAFF', 'CUSTOMER'),
  validate({ query: listSubscriptionsQuerySchema }),
  controller.listSubscriptions
);

// 2. Create subscription
subscriptionsRouter.post(
  '/',
  requireRole('ADMIN', 'STAFF'),
  validate(createSubscriptionSchema),
  controller.createSubscription
);

// 3. Create from template
subscriptionsRouter.post(
  '/from-template/:templateId',
  requireRole('ADMIN', 'STAFF'),
  validate(createFromTemplateSchema),
  controller.createSubscriptionFromTemplate
);

// 4. Get by ID
subscriptionsRouter.get(
  '/:id',
  requireRole('ADMIN', 'STAFF', 'CUSTOMER'),
  controller.getSubscriptionById
);

// 5. Update subscription
subscriptionsRouter.patch(
  '/:id',
  requireRole('ADMIN', 'STAFF'),
  validate(updateSubscriptionSchema),
  controller.updateSubscription
);

// 6. State transitions
subscriptionsRouter.post(
  '/:id/quote',
  requireRole('ADMIN', 'STAFF'),
  controller.handleTransition('quote')
);

subscriptionsRouter.post(
  '/:id/confirm',
  requireRole('ADMIN', 'STAFF'),
  controller.handleTransition('confirm')
);

subscriptionsRouter.post(
  '/:id/activate',
  requireRole('ADMIN', 'STAFF'),
  controller.handleTransition('activate')
);

subscriptionsRouter.post(
  '/:id/pause',
  requireRole('ADMIN', 'STAFF', 'CUSTOMER'),
  controller.handleTransition('pause')
);

subscriptionsRouter.post(
  '/:id/resume',
  requireRole('ADMIN', 'STAFF', 'CUSTOMER'),
  controller.handleTransition('resume')
);

subscriptionsRouter.post(
  '/:id/close',
  requireRole('ADMIN', 'STAFF', 'CUSTOMER'),
  controller.handleTransition('close')
);

subscriptionsRouter.post(
  '/:id/renew',
  requireRole('ADMIN', 'STAFF', 'CUSTOMER'),
  controller.handleTransition('renew')
);
