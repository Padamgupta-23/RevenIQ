import { Request, Response, NextFunction, CookieOptions } from 'express';
import { ok } from '../../lib/response.js';
import * as authService from './auth.service.js';

const COOKIE_NAME = 'token';

function getCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true' || isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
}

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, token } = await authService.signup(req.body);
    res.cookie(COOKIE_NAME, token, getCookieOptions());
    ok(res, { user, token }, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, token } = await authService.login(req.body);
    res.cookie(COOKIE_NAME, token, getCookieOptions());
    ok(res, { user, token });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { maxAge, ...clearOptions } = getCookieOptions();
    res.clearCookie(COOKIE_NAME, clearOptions);
    ok(res, { message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.forgotPassword(req.body);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.resetPassword(req.body);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getMe(req.user!.id);
    ok(res, user);
  } catch (err) {
    next(err);
  }
}
