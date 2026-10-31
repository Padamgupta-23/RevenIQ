import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodTypeAny } from 'zod';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemaOrSchemas: ZodTypeAny | ValidationSchemas) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if ('parse' in schemaOrSchemas || 'parseAsync' in schemaOrSchemas) {
        // Direct schema provided: validate req.body
        req.body = await (schemaOrSchemas as ZodSchema).parseAsync(req.body);
      } else {
        const schemas = schemaOrSchemas as ValidationSchemas;
        if (schemas.body) {
          req.body = await schemas.body.parseAsync(req.body);
        }
        if (schemas.query) {
          req.query = await schemas.query.parseAsync(req.query);
        }
        if (schemas.params) {
          req.params = await schemas.params.parseAsync(req.params);
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
