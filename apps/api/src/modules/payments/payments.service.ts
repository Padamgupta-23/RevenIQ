import { prisma } from '../../lib/prisma.js';
import { Prisma, InvoiceStatus, PaymentMethod } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../../middleware/errorHandler.js';
import { round, toDecimal } from '../../lib/money.js';
import { CreatePaymentInput, ListPaymentsQueryInput } from './payments.schemas.js';

export interface FormattedPayment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  method: PaymentMethod;
  amount: string;
  paymentDate: string;
  note: string | null;
  recordedBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

export async function createPayment(
  input: CreatePaymentInput,
  currentUser: { id: string; role: string }
): Promise<FormattedPayment> {
  const payAmountDec = new Prisma.Decimal(input.amount);
  if (payAmountDec.lessThanOrEqualTo(0)) {
    throw new ValidationError('Payment amount must be greater than zero');
  }

  return prisma.$transaction(async (tx) => {
    // 1. Acquire row lock on Invoice to prevent concurrent double-payments
    const lockedRows = await tx.$queryRaw<
      {
        id: string;
        number: string;
        status: InvoiceStatus;
        total: Prisma.Decimal;
        amountPaid: Prisma.Decimal;
        customerId: string;
      }[]
    >`
      SELECT id, number, status, total, "amountPaid", "customerId"
      FROM "Invoice"
      WHERE id = ${input.invoiceId}
      FOR UPDATE
    `;

    if (!lockedRows || lockedRows.length === 0) {
      throw new NotFoundError('Invoice not found');
    }

    const lockedInvoice = lockedRows[0];

    // State machine check
    if (lockedInvoice.status === InvoiceStatus.DRAFT) {
      throw new ConflictError(
        'Cannot record payment against a DRAFT invoice. Confirm the invoice first.'
      );
    }

    if (lockedInvoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictError('Cannot record payment against a CANCELLED invoice.');
    }

    const currentTotal = new Prisma.Decimal(lockedInvoice.total);
    const currentPaid = new Prisma.Decimal(lockedInvoice.amountPaid);
    const remainingBalance = currentTotal.minus(currentPaid);

    if (remainingBalance.lessThanOrEqualTo(0)) {
      throw new ConflictError('Invoice is already fully paid.');
    }

    if (payAmountDec.greaterThan(remainingBalance)) {
      throw new ConflictError(
        `Payment amount ($${payAmountDec.toFixed(2)}) exceeds remaining invoice balance ($${remainingBalance.toFixed(2)})`
      );
    }

    // 2. Fetch customer details
    const customer = await tx.user.findUnique({
      where: { id: lockedInvoice.customerId },
      select: { name: true },
    });

    // 3. Create Payment record
    const payment = await tx.payment.create({
      data: {
        invoiceId: lockedInvoice.id,
        method: input.method,
        amount: payAmountDec,
        paymentDate: new Date(input.paymentDate),
        note: input.note || null,
        recordedById: currentUser.id,
      },
      include: {
        recordedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // 4. Update Invoice amountPaid and auto-set PAID if settled
    const newAmountPaid = currentPaid.plus(payAmountDec);
    const isFullyPaid = newAmountPaid.greaterThanOrEqualTo(currentTotal);

    await tx.invoice.update({
      where: { id: lockedInvoice.id },
      data: {
        amountPaid: newAmountPaid,
        ...(isFullyPaid ? { status: InvoiceStatus.PAID } : {}),
      },
    });

    return {
      id: payment.id,
      invoiceId: lockedInvoice.id,
      invoiceNumber: lockedInvoice.number,
      customerName: customer?.name || 'Customer',
      method: payment.method,
      amount: toDecimal(payment.amount).toFixed(2),
      paymentDate: payment.paymentDate.toISOString(),
      note: payment.note,
      recordedBy: payment.recordedBy,
      createdAt: payment.createdAt.toISOString(),
    };
  });
}

export async function listPayments(params: ListPaymentsQueryInput) {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.PaymentWhereInput = {};

  if (params.method) {
    where.method = params.method;
  }

  if (params.startDate || params.endDate) {
    where.paymentDate = {};
    if (params.startDate) where.paymentDate.gte = new Date(params.startDate);
    if (params.endDate) {
      const end = new Date(params.endDate);
      if (params.endDate.length === 10) end.setHours(23, 59, 59, 999);
      where.paymentDate.lte = end;
    }
  }

  if (params.invoiceId) {
    where.invoiceId = params.invoiceId;
  }

  if (params.customerId) {
    where.invoice = { customerId: params.customerId };
  }

  if (params.search) {
    where.OR = [
      { invoice: { number: { contains: params.search, mode: 'insensitive' } } },
      { invoice: { customer: { name: { contains: params.search, mode: 'insensitive' } } } },
      { note: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { paymentDate: 'desc' },
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            customer: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        recordedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
  ]);

  return {
    data: payments.map((p) => ({
      id: p.id,
      invoiceId: p.invoice.id,
      invoiceNumber: p.invoice.number,
      customerName: p.invoice.customer?.name || 'Customer',
      customerEmail: p.invoice.customer?.email || '',
      method: p.method,
      amount: toDecimal(p.amount).toFixed(2),
      paymentDate: p.paymentDate.toISOString(),
      note: p.note,
      recordedBy: p.recordedBy,
      createdAt: p.createdAt.toISOString(),
    })),
    meta: {
      page,
      pageSize,
      total,
    },
  };
}

export async function getInvoicePayments(invoiceId: string) {
  const payments = await prisma.payment.findMany({
    where: { invoiceId },
    orderBy: { paymentDate: 'desc' },
    include: {
      recordedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return payments.map((p) => ({
    id: p.id,
    method: p.method,
    amount: toDecimal(p.amount).toFixed(2),
    paymentDate: p.paymentDate.toISOString(),
    note: p.note,
    recordedBy: p.recordedBy,
    createdAt: p.createdAt.toISOString(),
  }));
}
