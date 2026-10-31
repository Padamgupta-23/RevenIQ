import { z } from 'zod';
import { SubscriptionStatus } from '@prisma/client';

export const reportsFilterSchema = z.object({
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  status: z.nativeEnum(SubscriptionStatus).optional(),
  customerId: z.string().optional(),
});

export type ReportsFilterInput = z.infer<typeof reportsFilterSchema>;
