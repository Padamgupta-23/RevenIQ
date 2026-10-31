import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { ok } from './lib/response.js';
import { errorHandler, NotFoundError } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { taxesRouter } from './modules/taxes/taxes.routes.js';
import { productsRouter } from './modules/products/products.routes.js';
import { plansRouter } from './modules/plans/plans.routes.js';
import { discountsRouter } from './modules/discounts/discounts.routes.js';
import { templatesRouter } from './modules/templates/templates.routes.js';
import { subscriptionsRouter } from './modules/subscriptions/subscriptions.routes.js';
import { billingRouter } from './modules/billing/billing.routes.js';
import { invoicesRouter } from './modules/invoices/invoices.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { portalRouter } from './modules/portal/portal.routes.js';

export function createApp(): Express {
  const app = express();

  // Security & HTTP headers
  app.use(helmet());

  // CORS configuration
  const configuredOrigins = [
    process.env.CLIENT_URL,
    process.env.CORS_ORIGIN,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
  ]
    .filter(Boolean)
    .flatMap((url) => (url ? (url as string).split(',').map((s) => s.trim()) : []));

  app.use(
    cors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (
          configuredOrigins.includes(origin) ||
          /^https:\/\/[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.vercel\.app$/.test(origin) ||
          (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
        ) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked origin: ${origin}`));
      },
      credentials: true,
    })
  );

  // Request logging
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Base router for API v1
  const v1Router = express.Router();

  // Health check endpoint
  v1Router.get('/health', (_req: Request, res: Response) => {
    ok(res, {
      status: 'ok',
      service: 'reveniq-api',
      timestamp: new Date().toISOString(),
    });
  });

  // Auth routes
  v1Router.use('/auth', authRouter);

  // Users & RBAC routes
  v1Router.use('/users', usersRouter);

  // Catalog routes (Person 2)
  v1Router.use('/taxes', taxesRouter);
  v1Router.use('/products', productsRouter);
  v1Router.use('/plans', plansRouter);
  v1Router.use('/discounts', discountsRouter);
  v1Router.use('/templates', templatesRouter);

  // Subscriptions & Recurring Billing (Person 3)
  v1Router.use('/subscriptions', subscriptionsRouter);
  v1Router.use('/billing', billingRouter);
  v1Router.use('/invoices', invoicesRouter);

  // Payments & Finance Reports (Person 4)
  v1Router.use('/payments', paymentsRouter);
  v1Router.use('/reports', reportsRouter);
  v1Router.use('/portal', portalRouter);

  app.use('/api/v1', v1Router);

  // 404 handler for unknown routes
  app.use((_req: Request, _res: Response, next) => {
    next(new NotFoundError('API route not found'));
  });

  // Global centralized error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
