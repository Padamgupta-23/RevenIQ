import { Request, Response } from 'express';
import { ok, paginated } from '../../lib/response.js';
import * as portalService from './portal.service.js';
import { TransitionAction } from '../subscriptions/subscriptions.service.js';

export async function getCustomerSubscriptionsHandler(req: Request, res: Response) {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined;

  const result = await portalService.getCustomerSubscriptions(req.user!.id, {
    page,
    pageSize,
  });
  paginated(res, result.data, result.meta);
}

export async function getCustomerSubscriptionDetailHandler(req: Request, res: Response) {
  const sub = await portalService.getCustomerSubscriptionDetail(req.user!.id, req.params.id);
  ok(res, sub);
}

export async function customerSubscriptionActionHandler(req: Request, res: Response) {
  const action = req.params.action as TransitionAction;
  const updated = await portalService.customerSubscriptionAction(
    req.user!.id,
    req.params.id,
    action
  );
  ok(res, updated);
}

export async function getCustomerInvoicesHandler(req: Request, res: Response) {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined;
  const status = req.query.status as string | undefined;

  const result = await portalService.getCustomerInvoices(req.user!.id, {
    page,
    pageSize,
    status,
  });
  paginated(res, result.data, result.meta);
}

export async function getCustomerInvoiceDetailHandler(req: Request, res: Response) {
  const inv = await portalService.getCustomerInvoiceDetail(req.user!.id, req.params.id);
  ok(res, inv);
}

