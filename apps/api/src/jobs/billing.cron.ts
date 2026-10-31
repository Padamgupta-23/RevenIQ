import cron, { ScheduledTask } from 'node-cron';
import { runBilling, autoCloseExpiredSubscriptions } from '../modules/billing/billing.service.js';

let billingTask: ScheduledTask | null = null;

/**
 * Initializes the recurring billing cron job.
 * Runs daily at 00:30 UTC/local server time.
 * Executes automated invoice generation and auto-closes expired subscriptions.
 */
export function initBillingCron(cronExpression = '30 0 * * *'): ScheduledTask {
  if (billingTask) {
    billingTask.stop();
  }

  billingTask = cron.schedule(cronExpression, async () => {
    console.log('[Billing Cron] Triggered recurring billing run...');
    try {
      // 1. Run billing for due subscriptions
      const result = await runBilling();
      console.log(
        `[Billing Cron] Billing run complete: ${result.created} invoices created, ${result.skipped} skipped, ${result.failed.length} failed`
      );

      // 2. Auto-close expired subscriptions if plan.autoClose = true
      const closedCount = await autoCloseExpiredSubscriptions();
      if (closedCount > 0) {
        console.log(`[Billing Cron] Auto-closed ${closedCount} expired subscriptions`);
      }
    } catch (err) {
      console.error('[Billing Cron] Unhandled error during scheduled run:', err);
    }
  });

  console.log(`[Billing Cron] Scheduled daily billing run with pattern "${cronExpression}"`);
  return billingTask;
}

/**
 * Stops the active billing cron job (useful for clean test teardowns).
 */
export function stopBillingCron(): void {
  if (billingTask) {
    billingTask.stop();
    billingTask = null;
  }
}

