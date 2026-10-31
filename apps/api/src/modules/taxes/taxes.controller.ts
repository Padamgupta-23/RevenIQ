import { Request, Response, NextFunction } from 'express';
import { ok, paginated } from '../../lib/response';
import * as taxesService from './taxes.service';
import { ListTaxesQuery, CreateTaxInput, UpdateTaxInput } from './taxes.schemas';

export async function listTaxesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const query = req.query as unknown as ListTaxesQuery;
    const result = await taxesService.listTaxes(query);
    return paginated(res, result.data, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function getTaxHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tax = await taxesService.getTaxById(req.params.id);
    return ok(res, { tax });
  } catch (error) {
    next(error);
  }
}

export async function createTaxHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = req.body as CreateTaxInput;
    const tax = await taxesService.createTax(input);
    return ok(res, { tax }, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateTaxHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = req.body as UpdateTaxInput;
    const tax = await taxesService.updateTax(req.params.id, input);
    return ok(res, { tax });
  } catch (error) {
    next(error);
  }
}

export async function deleteTaxHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await taxesService.deleteTax(req.params.id);
    return ok(res, {
      message: result.softDeleted
        ? 'Tax rate is in use and has been deactivated'
        : 'Tax rate deleted successfully',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

