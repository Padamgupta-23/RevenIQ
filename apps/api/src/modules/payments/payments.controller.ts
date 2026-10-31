import { Request, Response } from 'express';
import { ok, paginated } from '../../lib/response.js';
import * as paymentsService from './payments.service.js';
import { PaymentMethod } from '@prisma/client';

export async function createPaymentHandler(req: Request, res: Response) {
  const payment = await paymentsService.createPayment(req.body, req.user!);
  ok(res, payment, 201);
}

export async function listPaymentsHandler(req: Request, res: Response) {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
  const method = req.query.method as PaymentMethod | undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const invoiceId = req.query.invoiceId as string | undefined;
  const customerId = req.query.customerId as string | undefined;
  const search = req.query.search as string | undefined;

  const result = await paymentsService.listPayments({
    page,
    pageSize,
    method,
    startDate,
    endDate,
    invoiceId,
    customerId,
    search,
  });

  paginated(res, result.data, result.meta);
}

export async function getInvoicePaymentsHandler(req: Request, res: Response) {
  const payments = await paymentsService.getInvoicePayments(req.params.id);
  ok(res, payments);
}
