import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../middleware/errorHandler.js';
import { toDecimal, round } from '../../lib/money.js';
import { transitionSubscription, TransitionAction } from '../subscriptions/subscriptions.service.js';

export async function getCustomerSubscriptions(
  customerId: string,
  params: { page?: number; pageSize?: number }
) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const [total, subs] = await Promise.all([
    prisma.subscription.count({ where: { customerId } }),
    prisma.subscription.findMany({
      where: { customerId },
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
            tax: true,
          },
        },
      },
    }),
  ]);

  return {
    data: subs.map((sub) => ({
      id: sub.id,
      number: sub.number,
      status: sub.status,
      startDate: sub.startDate.toISOString(),
      expiryDate: sub.expiryDate.toISOString(),
      nextBillingDate: sub.nextBillingDate ? sub.nextBillingDate.toISOString() : null,
      paymentTermDays: sub.paymentTermDays,
      quotationValidUntil: sub.quotationValidUntil ? sub.quotationValidUntil.toISOString() : null,
      notes: sub.notes,
      plan: {
        id: sub.plan.id,
        name: sub.plan.name,
        price: toDecimal(sub.plan.price).toFixed(2),
        billingPeriod: sub.plan.billingPeriod,
        pausable: sub.plan.pausable,
        closable: sub.plan.closable,
        renewable: sub.plan.renewable,
      },
      lines: sub.lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        productName: l.product.name,
        quantity: l.quantity,
        unitPrice: toDecimal(l.unitPrice).toFixed(2),
        amount: toDecimal(l.amount).toFixed(2),
      })),
      createdAt: sub.createdAt.toISOString(),
    })),
    meta: {
      page,
      pageSize,
      total,
    },
  };
}

export async function getCustomerSubscriptionDetail(customerId: string, subscriptionId: string) {
  const sub = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      customerId,
    },
    include: {
      plan: true,
      lines: {
        include: {
          product: true,
          variant: true,
          tax: true,
        },
      },
    },
  });

  if (!sub) {
    throw new NotFoundError('Subscription not found');
  }

  return {
    id: sub.id,
    number: sub.number,
    status: sub.status,
    startDate: sub.startDate.toISOString(),
    expiryDate: sub.expiryDate.toISOString(),
    nextBillingDate: sub.nextBillingDate ? sub.nextBillingDate.toISOString() : null,
    paymentTermDays: sub.paymentTermDays,
    quotationValidUntil: sub.quotationValidUntil ? sub.quotationValidUntil.toISOString() : null,
    notes: sub.notes,
    plan: {
      id: sub.plan.id,
      name: sub.plan.name,
      price: toDecimal(sub.plan.price).toFixed(2),
      billingPeriod: sub.plan.billingPeriod,
      pausable: sub.plan.pausable,
      closable: sub.plan.closable,
      renewable: sub.plan.renewable,
    },
    lines: sub.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      productName: l.product.name,
      variant: l.variant ? `${l.variant.attribute}: ${l.variant.value}` : null,
      quantity: l.quantity,
      unitPrice: toDecimal(l.unitPrice).toFixed(2),
      taxRate: l.tax ? toDecimal(l.tax.rate).toFixed(2) : '0.00',
      amount: toDecimal(l.amount).toFixed(2),
    })),
    createdAt: sub.createdAt.toISOString(),
  };
}

export async function customerSubscriptionAction(
  customerId: string,
  subscriptionId: string,
  action: TransitionAction
) {
  // First ensure subscription exists and belongs to customer
  const sub = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      customerId,
    },
    select: { id: true },
  });

  if (!sub) {
    throw new NotFoundError('Subscription not found');
  }

  return transitionSubscription(subscriptionId, action, { id: customerId, role: 'CUSTOMER' });
}

export async function getCustomerInvoices(
  customerId: string,
  params: { page?: number; pageSize?: number; status?: string }
) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const skip = (page - 1) * pageSize;
  const now = new Date();

  const where: any = { customerId };
  if (params.status) {
    where.status = params.status;
  }

  const [total, invs] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { issueDate: 'desc' },
      include: {
        subscription: {
          select: { id: true, number: true },
        },
      },
    }),
  ]);

  return {
    data: invs.map((inv) => {
      const balance = inv.total.minus(inv.amountPaid);
      const isOverdue =
        inv.status === 'CONFIRMED' && inv.dueDate < now && inv.amountPaid.lessThan(inv.total);

      return {
        id: inv.id,
        number: inv.number,
        subscriptionNumber: inv.subscription?.number || null,
        status: inv.status,
        isOverdue,
        periodStart: inv.periodStart.toISOString(),
        periodEnd: inv.periodEnd.toISOString(),
        issueDate: inv.issueDate.toISOString(),
        dueDate: inv.dueDate.toISOString(),
        total: toDecimal(inv.total).toFixed(2),
        amountPaid: toDecimal(inv.amountPaid).toFixed(2),
        balance: round(balance).toFixed(2),
        createdAt: inv.createdAt.toISOString(),
      };
    }),
    meta: {
      page,
      pageSize,
      total,
    },
  };
}

export async function getCustomerInvoiceDetail(customerId: string, invoiceId: string) {
  const now = new Date();
  const inv = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      customerId,
    },
    include: {
      subscription: {
        select: { id: true, number: true },
      },
      lines: true,
      discounts: {
        include: { discount: true },
      },
      payments: {
        orderBy: { paymentDate: 'desc' },
      },
    },
  });

  if (!inv) {
    throw new NotFoundError('Invoice not found');
  }

  const balance = inv.total.minus(inv.amountPaid);
  const isOverdue =
    inv.status === 'CONFIRMED' && inv.dueDate < now && inv.amountPaid.lessThan(inv.total);

  return {
    id: inv.id,
    number: inv.number,
    subscriptionId: inv.subscriptionId,
    subscriptionNumber: inv.subscription?.number || null,
    status: inv.status,
    isOverdue,
    periodStart: inv.periodStart.toISOString(),
    periodEnd: inv.periodEnd.toISOString(),
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    subtotal: toDecimal(inv.subtotal).toFixed(2),
    discountTotal: toDecimal(inv.discountTotal).toFixed(2),
    taxTotal: toDecimal(inv.taxTotal).toFixed(2),
    total: toDecimal(inv.total).toFixed(2),
    amountPaid: toDecimal(inv.amountPaid).toFixed(2),
    balance: round(balance).toFixed(2),
    lines: inv.lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: l.quantity,
      unitPrice: toDecimal(l.unitPrice).toFixed(2),
      taxRate: toDecimal(l.taxRate).toFixed(2),
      taxAmount: toDecimal(l.taxAmount).toFixed(2),
      amount: toDecimal(l.amount).toFixed(2),
    })),
    discounts: inv.discounts.map((d) => ({
      id: d.id,
      name: d.discount.name,
      amount: toDecimal(d.amount).toFixed(2),
    })),
    payments: inv.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: toDecimal(p.amount).toFixed(2),
      paymentDate: p.paymentDate.toISOString(),
      note: p.note,
    })),
    createdAt: inv.createdAt.toISOString(),
  };
}

