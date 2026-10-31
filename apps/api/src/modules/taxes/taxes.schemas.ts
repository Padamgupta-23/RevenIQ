import { z } from 'zod';

export const rateSchema = z
  .union([z.number(), z.string()])
  .transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return num;
  })
  .refine((val) => !isNaN(val) && val >= 0 && val <= 100, {
    message: 'Tax rate must be between 0 and 100 with at most 2 decimal places',
  });

export const createTaxSchema = z.object({
  name: z.string().min(2, 'Tax name must be at least 2 characters').trim(),
  rate: rateSchema,
  isActive: z.boolean().default(true),
});

export const updateTaxSchema = z.object({
  name: z.string().min(2, 'Tax name must be at least 2 characters').trim().optional(),
  rate: rateSchema.optional(),
  isActive: z.boolean().optional(),
});

export const listTaxesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
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

export type CreateTaxInput = z.infer<typeof createTaxSchema>;
export type UpdateTaxInput = z.infer<typeof updateTaxSchema>;
export type ListTaxesQuery = z.infer<typeof listTaxesQuerySchema>;

