import { z } from 'zod';
import { DiscountType, DiscountScope } from '@prisma/client';
import { priceSchema } from '../products/products.schemas';

export const createDiscountSchema = z
  .object({
    name: z.string().min(2, 'Discount name must be at least 2 characters').trim(),
    type: z.nativeEnum(DiscountType, {
      errorMap: () => ({ message: 'Discount type must be FIXED or PERCENTAGE' }),
    }),
    value: priceSchema,
    scope: z.nativeEnum(DiscountScope, {
      errorMap: () => ({ message: 'Discount scope must be PRODUCT or SUBSCRIPTION' }),
    }),
    minPurchase: priceSchema.optional().nullable(),
    minQuantity: z.coerce.number().int().min(1).optional().nullable(),
    startDate: z.string().or(z.date()).transform((val) => new Date(val)),
    endDate: z.string().or(z.date()).transform((val) => new Date(val)),
    usageLimit: z.coerce.number().int().min(1).optional().nullable(),
    isActive: z.boolean().default(true),
    productIds: z.array(z.string().cuid()).optional(),
  })
  .refine(
    (data) => {
      if (data.type === DiscountType.PERCENTAGE) {
        return data.value <= 100;
      }
      return true;
    },
    {
      message: 'Percentage discount cannot exceed 100%',
      path: ['value'],
    }
  )
  .refine(
    (data) => {
      return data.endDate.getTime() > data.startDate.getTime();
    },
    {
      message: 'End date must be strictly after start date',
      path: ['endDate'],
    }
  );

export const updateDiscountSchema = z
  .object({
    name: z.string().min(2, 'Discount name must be at least 2 characters').trim().optional(),
    type: z.nativeEnum(DiscountType).optional(),
    value: priceSchema.optional(),
    scope: z.nativeEnum(DiscountScope).optional(),
    minPurchase: priceSchema.optional().nullable(),
    minQuantity: z.coerce.number().int().min(1).optional().nullable(),
    startDate: z.string().or(z.date()).optional().transform((val) => (val ? new Date(val) : undefined)),
    endDate: z.string().or(z.date()).optional().transform((val) => (val ? new Date(val) : undefined)),
    usageLimit: z.coerce.number().int().min(1).optional().nullable(),
    isActive: z.boolean().optional(),
    productIds: z.array(z.string().cuid()).optional(),
  })
  .refine(
    (data) => {
      if (data.type === DiscountType.PERCENTAGE && data.value !== undefined) {
        return data.value <= 100;
      }
      return true;
    },
    {
      message: 'Percentage discount cannot exceed 100%',
      path: ['value'],
    }
  )
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate.getTime() > data.startDate.getTime();
      }
      return true;
    },
    {
      message: 'End date must be strictly after start date',
      path: ['endDate'],
    }
  );

export const listDiscountsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  type: z.nativeEnum(DiscountType).optional(),
  scope: z.nativeEnum(DiscountScope).optional(),
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

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>;
export type ListDiscountsQuery = z.infer<typeof listDiscountsQuerySchema>;

