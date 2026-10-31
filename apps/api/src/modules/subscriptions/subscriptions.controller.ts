import { Request, Response, NextFunction } from 'express';
import { ok, paginated } from '../../lib/response.js';
import * as subscriptionService from './subscriptions.service.js';
import { TransitionAction } from './subscriptions.service.js';

export async function createSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const sub = await subscriptionService.createSubscription(
      req.body,
      req.user!.id
    );
    return ok(res, sub, 201);
  } catch (err) {
    next(err);
  }
}

export async function createSubscriptionFromTemplate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const sub = await subscriptionService.createSubscriptionFromTemplate(
      req.params.templateId,
      req.body,
      req.user!.id
    );
    return ok(res, sub, 201);
  } catch (err) {
    next(err);
  }
}

export async function getSubscriptionById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const sub = await subscriptionService.getSubscriptionById(
      req.params.id,
      req.user!
    );
    return ok(res, sub);
  } catch (err) {
    next(err);
  }
}

export async function updateSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const sub = await subscriptionService.updateSubscription(
      req.params.id,
      req.body,
      req.user!
    );
    return ok(res, sub);
  } catch (err) {
    next(err);
  }
}

export async function listSubscriptions(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await subscriptionService.listSubscriptions(
      req.query as any,
      req.user!
    );
    return paginated(res, result.data, result.meta);
  } catch (err) {
    next(err);
  }
}

export function handleTransition(action: TransitionAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await subscriptionService.transitionSubscription(
        req.params.id,
        action,
        req.user!
      );
      return ok(res, sub);
    } catch (err) {
      next(err);
    }
  };
}

