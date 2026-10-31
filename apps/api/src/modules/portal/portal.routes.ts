import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as portalController from './portal.controller.js';

export const portalRouter = Router();

// Customer Portal routes require CUSTOMER authentication
portalRouter.use(requireAuth);
portalRouter.use(requireRole('CUSTOMER'));

// Subscriptions
portalRouter.get('/subscriptions', portalController.getCustomerSubscriptionsHandler);
portalRouter.get('/subscriptions/:id', portalController.getCustomerSubscriptionDetailHandler);
portalRouter.post('/subscriptions/:id/:action', portalController.customerSubscriptionActionHandler);

// Invoices
portalRouter.get('/invoices', portalController.getCustomerInvoicesHandler);
portalRouter.get('/invoices/:id', portalController.getCustomerInvoiceDetailHandler);

