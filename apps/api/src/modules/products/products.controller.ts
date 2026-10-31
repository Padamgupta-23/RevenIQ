import { Request, Response, NextFunction } from 'express';
import { ok, paginated } from '../../lib/response';
import * as productsService from './products.service';
import {
  ListProductsQuery,
  CreateProductInput,
  UpdateProductInput,
  CreateVariantInput,
  UpdateVariantInput,
} from './products.schemas';

export async function listProductsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const query = req.query as unknown as ListProductsQuery;
    const result = await productsService.listProducts(query);
    return paginated(res, result.data, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function getProductHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const product = await productsService.getProductById(req.params.id);
    return ok(res, { product });
  } catch (error) {
    next(error);
  }
}

export async function createProductHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = req.body as CreateProductInput;
    const product = await productsService.createProduct(input);
    return ok(res, { product }, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateProductHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = req.body as UpdateProductInput;
    const product = await productsService.updateProduct(req.params.id, input);
    return ok(res, { product });
  } catch (error) {
    next(error);
  }
}

export async function deleteProductHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await productsService.deleteProduct(req.params.id);
    return ok(res, {
      message: result.softDeleted
        ? 'Product is referenced in subscriptions/invoices and has been deactivated'
        : 'Product deleted successfully',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

// ───────────── VARIANTS HANDLERS ─────────────

export async function listVariantsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const variants = await productsService.listVariants(req.params.id);
    return ok(res, { variants });
  } catch (error) {
    next(error);
  }
}

export async function createVariantHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = req.body as CreateVariantInput;
    const variant = await productsService.createVariant(req.params.id, input);
    return ok(res, { variant }, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateVariantHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = req.body as UpdateVariantInput;
    const variant = await productsService.updateVariant(
      req.params.id,
      req.params.variantId,
      input
    );
    return ok(res, { variant });
  } catch (error) {
    next(error);
  }
}

export async function deleteVariantHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await productsService.deleteVariant(
      req.params.id,
      req.params.variantId
    );
    return ok(res, { message: 'Variant deleted successfully', ...result });
  } catch (error) {
    next(error);
  }
}

