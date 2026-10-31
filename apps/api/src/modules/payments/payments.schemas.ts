import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';

export const createPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice is required'),
  method: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Valid payment method is required' }),
  }),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Amount must be positive with up to 2 decimal places')
    .refine((val) => parseFloat(val) > 0, { message: 'Amount must be greater than 0' }),
  paymentDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  note: z.string().max(500).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  method: z.nativeEnum(PaymentMethod).optional(),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  invoiceId: z.string().optional(),
  customerId: z.string().optional(),
  search: z.string().optional(),
});

export type ListPaymentsQueryInput = z.infer<typeof listPaymentsQuerySchema>;
