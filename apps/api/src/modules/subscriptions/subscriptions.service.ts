import { Prisma, SubscriptionStatus, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { parsePagination, buildPaginationMeta, PaginationMeta } from '../../lib/pagination.js';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from '../../middleware/errorHandler.js';
import { toDecimal, round, add, multiply } from '../../lib/money.js';
import { nextNumber } from '../../lib/numbering.js';
import { addPeriod } from '../../lib/billingPeriod.js';
import {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  CreateFromTemplateInput,
  ListSubscriptionsQuery,
  SubscriptionLineInput,
} from './subscriptions.schemas.js';

export interface FormattedSubscriptionLine {
  id: string;
  subscriptionId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: string;
  taxId: string | null;
  amount: string;
  product?: {
    id: string;
    name: string;
    type: string;
    salesPrice: string;
  };
  variant?: {
    id: string;
    attribute: string;
    value: string;
    extraPrice: string;
  } | null;
  tax?: {
    id: string;
    name: string;
    rate: string;
  } | null;
}

export interface FormattedSubscription {
  id: string;
  number: string;
  customerId: string;
  planId: string;
  templateId: string | null;
  discountId: string | null;
  status: SubscriptionStatus;
  startDate: string;
  expiryDate: string;
  nextBillingDate: string | null;
  paymentTermDays: number;
  quotationValidUntil: string | null;
  notes: string | null;
  createdById: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    name: string;
    email: string;
    company: string | null;
  };
  plan?: {
    id: string;
    name: string;
    price: string;
    billingPeriod: string;
    minQuantity: number;
    autoClose: boolean;
    closable: boolean;
    pausable: boolean;
    renewable: boolean;
  };
  discount?: {
    id: string;
    name: string;
    type: string;
    value: string;
  } | null;
  lines: FormattedSubscriptionLine[];
}

export function formatSubscription(sub: any): FormattedSubscription {
  return {
    id: sub.id,
    number: sub.number,
    customerId: sub.customerId,
    planId: sub.planId,
    templateId: sub.templateId,
    discountId: sub.discountId,
    status: sub.status,
    startDate: sub.startDate instanceof Date ? sub.startDate.toISOString() : sub.startDate,
    expiryDate: sub.expiryDate instanceof Date ? sub.expiryDate.toISOString() : sub.expiryDate,
    nextBillingDate:
      sub.nextBillingDate instanceof Date
        ? sub.nextBillingDate.toISOString()
        : sub.nextBillingDate || null,
    paymentTermDays: sub.paymentTermDays,
    quotationValidUntil:
      sub.quotationValidUntil instanceof Date
        ? sub.quotationValidUntil.toISOString()
        : sub.quotationValidUntil || null,
    notes: sub.notes,
    createdById: sub.createdById,
    closedAt: sub.closedAt instanceof Date ? sub.closedAt.toISOString() : sub.closedAt || null,
    createdAt: sub.createdAt instanceof Date ? sub.createdAt.toISOString() : sub.createdAt,
    updatedAt: sub.updatedAt instanceof Date ? sub.updatedAt.toISOString() : sub.updatedAt,
    customer: sub.customer
      ? {
          id: sub.customer.id,
          name: sub.customer.name,
          email: sub.customer.email,
          company: sub.customer.company,
        }
      : undefined,
    plan: sub.plan
      ? {
          id: sub.plan.id,
          name: sub.plan.name,
          price: toDecimal(sub.plan.price).toFixed(2),
          billingPeriod: sub.plan.billingPeriod,
          minQuantity: sub.plan.minQuantity,
          autoClose: sub.plan.autoClose,
          closable: sub.plan.closable,
          pausable: sub.plan.pausable,
          renewable: sub.plan.renewable,
        }
      : undefined,
    discount: sub.discount
      ? {
          id: sub.discount.id,
          name: sub.discount.name,
          type: sub.discount.type,
          value: toDecimal(sub.discount.value).toFixed(2),
        }
      : null,
    lines: (sub.lines || []).map((line: any) => ({
      id: line.id,
      subscriptionId: line.subscriptionId,
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: toDecimal(line.unitPrice).toFixed(2),
      taxId: line.taxId,
      amount: toDecimal(line.amount).toFixed(2),
      product: line.product
        ? {
            id: line.product.id,
            name: line.product.name,
            type: line.product.type,
            salesPrice: toDecimal(line.product.salesPrice).toFixed(2),
          }
        : undefined,
      variant: line.variant
        ? {
            id: line.variant.id,
            attribute: line.variant.attribute,
            value: line.variant.value,
            extraPrice: toDecimal(line.variant.extraPrice).toFixed(2),
          }
        : null,
      tax: line.tax
        ? {
            id: line.tax.id,
            name: line.tax.name,
            rate: toDecimal(line.tax.rate).toFixed(2),
          }
        : null,
    })),
  };
}

/**
 * Validates plan availability on a given start date.
 */
export function validatePlanAvailability(plan: {
  isActive: boolean;
  startDate: Date;
  endDate: Date | null;
}, startDate: Date) {
  if (!plan.isActive) {
    throw new ValidationError('Selected plan is inactive');
  }
  const start = new Date(startDate).getTime();
  const planStart = new Date(plan.startDate).getTime();
  if (start < planStart) {
    throw new ValidationError('Plan is not available on the specified start date (before plan start)');
  }
  if (plan.endDate) {
    const planEnd = new Date(plan.endDate).getTime();
    if (start > planEnd) {
      throw new ValidationError('Plan is not available on the specified start date (plan has ended)');
    }
  }
}

/**
 * Calculates line amounts, unit prices, and validates minimum quantities against the plan.
 */
async function processSubscriptionLines(
  lines: SubscriptionLineInput[],
  minQuantity: number,
  tx: Prisma.TransactionClient = prisma
) {
  const processedLines: Array<{
    productId: string;
    variantId: string | null;
    quantity: number;
    unitPrice: Prisma.Decimal;
    taxId: string | null;
    amount: Prisma.Decimal;
  }> = [];

  for (const line of lines) {
    if (line.quantity < minQuantity) {
      throw new ValidationError(
        `Line quantity (${line.quantity}) must be at least plan minimum quantity (${minQuantity})`
      );
    }

    const product = await tx.product.findUnique({
      where: { id: line.productId },
      include: { variants: true },
    });

    if (!product || !product.isActive) {
      throw new ValidationError(`Product with ID ${line.productId} not found or inactive`);
    }

    let extraPrice = new Prisma.Decimal(0);
    if (line.variantId) {
      const variant = product.variants.find((v) => v.id === line.variantId);
      if (!variant) {
        throw new ValidationError(
          `Variant ${line.variantId} does not belong to product ${product.name}`
        );
      }
      extraPrice = toDecimal(variant.extraPrice);
    }

    const unitPrice = round(add(product.salesPrice, extraPrice));
    const amount = round(multiply(line.quantity, unitPrice));
    const taxId = line.taxId ?? product.taxId;

    processedLines.push({
      productId: line.productId,
      variantId: line.variantId || null,
      quantity: line.quantity,
      unitPrice,
      taxId: taxId || null,
      amount,
    });
  }

  return processedLines;
}

export async function createSubscription(
  input: CreateSubscriptionInput,
  createdById: string
): Promise<FormattedSubscription> {
  const customer = await prisma.user.findUnique({
    where: { id: input.customerId },
  });
  if (!customer) {
    throw new NotFoundError('Customer user not found');
  }

  const plan = await prisma.plan.findUnique({
    where: { id: input.planId },
  });
  if (!plan) {
    throw new NotFoundError('Plan not found');
  }

  validatePlanAvailability(plan, input.startDate);

  return prisma.$transaction(async (tx) => {
    const processedLines = await processSubscriptionLines(
      input.lines,
      plan.minQuantity,
      tx
    );

    const number = await nextNumber('subscription', tx);

    const subscription = await tx.subscription.create({
      data: {
        number,
        customerId: input.customerId,
        planId: input.planId,
        discountId: input.discountId || null,
        status: SubscriptionStatus.DRAFT,
        startDate: input.startDate,
        expiryDate: input.expiryDate,
        paymentTermDays: input.paymentTermDays,
        quotationValidUntil: input.quotationValidUntil || null,
        notes: input.notes || null,
        createdById,
        lines: {
          create: processedLines,
        },
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
    });

    return formatSubscription(subscription);
  });
}

export async function createSubscriptionFromTemplate(
  templateId: string,
  input: CreateFromTemplateInput,
  createdById: string
): Promise<FormattedSubscription> {
  const template = await prisma.quotationTemplate.findUnique({
    where: { id: templateId },
    include: {
      plan: true,
      lines: {
        include: {
          product: true,
          variant: true,
        },
      },
    },
  });

  if (!template || !template.isActive) {
    throw new NotFoundError('Quotation template not found or inactive');
  }

  if (!template.plan) {
    throw new NotFoundError('Template has no linked plan');
  }

  validatePlanAvailability(template.plan, input.startDate);

  const customer = await prisma.user.findUnique({
    where: { id: input.customerId },
  });
  if (!customer) {
    throw new NotFoundError('Customer user not found');
  }

  const templateLineInputs: SubscriptionLineInput[] = template.lines.map((l) => ({
    productId: l.productId,
    variantId: l.variantId,
    quantity: l.quantity,
    taxId: l.product?.taxId || null,
  }));

  const quotationValidUntil = new Date(Date.now() + template.validityDays * 86400000);

  return prisma.$transaction(async (tx) => {
    const processedLines = await processSubscriptionLines(
      templateLineInputs,
      template.plan.minQuantity,
      tx
    );

    const number = await nextNumber('subscription', tx);

    const subscription = await tx.subscription.create({
      data: {
        number,
        customerId: input.customerId,
        planId: template.planId,
        templateId: template.id,
        discountId: input.discountId || null,
        status: SubscriptionStatus.QUOTATION,
        startDate: input.startDate,
        expiryDate: input.expiryDate,
        paymentTermDays: input.paymentTermDays,
        quotationValidUntil,
        notes: input.notes || null,
        createdById,
        lines: {
          create: processedLines,
        },
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
    });

    return formatSubscription(subscription);
  });
}

export async function getSubscriptionById(
  id: string,
  currentUser: { id: string; role: string }
): Promise<FormattedSubscription> {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
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
  });

  if (!subscription) {
    throw new NotFoundError('Subscription not found');
  }

  // Customer data isolation
  if (currentUser.role === 'CUSTOMER' && subscription.customerId !== currentUser.id) {
    throw new NotFoundError('Subscription not found');
  }

  return formatSubscription(subscription);
}

export async function updateSubscription(
  id: string,
  input: UpdateSubscriptionInput,
  currentUser: { id: string; role: string }
): Promise<FormattedSubscription> {
  const existing = await prisma.subscription.findUnique({
    where: { id },
    include: { plan: true },
  });

  if (!existing) {
    throw new NotFoundError('Subscription not found');
  }

  if (currentUser.role === 'CUSTOMER') {
    throw new ForbiddenError('Customers cannot edit subscriptions directly');
  }

  if (input.lines) {
    if (
      existing.status !== SubscriptionStatus.DRAFT &&
      existing.status !== SubscriptionStatus.QUOTATION
    ) {
      throw new ConflictError(
        `Subscription lines can only be edited in DRAFT or QUOTATION status (current: ${existing.status})`
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    if (input.lines) {
      await tx.subscriptionLine.deleteMany({
        where: { subscriptionId: id },
      });

      const processed = await processSubscriptionLines(
        input.lines,
        existing.plan.minQuantity,
        tx
      );

      await tx.subscriptionLine.createMany({
        data: processed.map((p) => ({
          ...p,
          subscriptionId: id,
        })),
      });
    }

    const updated = await tx.subscription.update({
      where: { id },
      data: {
        startDate: input.startDate,
        expiryDate: input.expiryDate,
        paymentTermDays: input.paymentTermDays,
        quotationValidUntil: input.quotationValidUntil,
        notes: input.notes,
        discountId: input.discountId,
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
    });

    return formatSubscription(updated);
  });
}

export type TransitionAction =
  | 'quote'
  | 'confirm'
  | 'activate'
  | 'pause'
  | 'resume'
  | 'close'
  | 'renew';

export async function transitionSubscription(
  id: string,
  action: TransitionAction,
  currentUser: { id: string; role: string }
): Promise<FormattedSubscription> {
  const sub = await prisma.subscription.findUnique({
    where: { id },
    include: { plan: true },
  });

  if (!sub) {
    throw new NotFoundError('Subscription not found');
  }

  // Customer data isolation
  if (currentUser.role === 'CUSTOMER') {
    if (sub.customerId !== currentUser.id) {
      throw new NotFoundError('Subscription not found');
    }
    // Customer can only pause, resume, close, or renew if plan allows
    if (!['pause', 'resume', 'close', 'renew'].includes(action)) {
      throw new ForbiddenError(`Customers are not permitted to execute action "${action}"`);
    }
  }

  const now = new Date();

  switch (action) {
    case 'quote': {
      if (sub.status !== SubscriptionStatus.DRAFT) {
        throw new ConflictError(
          `Cannot create quotation for subscription in ${sub.status} status (must be DRAFT)`
        );
      }
      const quotationValidUntil =
        sub.quotationValidUntil || new Date(now.getTime() + 30 * 86400000);

      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: SubscriptionStatus.QUOTATION,
          quotationValidUntil,
        },
        include: {
          customer: true,
          plan: true,
          discount: true,
          lines: { include: { product: true, variant: true, tax: true } },
        },
      });
      return formatSubscription(updated);
    }

    case 'confirm': {
      if (
        sub.status !== SubscriptionStatus.QUOTATION &&
        sub.status !== SubscriptionStatus.DRAFT
      ) {
        throw new ConflictError(
          `Cannot confirm subscription in ${sub.status} status (must be QUOTATION or DRAFT)`
        );
      }

      if (
        sub.status === SubscriptionStatus.QUOTATION &&
        sub.quotationValidUntil &&
        sub.quotationValidUntil < now
      ) {
        throw new ConflictError(
          `Quotation has expired on ${sub.quotationValidUntil.toISOString()} and cannot be confirmed`
        );
      }

      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: SubscriptionStatus.CONFIRMED,
        },
        include: {
          customer: true,
          plan: true,
          discount: true,
          lines: { include: { product: true, variant: true, tax: true } },
        },
      });
      return formatSubscription(updated);
    }

    case 'activate': {
      if (sub.status !== SubscriptionStatus.CONFIRMED) {
        throw new ConflictError(
          `Cannot activate subscription in ${sub.status} status (must be CONFIRMED)`
        );
      }

      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          nextBillingDate: sub.startDate,
        },
        include: {
          customer: true,
          plan: true,
          discount: true,
          lines: { include: { product: true, variant: true, tax: true } },
        },
      });
      return formatSubscription(updated);
    }

    case 'pause': {
      if (sub.status !== SubscriptionStatus.ACTIVE) {
        throw new ConflictError(
          `Cannot pause subscription in ${sub.status} status (must be ACTIVE)`
        );
      }

      if (!sub.plan.pausable) {
        throw new ConflictError('Plan policy does not permit pausing subscriptions');
      }

      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: SubscriptionStatus.PAUSED,
        },
        include: {
          customer: true,
          plan: true,
          discount: true,
          lines: { include: { product: true, variant: true, tax: true } },
        },
      });
      return formatSubscription(updated);
    }

    case 'resume': {
      if (sub.status !== SubscriptionStatus.PAUSED) {
        throw new ConflictError(
          `Cannot resume subscription in ${sub.status} status (must be PAUSED)`
        );
      }

      if (!sub.plan.pausable) {
        throw new ConflictError('Plan policy does not permit pausing/resuming subscriptions');
      }

      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: SubscriptionStatus.ACTIVE,
        },
        include: {
          customer: true,
          plan: true,
          discount: true,
          lines: { include: { product: true, variant: true, tax: true } },
        },
      });
      return formatSubscription(updated);
    }

    case 'close': {
      if (sub.status === SubscriptionStatus.CLOSED) {
        throw new ConflictError('Subscription is already CLOSED');
      }

      // Early close check
      const isEarlyClose =
        (sub.status === SubscriptionStatus.ACTIVE ||
          sub.status === SubscriptionStatus.PAUSED) &&
        now < sub.expiryDate;

      if (isEarlyClose && !sub.plan.closable) {
        throw new ConflictError('Plan policy does not permit early closure before expiry date');
      }

      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: SubscriptionStatus.CLOSED,
          closedAt: now,
          nextBillingDate: null,
        },
        include: {
          customer: true,
          plan: true,
          discount: true,
          lines: { include: { product: true, variant: true, tax: true } },
        },
      });
      return formatSubscription(updated);
    }

    case 'renew': {
      if (!sub.plan.renewable) {
        throw new ConflictError('Plan policy does not permit subscription renewal');
      }

      if (
        sub.status === SubscriptionStatus.DRAFT ||
        sub.status === SubscriptionStatus.QUOTATION
      ) {
        throw new ConflictError('Cannot renew an unconfirmed subscription');
      }

      const newExpiry = addPeriod(sub.expiryDate, sub.plan.billingPeriod);

      const updateData: Prisma.SubscriptionUpdateInput = {
        expiryDate: newExpiry,
      };

      // If subscription was closed, reopen to ACTIVE
      if (sub.status === SubscriptionStatus.CLOSED) {
        updateData.status = SubscriptionStatus.ACTIVE;
        updateData.closedAt = null;
        updateData.nextBillingDate = sub.expiryDate < now ? now : sub.expiryDate;
      }

      const updated = await prisma.subscription.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          plan: true,
          discount: true,
          lines: { include: { product: true, variant: true, tax: true } },
        },
      });
      return formatSubscription(updated);
    }

    default:
      throw new ValidationError(`Unknown transition action "${action}"`);
  }
}

export async function listSubscriptions(
  query: ListSubscriptionsQuery,
  currentUser: { id: string; role: string }
): Promise<{
  data: FormattedSubscription[];
  meta: PaginationMeta;
}> {
  const pagination = parsePagination(query as Record<string, unknown>);
  const where: Prisma.SubscriptionWhereInput = {};

  if (currentUser.role === 'CUSTOMER') {
    where.customerId = currentUser.id;
  } else if (query.customerId) {
    where.customerId = query.customerId;
  }

  if (query.planId) {
    where.planId = query.planId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (pagination.search) {
    where.OR = [
      { number: { contains: pagination.search, mode: 'insensitive' } },
      { customer: { name: { contains: pagination.search, mode: 'insensitive' } } },
      { customer: { email: { contains: pagination.search, mode: 'insensitive' } } },
    ];
  }

  const [total, subscriptions] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
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
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    data: subscriptions.map(formatSubscription),
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

