import { Response } from 'express';
import { PaginationMeta } from './pagination.js';

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ data });
}

export function paginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  status = 200
): Response {
  return res.status(status).json({ data, meta });
}

export function fail(
  res: Response,
  message: string,
  code = 'ERROR',
  status = 400,
  details?: unknown
): Response {
  return res.status(status).json({
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
}
