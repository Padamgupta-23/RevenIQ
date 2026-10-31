import { Prisma, SubscriptionStatus, InvoiceStatus, DiscountScope } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { toDecimal, round, add, multiply, percent } from '../../lib/money.js';
import { nextNumber } from '../../lib/numbering.js';
import { addPeriod } from '../../lib/billingPeriod.js';
import { evaluateDiscounts, DiscountDefinition } from '../../lib/discountEngine.js';

export interface BillingRunResult {
  created: number;
  skipped: number;
  failed: Array<{
    subscriptionId: string;
    subscriptionNumber?: string;
    error: string;
  }>;
}

export interface BillingPreviewItem {
  subscriptionId: string;
  subscriptionNumber: string;
  customerName: string;
  customerEmail: string;
  planName: string;
  periodStart: string;
  periodEnd: string;
  estimatedSubtotal: string;
  estimatedDiscounts: string;
  estimatedTax: string;
  estimatedTotal: string;
}

export interface BillingPreviewResult {
  runDate: string;
  count: number;
  preview: BillingPreviewItem[];
}

/**
 * Runs recurring billing run per AGENTS.md section 9.
 * 1. Select subscriptions where status = ACTIVE and nextBillingDate <= today (batch 200).
 * 2. In individual transactions: calculate period, build lines, apply discounts,
 *    create Invoice, advance nextBillingDate, catch-up loop.
 * 3. Idempotent via @@unique([subscriptionId, periodStart]), skip on conflict.
 * 4. Error isolation: failing subscriptions do not abort the batch.
 */
export async function runBilling(options?: { runDate?: Date }): Promise<BillingRunResult> {
  const today = options?.runDate ? new Date(options.runDate) : new Date();

  // Find due active subscriptions
  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      nextBillingDate: { lte: today },
    },
    include: {
      customer: true,
      plan: true,
      discount: {
        include: {
          products: true,
        },
      },
      lines: {
        include: {
          product: true,
          variant: true,
          tax: true,
        },
      },
    },
    take: 200,
  });

  let createdCount = 0;
  let skippedCount = 0;
  const failed: Array<{ subscriptionId: string; subscriptionNumber?: string; error: string }> = [];

  // Load active product-level discounts
  const activeProductDiscountsRaw = await prisma.discount.findMany({
    where: {
      scope: DiscountScope.PRODUCT,
      isActive: true,
      startDate: { lte: today },
      endDate: { gte: today },
    },
    include: { products: true },
  });

  const productDiscounts: DiscountDefinition[] = activeProductDiscountsRaw.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    value: d.value,
    scope: d.scope,
    minPurchase: d.minPurchase,
    minQuantity: d.minQuantity,
    startDate: d.startDate,
    endDate: d.endDate,
    usageLimit: d.usageLimit,
    usedCount: d.usedCount,
    isActive: d.isActive,
    productIds: d.products.map((p) => p.productId),
  }));

  for (const sub of dueSubscriptions) {
    try {
      // Catch-up loop: generate invoices for all missed periods until nextBillingDate > today
      let currentBillingDate = sub.nextBillingDate;

      while (
        currentBillingDate &&
        currentBillingDate <= today &&
        (!sub.expiryDate || currentBillingDate <= sub.expiryDate)
      ) {
        const periodStart = currentBillingDate;
        const periodEnd = addPeriod(periodStart, sub.plan.billingPeriod);

        try {
          // Process in individual transaction
          const cycleCreated = await prisma.$transaction(async (tx) => {
            // Check if invoice already exists for idempotency before creating
            const existingInvoice = await tx.invoice.findUnique({
              where: {
                subscriptionId_periodStart: {
                  subscriptionId: sub.id,
                  periodStart,
                },
              },
            });

            if (existingInvoice) {
              return false; // Skip
            }

            // Subscription-level discount definition
            let subscriptionDiscountDef: DiscountDefinition | null = null;
            if (sub.discount) {
              // Re-fetch discount inside transaction to verify limits
              const freshDisc = await tx.discount.findUnique({
                where: { id: sub.discount.id },
              });
              if (
                freshDisc &&
                freshDisc.isActive &&
                freshDisc.startDate <= today &&
                freshDisc.endDate >= today &&
                (freshDisc.usageLimit == null || freshDisc.usedCount < freshDisc.usageLimit)
              ) {
                subscriptionDiscountDef = {
                  id: freshDisc.id,
                  name: freshDisc.name,
                  type: freshDisc.type,
                  value: freshDisc.value,
                  scope: freshDisc.scope,
                  minPurchase: freshDisc.minPurchase,
                  minQuantity: freshDisc.minQuantity,
                  startDate: freshDisc.startDate,
                  endDate: freshDisc.endDate,
                  usageLimit: freshDisc.usageLimit,
                  usedCount: freshDisc.usedCount,
                  isActive: freshDisc.isActive,
                };
              }
            }

            // Evaluate discounts
            const discountEval = evaluateDiscounts({
              lines: sub.lines.map((l) => ({
                productId: l.productId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
              })),
              subscriptionDiscount: subscriptionDiscountDef,
              productDiscounts,
              now: today,
            });

            // Build invoice lines with taxes
            let taxTotal = new Prisma.Decimal(0);
            const invoiceLineData = sub.lines.map((line) => {
              const lineResult = discountEval.lineDiscounts.find(
                (ld) => ld.productId === line.productId
              );
              const effectiveSubtotal = lineResult
                ? lineResult.effectiveSubtotal
                : round(multiply(line.quantity, line.unitPrice));

              const taxRate = line.tax ? toDecimal(line.tax.rate) : new Prisma.Decimal(0);
              const lineTaxAmount = line.tax
                ? round(percent(effectiveSubtotal, taxRate))
                : new Prisma.Decimal(0);

              taxTotal = add(taxTotal, lineTaxAmount);

              const description = `${line.product?.name || 'Line Item'}${
                line.variant ? ` (${line.variant.attribute}: ${line.variant.value})` : ''
              }`;

              return {
                productId: line.productId,
                description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                taxRate,
                taxAmount: lineTaxAmount,
                amount: round(multiply(line.quantity, line.unitPrice)),
              };
            });

            // Total = subtotal - discountTotal + taxTotal
            const total = round(
              Prisma.Decimal.max(
                0,
                discountEval.subtotal.minus(discountEval.discountTotal).plus(taxTotal)
              )
            );

            // Generate invoice number
            const invoiceNumber = await nextNumber('invoice', tx);
            const dueDate = new Date(
              today.getTime() + (sub.paymentTermDays ?? 15) * 86400000
            );

            // Create Invoice
            const invoice = await tx.invoice.create({
              data: {
                number: invoiceNumber,
                subscriptionId: sub.id,
                customerId: sub.customerId,
                status: InvoiceStatus.DRAFT,
                periodStart,
                periodEnd,
                issueDate: today,
                dueDate,
                subtotal: discountEval.subtotal,
                discountTotal: discountEval.discountTotal,
                taxTotal,
                total,
                amountPaid: new Prisma.Decimal(0),
                lines: {
                  create: invoiceLineData,
                },
              },
            });

            // Record applied discounts & increment usedCount inside transaction
            for (const applied of discountEval.appliedDiscounts) {
              const discRecord = await tx.discount.findUnique({
                where: { id: applied.discountId },
              });
              if (
                discRecord &&
                (discRecord.usageLimit == null || discRecord.usedCount < discRecord.usageLimit)
              ) {
                await tx.invoiceDiscount.create({
                  data: {
                    invoiceId: invoice.id,
                    discountId: discRecord.id,
                    amount: applied.amount,
                  },
                });
                await tx.discount.update({
                  where: { id: discRecord.id },
                  data: { usedCount: { increment: 1 } },
                });
              }
            }

            // Determine advanced nextBillingDate
            const nextDate = periodEnd;
            const finalNextDate =
              sub.expiryDate && nextDate > sub.expiryDate ? null : nextDate;

            await tx.subscription.update({
              where: { id: sub.id },
              data: { nextBillingDate: finalNextDate },
            });

            return true;
          });

          if (cycleCreated) {
            createdCount++;
          } else {
            skippedCount++;
            // If skipped because already invoiced, advance nextBillingDate
            const nextDate = periodEnd;
            const finalNextDate =
              sub.expiryDate && nextDate > sub.expiryDate ? null : nextDate;
            await prisma.subscription.update({
              where: { id: sub.id },
              data: { nextBillingDate: finalNextDate },
            });
          }

          // Advance currentBillingDate for catch-up loop
          currentBillingDate = periodEnd > (sub.expiryDate || new Date(8640000000000000))
            ? null
            : periodEnd;
        } catch (cycleErr: any) {
          // Idempotency check for race conditions
          if (cycleErr instanceof Prisma.PrismaClientKnownRequestError && cycleErr.code === 'P2002') {
            skippedCount++;
            currentBillingDate = periodEnd;
            await prisma.subscription.update({
              where: { id: sub.id },
              data: {
                nextBillingDate:
                  sub.expiryDate && periodEnd > sub.expiryDate ? null : periodEnd,
              },
            });
          } else {
            throw cycleErr;
          }
        }
      }
    } catch (err: any) {
      failed.push({
        subscriptionId: sub.id,
        subscriptionNumber: sub.number,
        error: err.message || 'Unknown billing error',
      });
    }
  }

  return {
    created: createdCount,
    skipped: skippedCount,
    failed,
  };
}

/**
 * Preview subscriptions that will be invoiced on runDate.
 */
export async function previewBilling(runDate?: Date): Promise<BillingPreviewResult> {
  const targetDate = runDate ? new Date(runDate) : new Date();

  const dueSubs = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      nextBillingDate: { lte: targetDate },
    },
    include: {
      customer: true,
      plan: true,
      discount: true,
      lines: {
        include: {
          product: true,
          variant: true,
          tax: true,
        },
      },
    },
    take: 100,
  });

  const previewItems: BillingPreviewItem[] = [];

  for (const sub of dueSubs) {
    if (!sub.nextBillingDate) continue;

    const periodStart = sub.nextBillingDate;
    const periodEnd = addPeriod(periodStart, sub.plan.billingPeriod);

    let subtotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);

    for (const line of sub.lines) {
      const lineAmt = round(multiply(line.quantity, line.unitPrice));
      subtotal = add(subtotal, lineAmt);
      if (line.tax) {
        const taxRate = toDecimal(line.tax.rate);
        taxTotal = add(taxTotal, round(percent(lineAmt, taxRate)));
      }
    }

    let discountTotal = new Prisma.Decimal(0);
    if (sub.discount && sub.discount.isActive) {
      if (sub.discount.type === 'PERCENTAGE') {
        discountTotal = round(percent(subtotal, sub.discount.value));
      } else {
        discountTotal = round(Prisma.Decimal.min(subtotal, toDecimal(sub.discount.value)));
      }
    }

    const total = round(Prisma.Decimal.max(0, subtotal.minus(discountTotal).plus(taxTotal)));

    previewItems.push({
      subscriptionId: sub.id,
      subscriptionNumber: sub.number,
      customerName: sub.customer?.name || 'Unknown Customer',
      customerEmail: sub.customer?.email || '',
      planName: sub.plan.name,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      estimatedSubtotal: subtotal.toFixed(2),
      estimatedDiscounts: discountTotal.toFixed(2),
      estimatedTax: taxTotal.toFixed(2),
      estimatedTotal: total.toFixed(2),
    });
  }

  return {
    runDate: targetDate.toISOString(),
    count: previewItems.length,
    preview: previewItems,
  };
}

/**
 * Auto-closes subscriptions that have passed their expiryDate and have plan.autoClose = true.
 */
export async function autoCloseExpiredSubscriptions(today = new Date()): Promise<number> {
  const expired = await prisma.subscription.findMany({
    where: {
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED] },
      expiryDate: { lt: today },
      plan: { autoClose: true },
    },
  });

  for (const sub of expired) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.CLOSED,
        closedAt: today,
        nextBillingDate: null,
      },
    });
  }

  return expired.length;
}
