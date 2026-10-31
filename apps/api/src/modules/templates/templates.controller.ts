import { Request, Response, NextFunction } from 'express';
import { ok, paginated } from '../../lib/response';
import * as templatesService from './templates.service';
import {
  ListTemplatesQuery,
  CreateTemplateInput,
  UpdateTemplateInput,
} from './templates.schemas';

export async function listTemplatesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const query = req.query as unknown as ListTemplatesQuery;
    const result = await templatesService.listTemplates(query);
    return paginated(res, result.data, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function getTemplateHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const template = await templatesService.getTemplateById(req.params.id);
    return ok(res, { template });
  } catch (error) {
    next(error);
  }
}

export async function createTemplateHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = req.body as CreateTemplateInput;
    const template = await templatesService.createTemplate(input);
    return ok(res, { template }, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateTemplateHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = req.body as UpdateTemplateInput;
    const template = await templatesService.updateTemplate(req.params.id, input);
    return ok(res, { template });
  } catch (error) {
    next(error);
  }
}

export async function deleteTemplateHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await templatesService.deleteTemplate(req.params.id);
    return ok(res, {
      message: result.deleted
        ? 'Template deleted successfully'
        : 'Template is referenced by subscriptions and has been deactivated',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

