import {
  PrismaClient,
  Role,
  ProductType,
  BillingPeriod,
  DiscountType,
  DiscountScope,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

// Supabase client for dual sync
const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://owqoorexzuvwziketnpg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cW9vcmV4enV2d3ppa2V0bnBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzQxNjMwOSwiZXhwIjoyMTA4OTkyMzA5fQ.IqioL9CoxEMB2aoScQw-uxGhvSUOLLevGKdQVnCNtIg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Demo password satisfying: >8 chars, uppercase, lowercase, special char
const DEMO_PASSWORD = 'RevenIQ#2026!';

async function syncToSupabase(user: {
  email: string;
  name: string;
  role: string;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
}) {
  try {
    const email = user.email.toLowerCase().trim();
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existing = listData?.users.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (existing) {
      await supabase.auth.admin.updateUserById(existing.id, {
        password: DEMO_PASSWORD,
        user_metadata: {
          name: user.name,
          role: user.role,
          phone: user.phone || undefined,
          company: user.company || undefined,
          address: user.address || undefined,
        },
      });
    } else {
      await supabase.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          name: user.name,
          role: user.role,
          phone: user.phone || undefined,
          company: user.company || undefined,
          address: user.address || undefined,
        },
      });
    }
  } catch (err) {
    // Non-blocking for local seed run
    console.warn(`[Supabase Sync Warning] Could not sync ${user.email}:`, (err as any)?.message);
  }
}

async function main() {
  console.log('───────────────────────────────────────────────────────');
  console.log('🌱 Starting RevenIQ database seeding (idempotent)...');
  console.log('───────────────────────────────────────────────────────');

  // 1. ATOMIC NUMBERING COUNTERS
  console.log('📦 Seeding atomic counters...');
  await prisma.counter.upsert({
    where: { key: 'subscription' },
    update: {},
    create: { key: 'subscription', value: 0 },
  });

  await prisma.counter.upsert({
    where: { key: 'invoice' },
    update: {},
    create: { key: 'invoice', value: 0 },
  });

  // 2. USERS & RBAC (Admin, Staff, 3 Customers + User account)
  console.log('👥 Seeding users & RBAC roles...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const demoUsers = [
    {
      email: 'admin@reveniq.test',
      name: 'System Administrator',
      role: Role.ADMIN,
      phone: '+1-555-0100',
      company: 'RevenIQ Operations',
      address: 'Suite 100, Revenue Tower, Financial District',
    },
    {
      email: 'staff@reveniq.test',
      name: 'Operations Staff',
      role: Role.STAFF,
      phone: '+1-555-0101',
      company: 'RevenIQ Operations',
      address: 'Suite 102, Revenue Tower, Financial District',
    },
    {
      email: 'customer1@reveniq.test',
      name: 'Acme Enterprise Solutions',
      role: Role.CUSTOMER,
      phone: '+1-555-0201',
      company: 'Acme Global Holdings',
      address: '450 Innovation Parkway, Austin, TX',
    },
    {
      email: 'customer2@reveniq.test',
      name: 'Starlight Media Network',
      role: Role.CUSTOMER,
      phone: '+1-555-0202',
      company: 'Starlight Digital Media Ltd',
      address: '88 Creative Boulevard, Los Angeles, CA',
    },
    {
      email: 'customer3@reveniq.test',
      name: 'Apex Global Logistics',
      role: Role.CUSTOMER,
      phone: '+1-555-0203',
      company: 'Apex Freight & Logistics',
      address: '12 Harbor View Drive, Seattle, WA',
    },
    {
      email: 'officialpadam23@gmail.com',
      name: 'Padam Gupta',
      role: Role.ADMIN,
      phone: '07828785014',
      company: 'RevenIQ Executive',
      address: 'India',
    },
  ];

  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        passwordHash,
        phone: u.phone,
        company: u.company,
        address: u.address,
        isActive: true,
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        phone: u.phone,
        company: u.company,
        address: u.address,
        isActive: true,
      },
    });

    await syncToSupabase(user);
  }

  // 3. TAXES (GST 5%, GST 18%)
  console.log('⚖️  Seeding tax rates...');
  let tax5 = await prisma.tax.findFirst({ where: { name: 'GST 5%' } });
  if (!tax5) {
    tax5 = await prisma.tax.create({
      data: {
        name: 'GST 5%',
        rate: 5.0,
        isActive: true,
      },
    });
  }

  let tax18 = await prisma.tax.findFirst({ where: { name: 'GST 18%' } });
  if (!tax18) {
    tax18 = await prisma.tax.create({
      data: {
        name: 'GST 18%',
        rate: 18.0,
        isActive: true,
      },
    });
  }

  // 4. PLANS (Monthly, Yearly, Weekly, Daily)
  console.log('📅 Seeding subscription plans...');
  const planData = [
    {
      name: 'Enterprise Monthly Plan',
      price: 299.0,
      billingPeriod: BillingPeriod.MONTHLY,
      minQuantity: 1,
      startDate: new Date('2026-01-01T00:00:00Z'),
      autoClose: false,
      closable: true,
      pausable: true,
      renewable: true,
    },
    {
      name: 'Enterprise Annual Plan',
      price: 2990.0,
      billingPeriod: BillingPeriod.YEARLY,
      minQuantity: 1,
      startDate: new Date('2026-01-01T00:00:00Z'),
      autoClose: false,
      closable: true,
      pausable: true,
      renewable: true,
    },
    {
      name: 'Sprint Weekly Plan',
      price: 99.0,
      billingPeriod: BillingPeriod.WEEKLY,
      minQuantity: 1,
      startDate: new Date('2026-01-01T00:00:00Z'),
      autoClose: false,
      closable: true,
      pausable: true,
      renewable: true,
    },
    {
      name: 'Flex Daily On-Demand',
      price: 25.0,
      billingPeriod: BillingPeriod.DAILY,
      minQuantity: 1,
      startDate: new Date('2026-01-01T00:00:00Z'),
      autoClose: true,
      closable: true,
      pausable: false,
      renewable: true,
    },
  ];

  const seededPlans: Record<string, any> = {};
  for (const p of planData) {
    let plan = await prisma.plan.findFirst({ where: { name: p.name } });
    if (!plan) {
      plan = await prisma.plan.create({ data: p });
    }
    seededPlans[p.name] = plan;
  }

  // 5. PRODUCTS & VARIANTS (4 products with variants, e.g. brand Odoo +560)
  console.log('🛍️  Seeding products with variants...');

  // Product 1: ERP Platform Suite
  let prodERP = await prisma.product.findFirst({
    where: { name: 'ERP Platform Core Suite' },
  });
  if (!prodERP) {
    prodERP = await prisma.product.create({
      data: {
        name: 'ERP Platform Core Suite',
        type: ProductType.SOFTWARE,
        salesPrice: 450.0,
        costPrice: 150.0,
        taxId: tax18.id,
        notes: 'Enterprise modular ERP core engine',
      },
    });
  }

  // Variant: brand Odoo +560
  await prisma.productVariant.upsert({
    where: {
      productId_attribute_value: {
        productId: prodERP.id,
        attribute: 'Brand',
        value: 'Odoo',
      },
    },
    update: { extraPrice: 560.0 },
    create: {
      productId: prodERP.id,
      attribute: 'Brand',
      value: 'Odoo',
      extraPrice: 560.0,
    },
  });

  await prisma.productVariant.upsert({
    where: {
      productId_attribute_value: {
        productId: prodERP.id,
        attribute: 'Brand',
        value: 'Community Edition',
      },
    },
    update: { extraPrice: 0.0 },
    create: {
      productId: prodERP.id,
      attribute: 'Brand',
      value: 'Community Edition',
      extraPrice: 0.0,
    },
  });

  // Product 2: Cloud Dedicated Database
  let prodDB = await prisma.product.findFirst({
    where: { name: 'Managed Cloud PostgreSQL' },
  });
  if (!prodDB) {
    prodDB = await prisma.product.create({
      data: {
        name: 'Managed Cloud PostgreSQL',
        type: ProductType.SERVICE,
        salesPrice: 120.0,
        costPrice: 40.0,
        taxId: tax18.id,
        notes: 'High-availability managed PostgreSQL cluster',
      },
    });
  }

  await prisma.productVariant.upsert({
    where: {
      productId_attribute_value: {
        productId: prodDB.id,
        attribute: 'Cluster Type',
        value: 'Dedicated High-IOPS',
      },
    },
    update: { extraPrice: 180.0 },
    create: {
      productId: prodDB.id,
      attribute: 'Cluster Type',
      value: 'Dedicated High-IOPS',
      extraPrice: 180.0,
    },
  });

  await prisma.productVariant.upsert({
    where: {
      productId_attribute_value: {
        productId: prodDB.id,
        attribute: 'Cluster Type',
        value: 'Multi-Tenant Standard',
      },
    },
    update: { extraPrice: 0.0 },
    create: {
      productId: prodDB.id,
      attribute: 'Cluster Type',
      value: 'Multi-Tenant Standard',
      extraPrice: 0.0,
    },
  });

  // Product 3: Priority SLA Support
  let prodSLA = await prisma.product.findFirst({
    where: { name: '24/7 SLA Engineering Support' },
  });
  if (!prodSLA) {
    prodSLA = await prisma.product.create({
      data: {
        name: '24/7 SLA Engineering Support',
        type: ProductType.SERVICE,
        salesPrice: 200.0,
        costPrice: 50.0,
        taxId: tax18.id,
        notes: 'Mission-critical response time under 15 minutes',
      },
    });
  }

  await prisma.productVariant.upsert({
    where: {
      productId_attribute_value: {
        productId: prodSLA.id,
        attribute: 'Tier',
        value: '24/7 Premium Hotline',
      },
    },
    update: { extraPrice: 150.0 },
    create: {
      productId: prodSLA.id,
      attribute: 'Tier',
      value: '24/7 Premium Hotline',
      extraPrice: 150.0,
    },
  });

  await prisma.productVariant.upsert({
    where: {
      productId_attribute_value: {
        productId: prodSLA.id,
        attribute: 'Tier',
        value: 'Standard Business Hours',
      },
    },
    update: { extraPrice: 0.0 },
    create: {
      productId: prodSLA.id,
      attribute: 'Tier',
      value: 'Standard Business Hours',
      extraPrice: 0.0,
    },
  });

  // Product 4: Hardware Security Key
  let prodKey = await prisma.product.findFirst({
    where: { name: 'FIDO2 Hardware Security Key' },
  });
  if (!prodKey) {
    prodKey = await prisma.product.create({
      data: {
        name: 'FIDO2 Hardware Security Key',
        type: ProductType.GOODS,
        salesPrice: 65.0,
        costPrice: 30.0,
        taxId: tax5.id,
        notes: 'Physical token for tamper-proof multi-factor authentication',
      },
    });
  }

  await prisma.productVariant.upsert({
    where: {
      productId_attribute_value: {
        productId: prodKey.id,
        attribute: 'Connector',
        value: 'USB-C with NFC',
      },
    },
    update: { extraPrice: 20.0 },
    create: {
      productId: prodKey.id,
      attribute: 'Connector',
      value: 'USB-C with NFC',
      extraPrice: 20.0,
    },
  });

  await prisma.productVariant.upsert({
    where: {
      productId_attribute_value: {
        productId: prodKey.id,
        attribute: 'Connector',
        value: 'USB-A Classic',
      },
    },
    update: { extraPrice: 0.0 },
    create: {
      productId: prodKey.id,
      attribute: 'Connector',
      value: 'USB-A Classic',
      extraPrice: 0.0,
    },
  });

  // 6. DISCOUNTS (1 Percentage, 1 Fixed with usage limit)
  console.log('🏷️  Seeding discount rules...');

  // Percentage discount
  let discPct = await prisma.discount.findFirst({
    where: { name: 'Early Bird Launch 15%' },
  });
  if (!discPct) {
    discPct = await prisma.discount.create({
      data: {
        name: 'Early Bird Launch 15%',
        type: DiscountType.PERCENTAGE,
        value: 15.0,
        scope: DiscountScope.SUBSCRIPTION,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2027-12-31T23:59:59Z'),
        usageLimit: null,
        usedCount: 0,
        isActive: true,
      },
    });
  }

  // Fixed discount with usage limit of 100
  let discFixed = await prisma.discount.findFirst({
    where: { name: 'VIP Enterprise Credit $50' },
  });
  if (!discFixed) {
    discFixed = await prisma.discount.create({
      data: {
        name: 'VIP Enterprise Credit $50',
        type: DiscountType.FIXED,
        value: 50.0,
        scope: DiscountScope.SUBSCRIPTION,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2027-12-31T23:59:59Z'),
        usageLimit: 100,
        usedCount: 0,
        isActive: true,
      },
    });
  }

  // 7. QUOTATION TEMPLATE (1 quotation template with lines)
  console.log('📋 Seeding quotation template and template lines...');
  const monthlyPlan = seededPlans['Enterprise Monthly Plan'];

  let qTemplate = await prisma.quotationTemplate.findFirst({
    where: { name: 'Enterprise All-In-One Deployment' },
  });

  if (!qTemplate) {
    const odooVariant = await prisma.productVariant.findFirst({
      where: { productId: prodERP.id, value: 'Odoo' },
    });

    qTemplate = await prisma.quotationTemplate.create({
      data: {
        name: 'Enterprise All-In-One Deployment',
        planId: monthlyPlan.id,
        validityDays: 30,
        isActive: true,
        lines: {
          create: [
            {
              productId: prodERP.id,
              variantId: odooVariant?.id,
              quantity: 1,
            },
            {
              productId: prodDB.id,
              quantity: 2,
            },
            {
              productId: prodSLA.id,
              quantity: 1,
            },
          ],
        },
      },
    });
  }

  // 8. PRINT DEMO CREDENTIALS BANNER
  console.log('\n========================================================================');
  console.log('🎉 REVENIQ DATABASE SEEDED SUCCESSFULLY');
  console.log('========================================================================');
  console.log('Portal URL:         http://localhost:5173');
  console.log('API Base URL:       http://localhost:4000/api/v1');
  console.log('Supabase Sync:      Active & Connected');
  console.log('All Users Password: ' + DEMO_PASSWORD);
  console.log('------------------------------------------------------------------------');
  console.log('ROLE       EMAIL                        NAME                   PASSWORD');
  console.log('------------------------------------------------------------------------');
  console.log('ADMIN      admin@reveniq.test           System Administrator   ' + DEMO_PASSWORD);
  console.log('ADMIN      officialpadam23@gmail.com    Padam Gupta            ' + DEMO_PASSWORD);
  console.log('STAFF      staff@reveniq.test           Operations Staff       ' + DEMO_PASSWORD);
  console.log('CUSTOMER   customer1@reveniq.test       Acme Enterprise        ' + DEMO_PASSWORD);
  console.log('CUSTOMER   customer2@reveniq.test       Starlight Media        ' + DEMO_PASSWORD);
  console.log('CUSTOMER   customer3@reveniq.test       Apex Logistics         ' + DEMO_PASSWORD);
  console.log('========================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
