import { Prisma, InvoiceStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { parsePagination, buildPaginationMeta, PaginationMeta } from '../../lib/pagination.js';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler.js';
import { toDecimal, round } from '../../lib/money.js';
import { sendEmail } from '../../lib/mailer.js';
import { ListInvoicesQuery } from './invoices.schemas.js';

export interface FormattedInvoiceLine {
  id: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: string;
  taxRate: string;
  taxAmount: string;
  amount: string;
  product?: {
    id: string;
    name: string;
    type: string;
  } | null;
}

export interface FormattedInvoiceDiscount {
  id: string;
  discountId: string;
  amount: string;
  discount?: {
    id: string;
    name: string;
    type: string;
    value: string;
    scope: string;
  };
}

export interface FormattedInvoicePayment {
  id: string;
  amount: string;
  method: string;
  paymentDate: string;
  note: string | null;
}

export interface FormattedInvoice {
  id: string;
  number: string;
  subscriptionId: string;
  customerId: string;
  status: InvoiceStatus;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  balance: string;
  isOverdue: boolean;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    phone: string | null;
    address: string | null;
  };
  subscription?: {
    id: string;
    number: string;
    plan?: {
      id: string;
      name: string;
      price: string;
      billingPeriod: string;
    };
  };
  lines: FormattedInvoiceLine[];
  discounts: FormattedInvoiceDiscount[];
  payments: FormattedInvoicePayment[];
}

export function formatInvoice(inv: any): FormattedInvoice {
  const now = new Date();
  const totalDec = toDecimal(inv.total);
  const paidDec = toDecimal(inv.amountPaid);
  const balanceDec = round(totalDec.minus(paidDec));

  // Overdue rule: status = CONFIRMED AND dueDate < today AND amountPaid < total
  const isOverdue =
    inv.status === InvoiceStatus.CONFIRMED &&
    new Date(inv.dueDate) < now &&
    paidDec.lt(totalDec);

  return {
    id: inv.id,
    number: inv.number,
    subscriptionId: inv.subscriptionId,
    customerId: inv.customerId,
    status: inv.status,
    periodStart:
      inv.periodStart instanceof Date ? inv.periodStart.toISOString() : inv.periodStart,
    periodEnd:
      inv.periodEnd instanceof Date ? inv.periodEnd.toISOString() : inv.periodEnd,
    issueDate:
      inv.issueDate instanceof Date ? inv.issueDate.toISOString() : inv.issueDate,
    dueDate: inv.dueDate instanceof Date ? inv.dueDate.toISOString() : inv.dueDate,
    subtotal: toDecimal(inv.subtotal).toFixed(2),
    discountTotal: toDecimal(inv.discountTotal).toFixed(2),
    taxTotal: toDecimal(inv.taxTotal).toFixed(2),
    total: totalDec.toFixed(2),
    amountPaid: paidDec.toFixed(2),
    balance: balanceDec.toFixed(2),
    isOverdue,
    sentAt: inv.sentAt instanceof Date ? inv.sentAt.toISOString() : inv.sentAt || null,
    createdAt: inv.createdAt instanceof Date ? inv.createdAt.toISOString() : inv.createdAt,
    updatedAt: inv.updatedAt instanceof Date ? inv.updatedAt.toISOString() : inv.updatedAt,
    customer: inv.customer
      ? {
          id: inv.customer.id,
          name: inv.customer.name,
          email: inv.customer.email,
          company: inv.customer.company,
          phone: inv.customer.phone,
          address: inv.customer.address,
        }
      : undefined,
    subscription: inv.subscription
      ? {
          id: inv.subscription.id,
          number: inv.subscription.number,
          plan: inv.subscription.plan
            ? {
                id: inv.subscription.plan.id,
                name: inv.subscription.plan.name,
                price: toDecimal(inv.subscription.plan.price).toFixed(2),
                billingPeriod: inv.subscription.plan.billingPeriod,
              }
            : undefined,
        }
      : undefined,
    lines: (inv.lines || []).map((l: any) => ({
      id: l.id,
      productId: l.productId,
      description: l.description,
      quantity: l.quantity,
      unitPrice: toDecimal(l.unitPrice).toFixed(2),
      taxRate: toDecimal(l.taxRate).toFixed(2),
      taxAmount: toDecimal(l.taxAmount).toFixed(2),
      amount: toDecimal(l.amount).toFixed(2),
      product: l.product
        ? {
            id: l.product.id,
            name: l.product.name,
            type: l.product.type,
          }
        : null,
    })),
    discounts: (inv.discounts || []).map((d: any) => ({
      id: d.id,
      discountId: d.discountId,
      amount: toDecimal(d.amount).toFixed(2),
      discount: d.discount
        ? {
            id: d.discount.id,
            name: d.discount.name,
            type: d.discount.type,
            value: toDecimal(d.discount.value).toFixed(2),
            scope: d.discount.scope,
          }
        : undefined,
    })),
    payments: (inv.payments || []).map((p: any) => ({
      id: p.id,
      amount: toDecimal(p.amount).toFixed(2),
      method: p.method,
      paymentDate:
        p.paymentDate instanceof Date ? p.paymentDate.toISOString() : p.paymentDate,
      note: p.note,
    })),
  };
}

/**
 * Lists invoices with pagination, search, status, customer, and overdue filters.
 */
export async function listInvoices(
  query: ListInvoicesQuery
): Promise<{ data: FormattedInvoice[]; meta: PaginationMeta }> {
  const pagination = parsePagination(query as Record<string, unknown>);
  const where: Prisma.InvoiceWhereInput = {};

  if (query.customerId) {
    where.customerId = query.customerId;
  }

  if (query.subscriptionId) {
    where.subscriptionId = query.subscriptionId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.overdue === true) {
    where.status = InvoiceStatus.CONFIRMED;
    where.dueDate = { lt: new Date() };
  }

  if (query.startDate || query.endDate) {
    where.issueDate = {};
    if (query.startDate) where.issueDate.gte = query.startDate;
    if (query.endDate) where.issueDate.lte = query.endDate;
  }

  if (pagination.search) {
    where.OR = [
      { number: { contains: pagination.search, mode: 'insensitive' } },
      { customer: { name: { contains: pagination.search, mode: 'insensitive' } } },
      { customer: { email: { contains: pagination.search, mode: 'insensitive' } } },
    ];
  }

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: {
        customer: true,
        subscription: {
          include: { plan: true },
        },
        lines: {
          include: { product: true },
        },
        discounts: {
          include: { discount: true },
        },
        payments: true,
      },
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    data: invoices.map(formatInvoice),
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

/**
 * Retrieves a single invoice by its ID.
 */
export async function getInvoiceById(id: string): Promise<FormattedInvoice> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      subscription: {
        include: { plan: true },
      },
      lines: {
        include: { product: true },
      },
      discounts: {
        include: { discount: true },
      },
      payments: true,
    },
  });

  if (!invoice) {
    throw new NotFoundError('Invoice not found');
  }

  return formatInvoice(invoice);
}

/**
 * Transitions an invoice from DRAFT to CONFIRMED.
 * Enforces invoice state machine: DRAFT -> CONFIRMED -> PAID.
 */
export async function confirmInvoice(id: string): Promise<FormattedInvoice> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
  });

  if (!invoice) {
    throw new NotFoundError('Invoice not found');
  }

  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new ConflictError(
      `Cannot confirm invoice in ${invoice.status} status (must be DRAFT)`
    );
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: InvoiceStatus.CONFIRMED },
    include: {
      customer: true,
      subscription: { include: { plan: true } },
      lines: { include: { product: true } },
      discounts: { include: { discount: true } },
      payments: true,
    },
  });

  return formatInvoice(updated);
}

/**
 * Transitions an invoice to CANCELLED.
 * Enforces invoice state machine: DRAFT/CONFIRMED -> CANCELLED.
 * A PAID invoice is strictly immutable and cannot be cancelled.
 *
 * NOTE (Per AGENTS.md & P3-3 requirements):
 * Cancelling an invoice must NOT roll back the subscription's nextBillingDate.
 * The subscription's billing schedule remains forward-progressing; missed or voided
 * cycles are recorded historically and not re-triggered by resetting the billing date.
 */
export async function cancelInvoice(id: string): Promise<FormattedInvoice> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
  });

  if (!invoice) {
    throw new NotFoundError('Invoice not found');
  }

  if (invoice.status === InvoiceStatus.PAID) {
    throw new ConflictError('Cannot cancel a PAID invoice (paid invoices are immutable)');
  }

  if (invoice.status === InvoiceStatus.CANCELLED) {
    throw new ConflictError('Invoice is already CANCELLED');
  }

  // Update status to CANCELLED without altering subscription.nextBillingDate
  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: InvoiceStatus.CANCELLED },
    include: {
      customer: true,
      subscription: { include: { plan: true } },
      lines: { include: { product: true } },
      discounts: { include: { discount: true } },
      payments: true,
    },
  });

  return formatInvoice(updated);
}

/**
 * Sends an itemized invoice email to the customer and records sentAt timestamp.
 */
export async function sendInvoice(id: string): Promise<FormattedInvoice> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      subscription: { include: { plan: true } },
      lines: { include: { product: true } },
      discounts: { include: { discount: true } },
      payments: true,
    },
  });

  if (!invoice) {
    throw new NotFoundError('Invoice not found');
  }

  const formatted = formatInvoice(invoice);
  const now = new Date();

  // Send email via mailer
  const linesHtml = formatted.lines
    .map(
      (l) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #EBE8DF; font-size: 14px; color: #1F291E;">
          ${l.description}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #EBE8DF; font-size: 14px; text-align: center; color: #1F291E;">
          ${l.quantity}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #EBE8DF; font-size: 14px; text-align: right; color: #1F291E;">
          $${l.unitPrice}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #EBE8DF; font-size: 14px; text-align: right; color: #1F291E;">
          $${l.amount}
        </td>
      </tr>
    `
    )
    .join('');

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAF9F5; margin: 0; padding: 30px; color: #1F291E; }
          .card { max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #EBE8DF; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #556B2F; padding-bottom: 16px; margin-bottom: 24px; }
          .brand { font-size: 22px; font-weight: 700; color: #384527; }
          .inv-num { font-size: 18px; font-weight: 600; color: #556B2F; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { text-align: left; padding: 10px; background-color: #FAF8F2; font-size: 12px; font-weight: 600; color: #475731; border-bottom: 1px solid #EBE8DF; }
          .totals-table td { padding: 6px 12px; font-size: 14px; }
          .total-row { font-size: 16px; font-weight: 700; color: #181E11; border-top: 2px solid #556B2F; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="brand">RevenIQ</div>
            <div class="inv-num">${formatted.number}</div>
          </div>
          <p>Dear <strong>${formatted.customer?.name || 'Customer'}</strong>,</p>
          <p>Please find attached the summary for invoice <strong>${formatted.number}</strong> issued on <strong>${new Date(formatted.issueDate).toLocaleDateString()}</strong>.</p>
          <p><strong>Due Date:</strong> ${new Date(formatted.dueDate).toLocaleDateString()} | <strong>Status:</strong> ${formatted.status}</p>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml}
            </tbody>
          </table>

          <table class="totals-table" style="width: 250px; margin-left: auto;">
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right;">$${formatted.subtotal}</td>
            </tr>
            <tr>
              <td>Discount:</td>
              <td style="text-align: right; color: #556B2F;">-$${formatted.discountTotal}</td>
            </tr>
            <tr>
              <td>Tax:</td>
              <td style="text-align: right;">+$${formatted.taxTotal}</td>
            </tr>
            <tr class="total-row">
              <td>Total:</td>
              <td style="text-align: right;">$${formatted.total}</td>
            </tr>
            <tr>
              <td>Amount Paid:</td>
              <td style="text-align: right;">$${formatted.amountPaid}</td>
            </tr>
            <tr style="font-weight: 600;">
              <td>Balance Due:</td>
              <td style="text-align: right; color: #9A2C2C;">$${formatted.balance}</td>
            </tr>
          </table>

          <p style="font-size: 13px; color: #758D54; margin-top: 32px; border-top: 1px solid #EBE8DF; padding-top: 16px;">
            Thank you for choosing RevenIQ Revenue Intelligence.
          </p>
        </div>
      </body>
    </html>
  `;

  if (formatted.customer?.email) {
    await sendEmail({
      to: formatted.customer.email,
      subject: `Invoice ${formatted.number} from RevenIQ`,
      html: emailHtml,
    });
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { sentAt: now },
    include: {
      customer: true,
      subscription: { include: { plan: true } },
      lines: { include: { product: true } },
      discounts: { include: { discount: true } },
      payments: true,
    },
  });

  return formatInvoice(updated);
}

/**
 * Generates an executive-ready, print-styled HTML document for GET /invoices/:id/print
 */
export async function generatePrintableHtml(id: string): Promise<string> {
  const inv = await getInvoiceById(id);

  const linesRows = inv.lines
    .map(
      (l) => `
    <tr>
      <td class="desc">
        <strong>${l.description}</strong>
        ${l.product ? `<span class="tag">${l.product.type}</span>` : ''}
      </td>
      <td class="center">${l.quantity}</td>
      <td class="right">$${l.unitPrice}</td>
      <td class="right">${l.taxRate}% ($${l.taxAmount})</td>
      <td class="right font-bold">$${l.amount}</td>
    </tr>
  `
    )
    .join('');

  const statusColor =
    inv.status === 'PAID'
      ? '#2E7D32'
      : inv.isOverdue
      ? '#C62828'
      : inv.status === 'CONFIRMED'
      ? '#1565C0'
      : inv.status === 'CANCELLED'
      ? '#616161'
      : '#757575';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${inv.number} - RevenIQ</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 30px;
      color: #181E11;
      background: #FFFFFF;
      font-size: 13px;
      line-height: 1.5;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #384527;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 800;
      color: #384527;
      letter-spacing: -0.5px;
    }
    .brand-subtitle {
      font-size: 11px;
      font-weight: 600;
      color: #5A6F3F;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .inv-header-right {
      text-align: right;
    }
    .inv-number {
      font-size: 22px;
      font-weight: 700;
      color: #181E11;
      font-family: monospace;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      color: #FFFFFF;
      background: ${statusColor};
      border-radius: 4px;
      text-transform: uppercase;
      margin-top: 5px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 30px;
      padding: 16px;
      background: #FAF8F2;
      border-radius: 8px;
      border: 1px solid #EBE5D3;
    }
    .meta-block h4 {
      margin: 0 0 8px 0;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #5A6F3F;
    }
    .meta-block p {
      margin: 0;
      font-size: 13px;
      color: #2F3A21;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
    }
    th {
      background: #E8EDE0;
      color: #2F3A21;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px;
      border-top: 1px solid #B5C4A0;
      border-bottom: 2px solid #384527;
    }
    td {
      padding: 12px 10px;
      border-bottom: 1px solid #EBE5D3;
      vertical-align: top;
    }
    td.desc { width: 45%; }
    td.center { text-align: center; }
    td.right, th.right { text-align: right; }
    .font-bold { font-weight: 700; }
    .tag {
      display: inline-block;
      font-size: 9px;
      background: #D3DCC5;
      color: #2F3A21;
      padding: 1px 5px;
      border-radius: 3px;
      margin-left: 6px;
      text-transform: uppercase;
      font-weight: 600;
    }
    .totals-area {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 40px;
    }
    .totals-table {
      width: 320px;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 6px 10px;
      border: none;
    }
    .totals-table tr.total-due td {
      border-top: 2px solid #384527;
      border-bottom: 2px solid #384527;
      font-size: 16px;
      font-weight: 800;
      color: #181E11;
      padding: 10px;
    }
    .footer {
      border-top: 1px solid #EBE5D3;
      padding-top: 15px;
      text-align: center;
      font-size: 11px;
      color: #5A6F3F;
    }
    .no-print {
      margin-bottom: 20px;
      text-align: right;
    }
    .print-btn {
      background: #384527;
      color: #FFF;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    @media print {
      .no-print { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="no-print">
      <button class="print-btn" onclick="window.print()">Print Invoice</button>
    </div>

    <div class="header">
      <div>
        <div class="brand-title">RevenIQ</div>
        <div class="brand-subtitle">Revenue Intelligence & Subscription Management</div>
        <p style="margin: 4px 0 0 0; color: #5A6F3F; font-size: 12px;">Billing & Payments Engine</p>
      </div>
      <div class="inv-header-right">
        <div class="inv-number">${inv.number}</div>
        <div><span class="status-badge">${inv.isOverdue ? 'OVERDUE' : inv.status}</span></div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-block">
        <h4>Billed To</h4>
        <p><strong>${inv.customer?.name || 'Customer'}</strong></p>
        ${inv.customer?.company ? `<p>${inv.customer.company}</p>` : ''}
        <p>${inv.customer?.email || ''}</p>
        ${inv.customer?.phone ? `<p>${inv.customer.phone}</p>` : ''}
        ${inv.customer?.address ? `<p>${inv.customer.address}</p>` : ''}
      </div>

      <div class="meta-block">
        <h4>Invoice Metadata</h4>
        <p><strong>Issue Date:</strong> ${new Date(inv.issueDate).toLocaleDateString()}</p>
        <p><strong>Due Date:</strong> ${new Date(inv.dueDate).toLocaleDateString()}</p>
        <p><strong>Billing Period:</strong> ${new Date(inv.periodStart).toLocaleDateString()} &mdash; ${new Date(inv.periodEnd).toLocaleDateString()}</p>
        ${inv.subscription ? `<p><strong>Subscription:</strong> ${inv.subscription.number} (${inv.subscription.plan?.name || ''})</p>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="center">Quantity</th>
          <th class="right">Unit Price</th>
          <th class="right">Tax Rate</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${linesRows}
      </tbody>
    </table>

    <div class="totals-area">
      <table class="totals-table">
        <tr>
          <td>Subtotal:</td>
          <td class="right font-bold">$${inv.subtotal}</td>
        </tr>
        <tr>
          <td>Discount Total:</td>
          <td class="right" style="color: #5A6F3F;">-$${inv.discountTotal}</td>
        </tr>
        <tr>
          <td>Tax Total:</td>
          <td class="right">+$${inv.taxTotal}</td>
        </tr>
        <tr class="total-due">
          <td>Total:</td>
          <td class="right">$${inv.total}</td>
        </tr>
        <tr>
          <td>Amount Paid:</td>
          <td class="right" style="color: #2E7D32;">-$${inv.amountPaid}</td>
        </tr>
        <tr style="font-weight: 700; color: #C62828;">
          <td>Balance Due:</td>
          <td class="right">$${inv.balance}</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <p>RevenIQ Platform &bull; Automated Recurring Invoicing &bull; All transactions subject to terms of service.</p>
    </div>
  </div>
</body>
</html>
`;
}

