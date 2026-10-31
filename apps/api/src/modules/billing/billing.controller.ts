import { Request, Response, NextFunction } from 'express';
import { ok } from '../../lib/response.js';
import * as billingService from './billing.service.js';

export async function runBilling(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const runDate = req.body.runDate ? new Date(req.body.runDate) : undefined;
    const result = await billingService.runBilling({ runDate });
    return ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function previewBilling(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const runDate = req.query.runDate ? new Date(req.query.runDate as string) : undefined;
    const result = await billingService.previewBilling(runDate);
    return ok(res, result);
  } catch (err) {
    next(err);
  }
}

