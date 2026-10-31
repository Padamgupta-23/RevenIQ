import { prisma } from '../../lib/prisma.js';
import { Prisma, SubscriptionStatus, InvoiceStatus } from '@prisma/client';
import { round, toDecimal } from '../../lib/money.js';
import { ReportsFilterInput } from './reports.schemas.js';

export interface DashboardSummary {
  activeSubscriptionsCount: number;
  revenueCollected: string;
  totalRevenue: string; // compatibility alias
  outstandingTotal: string;
  invoicesCount: number;
  overdueCount: number;
  overdueTotal: string;
  overdueBalance: string; // compatibility alias
  mrr: string;
  customersCount?: number;
  recentInvoices: {
    id: string;
    number: string;
    customerName: string;
    total: string;
    status: string;
    dueDate: string;
    isOverdue: boolean;
  }[];
}

/**
 * Computes dashboard summary using SQL aggregates only.
 */
export async function getDashboardSummary(
  filters: ReportsFilterInput,
  currentUser: { id: string; role: string }
): Promise<DashboardSummary> {
  const isCustomer = currentUser.role === 'CUSTOMER';
  const customerId = isCustomer ? currentUser.id : filters.customerId;
  const now = new Date();

  // 1. Active Subscriptions Count
  const subWhere: Prisma.SubscriptionWhereInput = {
    status: filters.status || SubscriptionStatus.ACTIVE,
    ...(customerId ? { customerId } : {}),
  };
  const activeSubsCount = await prisma.subscription.count({ where: subWhere });

  // 2. Total Invoices Count
  const invWhere: Prisma.InvoiceWhereInput = {
    ...(customerId ? { customerId } : {}),
  };
  if (filters.startDate || filters.endDate) {
    invWhere.issueDate = {};
    if (filters.startDate) invWhere.issueDate.gte = new Date(filters.startDate);
    if (filters.endDate) invWhere.issueDate.lte = new Date(filters.endDate);
  }
  const totalInvoicesCount = await prisma.invoice.count({ where: invWhere });

  // 3. Revenue Collected: SQL aggregate of payments in range (or amountPaid on confirmed invoices)
  let revenueCollectedDec = new Prisma.Decimal(0);
  if (customerId) {
    const paidSum = await prisma.invoice.aggregate({
      where: {
        customerId,
        status: { in: [InvoiceStatus.CONFIRMED, InvoiceStatus.PAID] },
      },
      _sum: { amountPaid: true },
    });
    revenueCollectedDec = new Prisma.Decimal(paidSum._sum.amountPaid || 0);
  } else {
    // Admin/Staff: SQL aggregate sum on Payment table
    const result = await prisma.$queryRaw<{ total: Prisma.Decimal }[]>`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM "Payment"
    `;
    revenueCollectedDec = new Prisma.Decimal(result[0]?.total || 0);
    if (revenueCollectedDec.isZero()) {
      // Fallback to invoice amountPaid if payments table was empty
      const invoicePaidSum = await prisma.invoice.aggregate({
        where: { status: { in: [InvoiceStatus.CONFIRMED, InvoiceStatus.PAID] } },
        _sum: { amountPaid: true },
      });
      revenueCollectedDec = new Prisma.Decimal(invoicePaidSum._sum.amountPaid || 0);
    }
  }
  const revenueCollected = round(revenueCollectedDec).toFixed(2);

  // 4. Outstanding Total: sum of (total - amountPaid) on CONFIRMED invoices
  const outstandingResult = await prisma.$queryRaw<{ outstanding: Prisma.Decimal }[]>`
    SELECT COALESCE(SUM(total - "amountPaid"), 0) as outstanding
    FROM "Invoice"
    WHERE status = 'CONFIRMED'
    ${customerId ? Prisma.sql`AND "customerId" = ${customerId}` : Prisma.empty}
  `;
  const outstandingTotal = round(new Prisma.Decimal(outstandingResult[0]?.outstanding || 0)).toFixed(2);

  // 5. Overdue count and total: CONFIRMED invoices past dueDate with remaining balance
  const overdueResult = await prisma.$queryRaw<{ count: bigint; total: Prisma.Decimal }[]>`
    SELECT
      COUNT(*)::bigint as count,
      COALESCE(SUM(total - "amountPaid"), 0) as total
    FROM "Invoice"
    WHERE status = 'CONFIRMED'
      AND "dueDate" < ${now}
      AND "amountPaid" < total
      ${customerId ? Prisma.sql`AND "customerId" = ${customerId}` : Prisma.empty}
  `;
  const overdueCount = Number(overdueResult[0]?.count || 0);
  const overdueTotal = round(new Prisma.Decimal(overdueResult[0]?.total || 0)).toFixed(2);

  // 6. MRR normalized to monthly per P4-3 formula (yearly/12, weekly*52/12, daily*365/12)
  let mrr = '0.00';
  if (!isCustomer) {
    const mrrResult = await prisma.$queryRaw<{ mrr: Prisma.Decimal }[]>`
      SELECT
        COALESCE(SUM(
          CASE p."billingPeriod"
            WHEN 'DAILY' THEN p.price * 365 / 12
            WHEN 'WEEKLY' THEN p.price * 52 / 12
            WHEN 'MONTHLY' THEN p.price
            WHEN 'YEARLY' THEN p.price / 12
            ELSE p.price
          END
        ), 0) as mrr
      FROM "Subscription" s
      JOIN "Plan" p ON s."planId" = p.id
      WHERE s.status = 'ACTIVE'
    `;
    mrr = round(new Prisma.Decimal(mrrResult[0]?.mrr || 0)).toFixed(2);
  }

  // 7. Customers count
  let customersCount: number | undefined;
  if (!isCustomer) {
    customersCount = await prisma.user.count({
      where: { role: 'CUSTOMER', isActive: true },
    });
  }

  // 8. Recent Invoices
  const recentInvs = await prisma.invoice.findMany({
    where: invWhere,
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      customer: {
        select: { name: true },
      },
    },
  });

  const recentInvoices = recentInvs.map((inv) => {
    const isOverdue =
      inv.status === InvoiceStatus.CONFIRMED &&
      inv.dueDate < now &&
      inv.amountPaid.lessThan(inv.total);

    return {
      id: inv.id,
      number: inv.number,
      customerName: inv.customer?.name || 'Customer',
      total: toDecimal(inv.total).toFixed(2),
      status: inv.status,
      dueDate: inv.dueDate.toISOString(),
      isOverdue,
    };
  });

  return {
    activeSubscriptionsCount: activeSubsCount,
    revenueCollected,
    totalRevenue: revenueCollected,
    outstandingTotal,
    invoicesCount: totalInvoicesCount,
    overdueCount,
    overdueTotal,
    overdueBalance: overdueTotal,
    mrr,
    customersCount,
    recentInvoices,
  };
}

/**
 * Returns overdue invoices breakdown with SQL aggregates
 */
export async function getOverdueReport(
  filters: ReportsFilterInput,
  currentUser: { id: string; role: string }
) {
  const isCustomer = currentUser.role === 'CUSTOMER';
  const customerId = isCustomer ? currentUser.id : filters.customerId;
  const now = new Date();

  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      ...(customerId ? { customerId } : {}),
      status: InvoiceStatus.CONFIRMED,
      dueDate: { lt: now },
    },
    include: {
      customer: {
        select: { id: true, name: true, email: true, company: true },
      },
      subscription: {
        select: { id: true, number: true },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  return overdueInvoices
    .filter((inv) => inv.amountPaid.lessThan(inv.total))
    .map((inv) => {
      const balance = inv.total.minus(inv.amountPaid);
      return {
        id: inv.id,
        number: inv.number,
        customerId: inv.customerId,
        customerName: inv.customer?.name || '',
        customerEmail: inv.customer?.email || '',
        dueDate: inv.dueDate.toISOString(),
        total: toDecimal(inv.total).toFixed(2),
        amountPaid: toDecimal(inv.amountPaid).toFixed(2),
        balance: round(balance).toFixed(2),
      };
    });
}

/**
 * Grouped revenue by month via SQL aggregates
 */
export async function getRevenueByMonthReport(
  _filters: ReportsFilterInput,
  _currentUser: { id: string; role: string }
) {
  // Group payments by YYYY-MM
  const paymentRows = await prisma.$queryRaw<
    { month: string; revenue: Prisma.Decimal; count: bigint }[]
  >`
    SELECT
      TO_CHAR("paymentDate", 'YYYY-MM') as month,
      COALESCE(SUM(amount), 0) as revenue,
      COUNT(*)::bigint as count
    FROM "Payment"
    GROUP BY TO_CHAR("paymentDate", 'YYYY-MM')
    ORDER BY month ASC
  `;

  if (paymentRows.length > 0) {
    return paymentRows.map((r) => ({
      month: r.month,
      revenue: round(new Prisma.Decimal(r.revenue)).toFixed(2),
      count: Number(r.count),
    }));
  }

  // Fallback to Invoice generation volume if no payments table entries
  const invoiceRows = await prisma.$queryRaw<
    { month: string; revenue: Prisma.Decimal; count: bigint }[]
  >`
    SELECT
      TO_CHAR("issueDate", 'YYYY-MM') as month,
      COALESCE(SUM(total), 0) as revenue,
      COUNT(*)::bigint as count
    FROM "Invoice"
    WHERE status IN ('CONFIRMED', 'PAID')
    GROUP BY TO_CHAR("issueDate", 'YYYY-MM')
    ORDER BY month ASC
  `;

  return invoiceRows.map((r) => ({
    month: r.month,
    revenue: round(new Prisma.Decimal(r.revenue)).toFixed(2),
    count: Number(r.count),
  }));
}

/**
 * Subscriptions breakdown by status and plan via SQL aggregates
 */
export async function getSubscriptionsReport(
  _filters: ReportsFilterInput,
  _currentUser: { id: string; role: string }
) {
  const [byStatus, byPlan] = await Promise.all([
    prisma.$queryRaw<{ status: SubscriptionStatus; count: bigint }[]>`
      SELECT status, COUNT(*)::bigint as count
      FROM "Subscription"
      GROUP BY status
      ORDER BY count DESC
    `,
    prisma.$queryRaw<{ planId: string; planName: string; billingPeriod: string; count: bigint }[]>`
      SELECT
        p.id as "planId",
        p.name as "planName",
        p."billingPeriod" as "billingPeriod",
        COUNT(s.id)::bigint as count
      FROM "Subscription" s
      JOIN "Plan" p ON s."planId" = p.id
      GROUP BY p.id, p.name, p."billingPeriod"
      ORDER BY count DESC
    `,
  ]);

  return {
    byStatus: byStatus.map((s) => ({
      status: s.status,
      count: Number(s.count),
    })),
    byPlan: byPlan.map((p) => ({
      planId: p.planId,
      planName: p.planName,
      billingPeriod: p.billingPeriod,
      count: Number(p.count),
    })),
  };
}
