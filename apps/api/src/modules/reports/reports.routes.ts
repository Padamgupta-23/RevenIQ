import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as reportsController from './reports.controller.js';

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

// Summary is available to authenticated users (role-scoped: CUSTOMER gets own; ADMIN/STAFF gets global)
reportsRouter.get('/summary', reportsController.getDashboardSummaryHandler);

// Admin and Staff reports
reportsRouter.get('/overdue', requireRole('ADMIN', 'STAFF'), reportsController.getOverdueReportHandler);
reportsRouter.get('/revenue', requireRole('ADMIN', 'STAFF'), reportsController.getRevenueReportHandler);
reportsRouter.get(
  '/subscriptions',
  requireRole('ADMIN', 'STAFF'),
  reportsController.getSubscriptionsReportHandler
);
