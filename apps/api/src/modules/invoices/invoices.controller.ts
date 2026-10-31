import { Request, Response, NextFunction } from 'express';
import { ok, paginated } from '../../lib/response.js';
import * as invoiceService from './invoices.service.js';

export async function listInvoices(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await invoiceService.listInvoices(req.query as any);
    return paginated(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
}

export async function getInvoiceById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id);
    return ok(res, invoice);
  } catch (err) {
    next(err);
  }
}

export async function confirmInvoice(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const invoice = await invoiceService.confirmInvoice(req.params.id);
    return ok(res, invoice);
  } catch (err) {
    next(err);
  }
}

export async function cancelInvoice(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const invoice = await invoiceService.cancelInvoice(req.params.id);
    return ok(res, invoice);
  } catch (err) {
    next(err);
  }
}

export async function sendInvoice(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const invoice = await invoiceService.sendInvoice(req.params.id);
    return ok(res, invoice);
  } catch (err) {
    next(err);
  }
}

export async function printInvoice(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const html = await invoiceService.generatePrintableHtml(req.params.id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    next(err);
  }
}

