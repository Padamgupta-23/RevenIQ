import { Prisma, ProductType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { parsePagination, buildPaginationMeta, PaginationMeta } from '../../lib/pagination';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler';
import { toDecimal } from '../../lib/money';
import {
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
  CreateVariantInput,
  UpdateVariantInput,
} from './products.schemas';

export interface FormattedVariant {
  id: string;
  productId: string;
  attribute: string;
  value: string;
  extraPrice: string;
}

export interface FormattedProduct {
  id: string;
  name: string;
  type: ProductType;
  salesPrice: string;
  costPrice: string;
  notes: string | null;
  isActive: boolean;
  taxId: string | null;
  tax?: {
    id: string;
    name: string;
    rate: string;
  } | null;
  variants?: FormattedVariant[];
  createdAt: Date;
  updatedAt: Date;
}

export function formatVariant(v: {
  id: string;
  productId: string;
  attribute: string;
  value: string;
  extraPrice: Prisma.Decimal;
}): FormattedVariant {
  return {
    id: v.id,
    productId: v.productId,
    attribute: v.attribute,
    value: v.value,
    extraPrice: toDecimal(v.extraPrice).toFixed(2),
  };
}

export function formatProduct(p: {
  id: string;
  name: string;
  type: ProductType;
  salesPrice: Prisma.Decimal;
  costPrice: Prisma.Decimal;
  notes: string | null;
  isActive: boolean;
  taxId: string | null;
  tax?: {
    id: string;
    name: string;
    rate: Prisma.Decimal;
  } | null;
  variants?: Array<{
    id: string;
    productId: string;
    attribute: string;
    value: string;
    extraPrice: Prisma.Decimal;
  }>;
  createdAt: Date;
  updatedAt: Date;
}): FormattedProduct {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    salesPrice: toDecimal(p.salesPrice).toFixed(2),
    costPrice: toDecimal(p.costPrice).toFixed(2),
    notes: p.notes,
    isActive: p.isActive,
    taxId: p.taxId,
    tax: p.tax
      ? {
          id: p.tax.id,
          name: p.tax.name,
          rate: toDecimal(p.tax.rate).toFixed(2),
        }
      : null,
    variants: p.variants ? p.variants.map(formatVariant) : [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function listProducts(query: ListProductsQuery): Promise<{
  data: FormattedProduct[];
  meta: PaginationMeta;
}> {
  const pagination = parsePagination(query as Record<string, unknown>);
  const where: Prisma.ProductWhereInput = {};

  if (query.type) {
    where.type = query.type;
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  if (pagination.search) {
    where.name = { contains: pagination.search, mode: 'insensitive' };
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        tax: true,
        variants: true,
      },
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    data: products.map(formatProduct),
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

export async function getProductById(id: string): Promise<FormattedProduct> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      tax: true,
      variants: true,
    },
  });

  if (!product) {
    throw new NotFoundError('Product not found');
  }

  return formatProduct(product);
}

export async function createProduct(input: CreateProductInput): Promise<FormattedProduct> {
  if (input.taxId) {
    const tax = await prisma.tax.findUnique({ where: { id: input.taxId } });
    if (!tax) {
      throw new NotFoundError('Selected tax rate does not exist');
    }
  }

  const product = await prisma.product.create({
    data: {
      name: input.name.trim(),
      type: input.type,
      salesPrice: toDecimal(input.salesPrice),
      costPrice: toDecimal(input.costPrice),
      notes: input.notes?.trim() || null,
      taxId: input.taxId || null,
      isActive: input.isActive ?? true,
    },
    include: {
      tax: true,
      variants: true,
    },
  });

  return formatProduct(product);
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput
): Promise<FormattedProduct> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Product not found');
  }

  if (input.taxId) {
    const tax = await prisma.tax.findUnique({ where: { id: input.taxId } });
    if (!tax) {
      throw new NotFoundError('Selected tax rate does not exist');
    }
  }

  const dataToUpdate: Prisma.ProductUpdateInput = {};
  if (input.name !== undefined) dataToUpdate.name = input.name.trim();
  if (input.type !== undefined) dataToUpdate.type = input.type;
  if (input.salesPrice !== undefined) dataToUpdate.salesPrice = toDecimal(input.salesPrice);
  if (input.costPrice !== undefined) dataToUpdate.costPrice = toDecimal(input.costPrice);
  if (input.notes !== undefined) dataToUpdate.notes = input.notes?.trim() || null;
  if (input.taxId !== undefined) {
    dataToUpdate.tax = input.taxId ? { connect: { id: input.taxId } } : { disconnect: true };
  }
  if (input.isActive !== undefined) dataToUpdate.isActive = input.isActive;

  const updated = await prisma.product.update({
    where: { id },
    data: dataToUpdate,
    include: {
      tax: true,
      variants: true,
    },
  });

  return formatProduct(updated);
}

export async function deleteProduct(id: string): Promise<{ id: string; softDeleted: boolean }> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Product not found');
  }

  // Prevent deleting a product that is used in subscription lines (soft-deactivate instead)
  const [subLineCount, invLineCount] = await Promise.all([
    prisma.subscriptionLine.count({ where: { productId: id } }),
    prisma.invoiceLine.count({ where: { productId: id } }),
  ]);

  if (subLineCount > 0 || invLineCount > 0) {
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    return { id, softDeleted: true };
  }

  await prisma.product.delete({ where: { id } });
  return { id, softDeleted: false };
}

// ───────────── VARIANTS ─────────────

export async function listVariants(productId: string): Promise<FormattedVariant[]> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  const variants = await prisma.productVariant.findMany({
    where: { productId },
    orderBy: { attribute: 'asc' },
  });

  return variants.map(formatVariant);
}

export async function createVariant(
  productId: string,
  input: CreateVariantInput
): Promise<FormattedVariant> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  const existing = await prisma.productVariant.findUnique({
    where: {
      productId_attribute_value: {
        productId,
        attribute: input.attribute.trim(),
        value: input.value.trim(),
      },
    },
  });

  if (existing) {
    throw new ConflictError(
      `Variant with attribute "${input.attribute}" and value "${input.value}" already exists for this product`
    );
  }

  const variant = await prisma.productVariant.create({
    data: {
      productId,
      attribute: input.attribute.trim(),
      value: input.value.trim(),
      extraPrice: toDecimal(input.extraPrice),
    },
  });

  return formatVariant(variant);
}

export async function updateVariant(
  productId: string,
  variantId: string,
  input: UpdateVariantInput
): Promise<FormattedVariant> {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
  });

  if (!variant) {
    throw new NotFoundError('Product variant not found');
  }

  const dataToUpdate: Prisma.ProductVariantUpdateInput = {};
  if (input.attribute !== undefined) dataToUpdate.attribute = input.attribute.trim();
  if (input.value !== undefined) dataToUpdate.value = input.value.trim();
  if (input.extraPrice !== undefined) dataToUpdate.extraPrice = toDecimal(input.extraPrice);

  const updated = await prisma.productVariant.update({
    where: { id: variantId },
    data: dataToUpdate,
  });

  return formatVariant(updated);
}

export async function deleteVariant(productId: string, variantId: string) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
  });

  if (!variant) {
    throw new NotFoundError('Product variant not found');
  }

  // Check if used in subscription lines
  const subLineCount = await prisma.subscriptionLine.count({
    where: { variantId },
  });

  if (subLineCount > 0) {
    throw new ConflictError(
      'Cannot delete variant because it is referenced by active subscription lines'
    );
  }

  await prisma.productVariant.delete({ where: { id: variantId } });
  return { id: variantId, deleted: true };
}

