import { PrismaClient, Role, SubscriptionStatus, InvoiceStatus, PaymentMethod } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Bulk Seeder (5,000+ Subscriptions across 200 Customers) ---');
  const startTime = Date.now();

  // 1. Get or create Admin user
  let admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  const demoHash = await bcrypt.hash('DemoPass123!', 10);

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: 'admin@reveniq.test',
        passwordHash: demoHash,
        name: 'Super Admin',
        role: Role.ADMIN,
      },
    });
  }

  // 2. Fetch existing plans and products
  const plans = await prisma.plan.findMany();
  const products = await prisma.product.findMany();
  const taxes = await prisma.tax.findMany();

  if (plans.length === 0 || products.length === 0) {
    console.error('No plans or products found. Please run "npm run db:seed" first.');
    return;
  }

  // 3. Create 200 Customers in bulk
  console.log('Generating 200 Customers...');
  const existingCustomersCount = await prisma.user.count({ where: { role: Role.CUSTOMER } });
  const customersNeeded = Math.max(0, 200 - existingCustomersCount);

  if (customersNeeded > 0) {
    const customerData = Array.from({ length: customersNeeded }).map((_, i) => ({
      email: `bulk_cust_${Date.now()}_${i + 1}@reveniq.test`,
      passwordHash: demoHash,
      name: `Enterprise Client ${i + 1}`,
      company: `Organization ${i + 1} Inc`,
      role: Role.CUSTOMER,
      isActive: true,
    }));

    await prisma.user.createMany({
      data: customerData,
      skipDuplicates: true,
    });
  }

  const allCustomers = await prisma.user.findMany({
    where: {
      role: Role.CUSTOMER,
      email: { startsWith: 'bulk_cust_' },
    },
    select: { id: true },
    take: 200,
  });

  console.log(`Loaded ${allCustomers.length} Customers.`);

  // 4. Check existing subscriptions count
  const currentSubCount = await prisma.subscription.count();
  const targetSubCount = 5200;
  const subsNeeded = Math.max(0, targetSubCount - currentSubCount);

  console.log(`Current Subscriptions: ${currentSubCount}. Generating ${subsNeeded} new subscriptions...`);

  if (subsNeeded > 0) {
    const BATCH_SIZE = 500;
    const numBatches = Math.ceil(subsNeeded / BATCH_SIZE);
    const now = new Date();

    for (let b = 0; b < numBatches; b++) {
      const batchCount = Math.min(BATCH_SIZE, subsNeeded - b * BATCH_SIZE);
      const subBatchData: any[] = [];
      const subIds: string[] = [];

      for (let i = 0; i < batchCount; i++) {
        const globalIdx = b * BATCH_SIZE + i + currentSubCount + 1;
        const cust = allCustomers[globalIdx % allCustomers.length];
        const plan = plans[globalIdx % plans.length];
        const subId = `bulk_sub_${Date.now()}_${b}_${i}`;
        subIds.push(subId);

        // Mix: 70% ACTIVE, 15% PAUSED, 10% CLOSED, 5% CONFIRMED
        let status = SubscriptionStatus.ACTIVE;
        const r = i % 20;
        if (r === 0) status = SubscriptionStatus.CONFIRMED;
        else if (r === 1 || r === 2) status = SubscriptionStatus.CLOSED;
        else if (r === 3 || r === 4 || r === 5) status = SubscriptionStatus.PAUSED;

        const startDate = new Date(now.getTime() - (globalIdx % 180) * 86400000);
        const expiryDate = new Date(startDate.getTime() + 365 * 86400000);
        const nextBillingDate =
          status === SubscriptionStatus.ACTIVE
            ? new Date(now.getTime() + ((globalIdx % 30) - 10) * 86400000)
            : null;

        subBatchData.push({
          id: subId,
          number: `SUB-B${String(globalIdx).padStart(6, '0')}`,
          customerId: cust.id,
          planId: plan.id,
          status,
          startDate,
          expiryDate,
          nextBillingDate,
          paymentTermDays: 15,
          createdById: admin.id,
          notes: 'Generated via bulk seeder for performance benchmarking',
        });
      }

      // Bulk insert subscriptions
      await prisma.subscription.createMany({
        data: subBatchData,
        skipDuplicates: true,
      });

      // Bulk insert subscription lines for this batch
      const lineBatchData: any[] = [];
      for (let i = 0; i < batchCount; i++) {
        const subId = subIds[i];
        const prod = products[i % products.length];
        const tax = taxes[i % taxes.length];
        const qty = 1 + (i % 3);
        const unitPrice = prod.salesPrice;
        const amount = Number(unitPrice) * qty;

        lineBatchData.push({
          id: `line_${subId}_1`,
          subscriptionId: subId,
          productId: prod.id,
          quantity: qty,
          unitPrice,
          taxId: tax?.id || null,
          amount,
        });
      }

      await prisma.subscriptionLine.createMany({
        data: lineBatchData,
        skipDuplicates: true,
      });

      // Generate Invoices & Payments for ~50% of the subscriptions in batch
      const invBatchData: any[] = [];
      const paymentBatchData: any[] = [];
      const invIds: string[] = [];

      for (let i = 0; i < batchCount; i += 2) {
        const sub = subBatchData[i];
        const invId = `inv_${sub.id}`;
        invIds.push(invId);
        const total = 100 + (i % 5) * 50;

        // Mix: 45% PAID, 30% OVERDUE (CONFIRMED + past dueDate), 25% OUTSTANDING (CONFIRMED + future dueDate)
        let invStatus = InvoiceStatus.PAID;
        let amountPaid = total;
        let dueDate = new Date(now.getTime() - 10 * 86400000); // 10 days ago

        if (i % 3 === 0) {
          // Overdue
          invStatus = InvoiceStatus.CONFIRMED;
          amountPaid = 0;
          dueDate = new Date(now.getTime() - (5 + (i % 25)) * 86400000); // past due
        } else if (i % 3 === 1) {
          // Outstanding
          invStatus = InvoiceStatus.CONFIRMED;
          amountPaid = 0;
          dueDate = new Date(now.getTime() + (5 + (i % 25)) * 86400000); // future due
        }

        invBatchData.push({
          id: invId,
          number: `INV-B${String(b * BATCH_SIZE + i + 1).padStart(6, '0')}`,
          subscriptionId: sub.id,
          customerId: sub.customerId,
          status: invStatus,
          periodStart: new Date(now.getTime() - 30 * 86400000),
          periodEnd: now,
          issueDate: new Date(now.getTime() - 25 * 86400000),
          dueDate,
          subtotal: total,
          discountTotal: 0,
          taxTotal: 0,
          total,
          amountPaid,
        });

        if (invStatus === InvoiceStatus.PAID) {
          paymentBatchData.push({
            id: `pay_${invId}`,
            invoiceId: invId,
            method: PaymentMethod.CARD,
            amount: total,
            paymentDate: new Date(now.getTime() - (i % 20) * 86400000),
            note: 'Settled via automated recurring payment',
            recordedById: admin.id,
          });
        }
      }

      await prisma.invoice.createMany({
        data: invBatchData,
        skipDuplicates: true,
      });

      if (paymentBatchData.length > 0) {
        await prisma.payment.createMany({
          data: paymentBatchData,
          skipDuplicates: true,
        });
      }

      console.log(`  Processed batch ${b + 1}/${numBatches} (+${batchCount} subscriptions)`);
    }
  }

  const finalSubCount = await prisma.subscription.count();
  const finalCustCount = await prisma.user.count({ where: { role: Role.CUSTOMER } });
  const finalInvCount = await prisma.invoice.count();
  const finalPayCount = await prisma.payment.count();

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('--- Bulk Seeder Completed Successfully ---');
  console.log(`Total Customers: ${finalCustCount}`);
  console.log(`Total Subscriptions: ${finalSubCount}`);
  console.log(`Total Invoices: ${finalInvCount}`);
  console.log(`Total Payments: ${finalPayCount}`);
  console.log(`Elapsed Time: ${durationSec} seconds`);
}

main()
  .catch((e) => {
    console.error('Bulk seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
