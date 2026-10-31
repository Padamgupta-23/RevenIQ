import { z } from 'zod';

export const runBillingSchema = z.object({
  runDate: z.coerce.date().optional(),
});

export const previewBillingSchema = z.object({
  runDate: z.coerce.date().optional(),
});

export type RunBillingInput = z.infer<typeof runBillingSchema>;
export type PreviewBillingInput = z.infer<typeof previewBillingSchema>;

