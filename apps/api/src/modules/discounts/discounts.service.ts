import { Prisma, DiscountType, DiscountScope } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { parsePagination, buildPaginationMeta, PaginationMeta } from '../../lib/pagination';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler';
import { toDecimal } from '../../lib/money';
import {
  CreateDiscountInput,
  UpdateDiscountInput,
  ListDiscountsQuery,
} from './discounts.schemas';

export interface FormattedDiscount {
  id: string;
  name: string;
  type: DiscountType;
  value: string;
  scope: DiscountScope;
  minPurchase: string | null;
  minQuantity: number | null;
  startDate: Date;
  endDate: Date;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  productIds: string[];
  products?: Array<{
    id: string;
    name: string;
    salesPrice: string;
  }>;
  createdAt: Date;
}

export function formatDiscount(d: {
  id: string;
  name: string;
  type: DiscountType;
  value: Prisma.Decimal;
  scope: DiscountScope;
  minPurchase: Prisma.Decimal | null;
  minQuantity: number | null;
  startDate: Date;
  endDate: Date;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  products?: Array<{
    product: {
      id: string;
      name: string;
      salesPrice: Prisma.Decimal;
    };
  }>;
  createdAt: Date;
}): FormattedDiscount {
  const productList = d.products ? d.products.map((p) => p.product) : [];
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    value: toDecimal(d.value).toFixed(2),
    scope: d.scope,
    minPurchase: d.minPurchase ? toDecimal(d.minPurchase).toFixed(2) : null,
    minQuantity: d.minQuantity,
    startDate: d.startDate,
    endDate: d.endDate,
    usageLimit: d.usageLimit,
    usedCount: d.usedCount,
    isActive: d.isActive,
    productIds: productList.map((p) => p.id),
    products: productList.map((p) => ({
      id: p.id,
      name: p.name,
      salesPrice: toDecimal(p.salesPrice).toFixed(2),
    })),
    createdAt: d.createdAt,
  };
}

export async function listDiscounts(query: ListDiscountsQuery): Promise<{
  data: FormattedDiscount[];
  meta: PaginationMeta;
}> {
  const pagination = parsePagination(query as Record<string, unknown>);
  const where: Prisma.DiscountWhereInput = {};

  if (query.type) where.type = query.type;
  if (query.scope) where.scope = query.scope;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (pagination.search) {
    where.name = { contains: pagination.search, mode: 'insensitive' };
  }

  const [total, discounts] = await Promise.all([
    prisma.discount.count({ where }),
    prisma.discount.findMany({
      where,
      include: {
        products: {
          include: {
            product: true,
          },
        },
      },
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    data: discounts.map(formatDiscount),
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

export async function getDiscountById(id: string): Promise<FormattedDiscount> {
  const discount = await prisma.discount.findUnique({
    where: { id },
    include: {
      products: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!discount) {
    throw new NotFoundError('Discount not found');
  }

  return formatDiscount(discount);
}

export async function createDiscount(input: CreateDiscountInput): Promise<FormattedDiscount> {
  const existing = await prisma.discount.findFirst({
    where: { name: { equals: input.name.trim(), mode: 'insensitive' } },
  });

  if (existing) {
    throw new ConflictError('A discount rule with this name already exists');
  }

  const discount = await prisma.discount.create({
    data: {
      name: input.name.trim(),
      type: input.type,
      value: toDecimal(input.value),
      scope: input.scope,
      minPurchase: input.minPurchase ? toDecimal(input.minPurchase) : null,
      minQuantity: input.minQuantity || null,
      startDate: input.startDate,
      endDate: input.endDate,
      usageLimit: input.usageLimit || null,
      usedCount: 0,
      isActive: input.isActive ?? true,
      products:
        input.scope === DiscountScope.PRODUCT && input.productIds && input.productIds.length > 0
          ? {
              create: input.productIds.map((productId) => ({
                product: { connect: { id: productId } },
              })),
            }
          : undefined,
    },
    include: {
      products: {
        include: {
          product: true,
        },
      },
    },
  });

  return formatDiscount(discount);
}

export async function updateDiscount(
  id: string,
  input: UpdateDiscountInput
): Promise<FormattedDiscount> {
  const existing = await prisma.discount.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Discount not found');
  }

  // Cross-validate dates if one is updated
  const startDate = input.startDate || existing.startDate;
  const endDate = input.endDate || existing.endDate;
  if (endDate.getTime() <= startDate.getTime()) {
    throw new ConflictError('End date must be strictly after start date');
  }

  const dataToUpdate: Prisma.DiscountUpdateInput = {};
  if (input.name !== undefined) dataToUpdate.name = input.name.trim();
  if (input.type !== undefined) dataToUpdate.type = input.type;
  if (input.value !== undefined) dataToUpdate.value = toDecimal(input.value);
  if (input.scope !== undefined) dataToUpdate.scope = input.scope;
  if (input.minPurchase !== undefined) {
    dataToUpdate.minPurchase = input.minPurchase ? toDecimal(input.minPurchase) : null;
  }
  if (input.minQuantity !== undefined) dataToUpdate.minQuantity = input.minQuantity;
  if (input.startDate !== undefined) dataToUpdate.startDate = input.startDate;
  if (input.endDate !== undefined) dataToUpdate.endDate = input.endDate;
  if (input.usageLimit !== undefined) dataToUpdate.usageLimit = input.usageLimit;
  if (input.isActive !== undefined) dataToUpdate.isActive = input.isActive;

  if (input.productIds !== undefined) {
    // Replace linked products
    await prisma.discountProduct.deleteMany({ where: { discountId: id } });
    if (input.productIds.length > 0) {
      await prisma.discountProduct.createMany({
        data: input.productIds.map((productId) => ({
          discountId: id,
          productId,
        })),
      });
    }
  }

  const updated = await prisma.discount.update({
    where: { id },
    data: dataToUpdate,
    include: {
      products: {
        include: {
          product: true,
        },
      },
    },
  });

  return formatDiscount(updated);
}

export async function deleteDiscount(id: string): Promise<{ id: string; deleted: boolean }> {
  const existing = await prisma.discount.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Discount not found');
  }

  // Check if used in subscriptions or invoices
  const [subCount, invoiceUsesCount] = await Promise.all([
    prisma.subscription.count({ where: { discountId: id } }),
    prisma.invoiceDiscount.count({ where: { discountId: id } }),
  ]);

  if (subCount > 0 || invoiceUsesCount > 0) {
    await prisma.discount.update({
      where: { id },
      data: { isActive: false },
    });
    return { id, deleted: false };
  }

  await prisma.discount.delete({ where: { id } });
  return { id, deleted: true };
}

