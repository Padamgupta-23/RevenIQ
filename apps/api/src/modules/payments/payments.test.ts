import { describe, it, expect } from 'vitest';
import { createPayment } from './payments.service.js';
import { prisma } from '../../lib/prisma.js';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';

describe('Payments Module (P4-2)', () => {
  it('records partial payment then full payment, transitioning invoice to PAID', async () => {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) return;

    // Find a confirmed invoice with positive balance
    const invoice = await prisma.invoice.findFirst({
      where: {
        status: InvoiceStatus.CONFIRMED,
        amountPaid: { lt: prisma.invoice.fields.total },
      },
    });
    if (!invoice) return;

    const total = Number(invoice.total);
    const alreadyPaid = Number(invoice.amountPaid);
    const balance = total - alreadyPaid;
    if (balance <= 1) return;

    // 1. Partial payment (half the balance)
    const partialAmount = (balance / 2).toFixed(2);
    const partPayment = await createPayment(
      {
        invoiceId: invoice.id,
        method: PaymentMethod.CARD,
        amount: partialAmount,
        paymentDate: new Date().toISOString(),
        note: 'Partial installment',
      },
      { id: admin.id, role: 'ADMIN' }
    );

    expect(partPayment.amount).toBe(partialAmount);

    const afterPartial = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(Number(afterPartial?.amountPaid)).toBeCloseTo(alreadyPaid + Number(partialAmount), 2);
    expect(afterPartial?.status).toBe(InvoiceStatus.CONFIRMED);

    // 2. Final payment for remaining balance
    const remainingBalance = (total - Number(afterPartial?.amountPaid)).toFixed(2);
    const finalPayment = await createPayment(
      {
        invoiceId: invoice.id,
        method: PaymentMethod.BANK_TRANSFER,
        amount: remainingBalance,
        paymentDate: new Date().toISOString(),
        note: 'Final settlement',
      },
      { id: admin.id, role: 'ADMIN' }
    );

    expect(finalPayment.amount).toBe(remainingBalance);

    const afterFinal = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(afterFinal?.status).toBe(InvoiceStatus.PAID);
    expect(afterFinal?.amountPaid.toString()).toBe(invoice.total.toString());
  });

  it('rejects payment if amount exceeds remaining balance with 409', async () => {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) return;

    const invoice = await prisma.invoice.findFirst({
      where: { status: InvoiceStatus.CONFIRMED },
    });
    if (!invoice) return;

    await expect(
      createPayment(
        {
          invoiceId: invoice.id,
          method: PaymentMethod.BANK_TRANSFER,
          amount: '9999999.00',
          paymentDate: new Date().toISOString(),
        },
        { id: admin.id, role: 'ADMIN' }
      )
    ).rejects.toThrow(/exceeds remaining invoice balance/);
  });

  it('rejects payment on DRAFT or CANCELLED invoices with 409', async () => {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) return;

    const draftInvoice = await prisma.invoice.findFirst({
      where: { status: InvoiceStatus.DRAFT },
    });
    if (draftInvoice) {
      await expect(
        createPayment(
          {
            invoiceId: draftInvoice.id,
            method: PaymentMethod.CASH,
            amount: '10.00',
            paymentDate: new Date().toISOString(),
          },
          { id: admin.id, role: 'ADMIN' }
        )
      ).rejects.toThrow(/Cannot record payment against a DRAFT invoice/);
    }
  });

  it('prevents double-payment race conditions using row locks (FOR UPDATE)', async () => {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) return;

    // Create a dedicated test invoice for concurrency check
    const customer = await prisma.user.findFirst({ where: { role: 'CUSTOMER' } });
    const sub = await prisma.subscription.findFirst({ where: { status: 'ACTIVE' } });
    if (!customer || !sub) return;

    const testInvoice = await prisma.invoice.create({
      data: {
        number: `INV-CONCUR-${Date.now()}`,
        subscriptionId: sub.id,
        customerId: customer.id,
        status: InvoiceStatus.CONFIRMED,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86400000),
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 15 * 86400000),
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 0,
        total: 100,
        amountPaid: 0,
      },
    });

    // Fire two simultaneous payments each attempting to pay the entire balance ($100)
    const results = await Promise.allSettled([
      createPayment(
        {
          invoiceId: testInvoice.id,
          method: PaymentMethod.CARD,
          amount: '100.00',
          paymentDate: new Date().toISOString(),
          note: 'Concurrent attempt 1',
        },
        { id: admin.id, role: 'ADMIN' }
      ),
      createPayment(
        {
          invoiceId: testInvoice.id,
          method: PaymentMethod.CARD,
          amount: '100.00',
          paymentDate: new Date().toISOString(),
          note: 'Concurrent attempt 2',
        },
        { id: admin.id, role: 'ADMIN' }
      ),
    ]);

    // Exactly one must succeed, and the other must be rejected (due to row lock ensuring sequential evaluation of remaining balance)
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const finalInvoice = await prisma.invoice.findUnique({
      where: { id: testInvoice.id },
    });
    expect(finalInvoice?.status).toBe(InvoiceStatus.PAID);
    expect(Number(finalInvoice?.amountPaid)).toBe(100);
  });
});
