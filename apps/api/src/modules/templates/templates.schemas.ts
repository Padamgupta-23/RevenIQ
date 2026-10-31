import { z } from 'zod';

export const templateLineSchema = z.object({
  productId: z.string().cuid('Product ID must be a valid ID'),
  variantId: z.string().cuid('Variant ID must be a valid ID').nullable().optional(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').default(1),
});

export const createTemplateSchema = z.object({
  name: z.string().min(2, 'Template name must be at least 2 characters').trim(),
  planId: z.string().cuid('Plan ID must be a valid ID'),
  validityDays: z.coerce.number().int().min(1, 'Validity must be at least 1 day').default(30),
  isActive: z.boolean().default(true),
  lines: z.array(templateLineSchema).min(1, 'Template must have at least one line item'),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(2, 'Template name must be at least 2 characters').trim().optional(),
  planId: z.string().cuid('Plan ID must be a valid ID').optional(),
  validityDays: z.coerce.number().int().min(1, 'Validity must be at least 1 day').optional(),
  isActive: z.boolean().optional(),
  lines: z.array(templateLineSchema).optional(),
});

export const listTemplatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  planId: z.string().cuid().optional(),
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

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;

