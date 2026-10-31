import { z } from 'zod';
import { ProductType } from '@prisma/client';

export const priceSchema = z
  .union([z.number(), z.string()])
  .transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return num;
  })
  .refine((val) => !isNaN(val) && val >= 0, {
    message: 'Price must be a valid non-negative number',
  });

export const createProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').trim(),
  type: z.nativeEnum(ProductType, {
    errorMap: () => ({ message: 'Product type must be SOFTWARE, SERVICE, ADDON, or GOODS' }),
  }),
  salesPrice: priceSchema,
  costPrice: priceSchema,
  notes: z.string().optional(),
  taxId: z.string().cuid().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').trim().optional(),
  type: z.nativeEnum(ProductType).optional(),
  salesPrice: priceSchema.optional(),
  costPrice: priceSchema.optional(),
  notes: z.string().nullable().optional(),
  taxId: z.string().cuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  type: z.nativeEnum(ProductType).optional(),
  isActive: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean())
    .optional(),
});

export const createVariantSchema = z.object({
  attribute: z.string().min(1, 'Attribute name is required').trim(),
  value: z.string().min(1, 'Attribute value is required').trim(),
  extraPrice: priceSchema.default(0),
});

export const updateVariantSchema = z.object({
  attribute: z.string().min(1, 'Attribute name is required').trim().optional(),
  value: z.string().min(1, 'Attribute value is required').trim().optional(),
  extraPrice: priceSchema.optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

