import { z } from 'zod';
import { BillingPeriod } from '@prisma/client';
import { priceSchema } from '../products/products.schemas';

export const createPlanSchema = z
  .object({
    name: z.string().min(2, 'Plan name must be at least 2 characters').trim(),
    price: priceSchema,
    billingPeriod: z.nativeEnum(BillingPeriod, {
      errorMap: () => ({ message: 'Billing period must be DAILY, WEEKLY, MONTHLY, or YEARLY' }),
    }),
    minQuantity: z.coerce.number().int().min(1, 'Minimum quantity must be at least 1').default(1),
    startDate: z.string().or(z.date()).transform((val) => new Date(val)),
    endDate: z.string().or(z.date()).optional().nullable().transform((val) => (val ? new Date(val) : null)),
    autoClose: z.boolean().default(false),
    closable: z.boolean().default(true),
    pausable: z.boolean().default(false),
    renewable: z.boolean().default(true),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.endDate && data.startDate) {
        return data.endDate.getTime() > data.startDate.getTime();
      }
      return true;
    },
    {
      message: 'End date must be strictly after start date',
      path: ['endDate'],
    }
  );

export const updatePlanSchema = z
  .object({
    name: z.string().min(2, 'Plan name must be at least 2 characters').trim().optional(),
    price: priceSchema.optional(),
    billingPeriod: z.nativeEnum(BillingPeriod).optional(),
    minQuantity: z.coerce.number().int().min(1, 'Minimum quantity must be at least 1').optional(),
    startDate: z.string().or(z.date()).optional().transform((val) => (val ? new Date(val) : undefined)),
    endDate: z.string().or(z.date()).optional().nullable().transform((val) => (val ? new Date(val) : null)),
    autoClose: z.boolean().optional(),
    closable: z.boolean().optional(),
    pausable: z.boolean().optional(),
    renewable: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.endDate && data.startDate) {
        return data.endDate.getTime() > data.startDate.getTime();
      }
      return true;
    },
    {
      message: 'End date must be strictly after start date',
      path: ['endDate'],
    }
  );

export const listPlansQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  billingPeriod: z.nativeEnum(BillingPeriod).optional(),
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

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>;

