import { z } from 'zod';
import { SubscriptionStatus } from '@prisma/client';

export const subscriptionLineSchema = z.object({
  productId: z.string().cuid('Product ID must be a valid cuid'),
  variantId: z.string().cuid('Variant ID must be a valid cuid').nullable().optional(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').default(1),
  taxId: z.string().cuid('Tax ID must be a valid cuid').nullable().optional(),
});

export const createSubscriptionSchema = z
  .object({
    customerId: z.string().cuid('Customer ID must be a valid cuid'),
    planId: z.string().cuid('Plan ID must be a valid cuid'),
    startDate: z.coerce.date(),
    expiryDate: z.coerce.date(),
    paymentTermDays: z.coerce.number().int().min(0, 'Payment term days must be >= 0').default(15),
    quotationValidUntil: z.coerce.date().nullable().optional(),
    notes: z.string().trim().nullable().optional(),
    discountId: z.string().cuid('Discount ID must be a valid cuid').nullable().optional(),
    lines: z.array(subscriptionLineSchema).min(1, 'At least one line item is required'),
  })
  .refine((data) => data.expiryDate > data.startDate, {
    message: 'Expiry date must be after start date',
    path: ['expiryDate'],
  });

export const updateSubscriptionSchema = z
  .object({
    startDate: z.coerce.date().optional(),
    expiryDate: z.coerce.date().optional(),
    paymentTermDays: z.coerce.number().int().min(0).optional(),
    quotationValidUntil: z.coerce.date().nullable().optional(),
    notes: z.string().trim().nullable().optional(),
    discountId: z.string().cuid().nullable().optional(),
    lines: z.array(subscriptionLineSchema).min(1).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.expiryDate) {
        return data.expiryDate > data.startDate;
      }
      return true;
    },
    {
      message: 'Expiry date must be after start date',
      path: ['expiryDate'],
    }
  );

export const createFromTemplateSchema = z
  .object({
    customerId: z.string().cuid('Customer ID must be a valid cuid'),
    startDate: z.coerce.date(),
    expiryDate: z.coerce.date(),
    paymentTermDays: z.coerce.number().int().min(0).default(15),
    notes: z.string().trim().nullable().optional(),
    discountId: z.string().cuid().nullable().optional(),
  })
  .refine((data) => data.expiryDate > data.startDate, {
    message: 'Expiry date must be after start date',
    path: ['expiryDate'],
  });

export const listSubscriptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.nativeEnum(SubscriptionStatus).optional(),
  customerId: z.string().cuid().optional(),
  planId: z.string().cuid().optional(),
});

export type SubscriptionLineInput = z.infer<typeof subscriptionLineSchema>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type CreateFromTemplateInput = z.infer<typeof createFromTemplateSchema>;
export type ListSubscriptionsQuery = z.infer<typeof listSubscriptionsQuerySchema>;

