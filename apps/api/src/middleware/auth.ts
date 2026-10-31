import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { UnauthorizedError, ForbiddenError } from './errorHandler.js';
import '../types/express.d.ts';

export interface TokenPayload {
  userId?: string;
  id?: string;
  sub?: string;
  role?: Role;
  email?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-long-random-string';

/**
 * Generates a signed JWT token for a user.
 */
export function signToken(
  payload: { userId: string; role: Role; email: string },
  expiresIn = process.env.JWT_EXPIRES_IN || '7d'
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

/**
 * Middleware: Requires an authenticated user via JWT httpOnly cookie (or Bearer header).
 * Loads user from database, verifies isActive = true, and attaches req.user = { id, role, email }.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token =
      req.cookies?.token ||
      req.cookies?.jwt ||
      req.headers.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired authentication token');
    }

    const userId = payload.userId || payload.id || payload.sub;
    if (!userId) {
      throw new UnauthorizedError('Invalid token payload');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        email: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.isActive) {
      throw new ForbiddenError('User account is deactivated');
    }

    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: Enforces that req.user has one of the allowed roles.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }

    next();
  };
}

