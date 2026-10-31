import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  listProductsQuerySchema,
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
} from './products.schemas';
import {
  listProductsHandler,
  getProductHandler,
  createProductHandler,
  updateProductHandler,
  deleteProductHandler,
  listVariantsHandler,
  createVariantHandler,
  updateVariantHandler,
  deleteVariantHandler,
} from './products.controller';

export const productsRouter = Router();

// ───────────── PRODUCTS ─────────────

// Read: ADMIN and STAFF
productsRouter.get(
  '/',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  validate({ query: listProductsQuerySchema }),
  listProductsHandler
);

productsRouter.get(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  getProductHandler
);

// Write: ADMIN only
productsRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createProductSchema }),
  createProductHandler
);

productsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: updateProductSchema }),
  updateProductHandler
);

productsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  deleteProductHandler
);

// ───────────── VARIANTS (Nested under /products/:id/variants) ─────────────

// Read: ADMIN and STAFF
productsRouter.get(
  '/:id/variants',
  requireAuth,
  requireRole('ADMIN', 'STAFF'),
  listVariantsHandler
);

// Write: ADMIN only
productsRouter.post(
  '/:id/variants',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createVariantSchema }),
  createVariantHandler
);

productsRouter.patch(
  '/:id/variants/:variantId',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: updateVariantSchema }),
  updateVariantHandler
);

productsRouter.delete(
  '/:id/variants/:variantId',
  requireAuth,
  requireRole('ADMIN'),
  deleteVariantHandler
);

