import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { listInvoicesQuerySchema } from './invoices.schemas.js';
import * as controller from './invoices.controller.js';

export const invoicesRouter = Router();

// Invoices admin/staff endpoints (customers use portal routes)
invoicesRouter.use(requireAuth);
invoicesRouter.use(requireRole('ADMIN', 'STAFF'));

// 1. List invoices
invoicesRouter.get(
  '/',
  validate({ query: listInvoicesQuerySchema }),
  controller.listInvoices
);

// 2. Printable HTML invoice
invoicesRouter.get('/:id/print', controller.printInvoice);

// 3. Invoice details
invoicesRouter.get('/:id', controller.getInvoiceById);

// 4. Confirm invoice (DRAFT -> CONFIRMED)
invoicesRouter.post('/:id/confirm', controller.confirmInvoice);

// 5. Cancel invoice (DRAFT/CONFIRMED -> CANCELLED)
invoicesRouter.post('/:id/cancel', controller.cancelInvoice);

// 6. Send invoice via email (records sentAt)
invoicesRouter.post('/:id/send', controller.sendInvoice);

