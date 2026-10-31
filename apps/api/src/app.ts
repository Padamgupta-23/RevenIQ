import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { ok } from './lib/response.js';
import { errorHandler, NotFoundError } from './middleware/errorHandler.js';

export function createApp(): Express {
  const app = express();

  // Security & HTTP headers
  app.use(helmet());

  // CORS configuration
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  app.use(
    cors({
      origin: clientUrl,
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

  app.use('/api/v1', v1Router);

  // 404 handler for unknown routes
  app.use((_req: Request, _res: Response, next) => {
    next(new NotFoundError('API route not found'));
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;

