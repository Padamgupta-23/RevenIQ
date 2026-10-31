import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { fail } from '../lib/response.js';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(
    message: string,
    statusCode = 400,
    code = 'ERROR',
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', details?: unknown) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict / Invalid state transition', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    fail(res, 'Validation failed', 'VALIDATION_ERROR', 400, details);
    return;
  }

  // 2. Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta?.target as string[]).join(', ')
        : (err.meta?.target as string) || 'unique constraint';
      
      const message = target.includes('email')
        ? 'Email already registered'
        : `Duplicate entry for ${target}`;

      fail(res, message, 'CONFLICT', 409, err.meta);
      return;
    }

    if (err.code === 'P2025') {
      fail(res, 'Record not found', 'NOT_FOUND', 404);
      return;
    }

    if (err.code === 'P2003') {
      fail(res, 'Referenced record does not exist', 'CONFLICT', 409);
      return;
    }
  }

  // 3. Application errors
  if (err instanceof AppError) {
    fail(res, err.message, err.code, err.statusCode, err.details);
    return;
  }

  // 4. Default unexpected errors (500)
  const isProd = process.env.NODE_ENV === 'production';
  const errorMessage = err instanceof Error ? err.message : 'Internal server error';

  if (!isProd) {
    console.error('Unhandled server error:', err);
  }

  fail(
    res,
    isProd ? 'Internal server error' : errorMessage,
    'INTERNAL_SERVER_ERROR',
    500
  );
}
