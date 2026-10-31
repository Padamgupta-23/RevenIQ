import { BillingPeriod } from '@prisma/client';

/**
 * Adds a billing period to a date with strict month-end and leap-year clamping.
 * e.g. Jan 31 + 1 month => Feb 28 (or Feb 29 in leap year).
 * All calculations are done in UTC to prevent timezone shift artifacts.
 */
export function addPeriod(
  date: Date,
  period: BillingPeriod,
  count = 1
): Date {
  const result = new Date(date.getTime());

  switch (period) {
    case BillingPeriod.DAILY:
      result.setUTCDate(result.getUTCDate() + count);
      return result;

    case BillingPeriod.WEEKLY:
      result.setUTCDate(result.getUTCDate() + 7 * count);
      return result;

    case BillingPeriod.MONTHLY: {
      const originalDay = result.getUTCDate();
      // Temporarily set to day 1 to safely advance months without month-overflow
      result.setUTCDate(1);
      result.setUTCMonth(result.getUTCMonth() + count);

      // Determine days in target month
      const targetYear = result.getUTCFullYear();
      const targetMonth = result.getUTCMonth();
      const daysInTargetMonth = new Date(
        Date.UTC(targetYear, targetMonth + 1, 0)
      ).getUTCDate();

      // Clamp to last day of target month if original day exceeds it
      result.setUTCDate(Math.min(originalDay, daysInTargetMonth));
      return result;
    }

    case BillingPeriod.YEARLY: {
      const originalDay = result.getUTCDate();
      const originalMonth = result.getUTCMonth();

      // Temporarily set to day 1 to prevent Feb 29 overflowing to March 1 in non-leap years
      result.setUTCDate(1);
      result.setUTCFullYear(result.getUTCFullYear() + count);
      result.setUTCMonth(originalMonth);

      // Handle leap-year Feb 29 clamped to Feb 28
      const daysInTargetMonth = new Date(
        Date.UTC(result.getUTCFullYear(), originalMonth + 1, 0)
      ).getUTCDate();
      result.setUTCDate(Math.min(originalDay, daysInTargetMonth));
      return result;
    }

    default:
      throw new Error(`Unsupported billing period: ${period}`);
  }
}
