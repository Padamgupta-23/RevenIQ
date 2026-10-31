import { Request, Response, NextFunction } from 'express';
import { ok, paginated } from '../../lib/response';
import * as discountsService from './discounts.service';
import {
  ListDiscountsQuery,
  CreateDiscountInput,
  UpdateDiscountInput,
} from './discounts.schemas';

export async function listDiscountsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const query = req.query as unknown as ListDiscountsQuery;
    const result = await discountsService.listDiscounts(query);
    return paginated(res, result.data, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function getDiscountHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const discount = await discountsService.getDiscountById(req.params.id);
    return ok(res, { discount });
  } catch (error) {
    next(error);
  }
}

export async function createDiscountHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = req.body as CreateDiscountInput;
    const discount = await discountsService.createDiscount(input);
    return ok(res, { discount }, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateDiscountHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = req.body as UpdateDiscountInput;
    const discount = await discountsService.updateDiscount(req.params.id, input);
    return ok(res, { discount });
  } catch (error) {
    next(error);
  }
}

export async function deleteDiscountHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await discountsService.deleteDiscount(req.params.id);
    return ok(res, {
      message: result.deleted
        ? 'Discount rule deleted successfully'
        : 'Discount is linked to active subscriptions and has been deactivated',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

