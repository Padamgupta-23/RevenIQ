import { Request, Response, NextFunction } from 'express';
import { ok, paginated } from '../../lib/response';
import * as plansService from './plans.service';
import { ListPlansQuery, CreatePlanInput, UpdatePlanInput } from './plans.schemas';

export async function listPlansHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const query = req.query as unknown as ListPlansQuery;
    const result = await plansService.listPlans(query);
    return paginated(res, result.data, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function listAvailablePlansHandler(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const plans = await plansService.listAvailablePlans();
    return ok(res, { plans });
  } catch (error) {
    next(error);
  }
}

export async function getPlanHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const plan = await plansService.getPlanById(req.params.id);
    return ok(res, { plan });
  } catch (error) {
    next(error);
  }
}

export async function createPlanHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = req.body as CreatePlanInput;
    const plan = await plansService.createPlan(input);
    return ok(res, { plan }, 201);
  } catch (error) {
    next(error);
  }
}

export async function updatePlanHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = req.body as UpdatePlanInput;
    const plan = await plansService.updatePlan(req.params.id, input);
    return ok(res, { plan });
  } catch (error) {
    next(error);
  }
}

export async function deletePlanHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await plansService.deletePlan(req.params.id);
    return ok(res, {
      message: result.softDeleted
        ? 'Plan is referenced by subscriptions and has been deactivated'
        : 'Plan deleted successfully',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

