import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { parsePagination, buildPaginationMeta, PaginationMeta } from '../../lib/pagination';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler';
import { toDecimal } from '../../lib/money';
import { CreateTaxInput, UpdateTaxInput, ListTaxesQuery } from './taxes.schemas';

export interface FormattedTax {
  id: string;
  name: string;
  rate: string;
  isActive: boolean;
  createdAt: Date;
}

export function formatTax(tax: {
  id: string;
  name: string;
  rate: Prisma.Decimal;
  isActive: boolean;
  createdAt: Date;
}): FormattedTax {
  return {
    id: tax.id,
    name: tax.name,
    rate: toDecimal(tax.rate).toFixed(2),
    isActive: tax.isActive,
    createdAt: tax.createdAt,
  };
}

export async function listTaxes(query: ListTaxesQuery): Promise<{
  data: FormattedTax[];
  meta: PaginationMeta;
}> {
  const pagination = parsePagination(query as Record<string, unknown>);
  const where: Prisma.TaxWhereInput = {};

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  if (pagination.search) {
    where.name = { contains: pagination.search, mode: 'insensitive' };
  }

  const [total, taxes] = await Promise.all([
    prisma.tax.count({ where }),
    prisma.tax.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    data: taxes.map(formatTax),
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

export async function getTaxById(id: string): Promise<FormattedTax> {
  const tax = await prisma.tax.findUnique({
    where: { id },
  });

  if (!tax) {
    throw new NotFoundError('Tax rate not found');
  }

  return formatTax(tax);
}

export async function createTax(input: CreateTaxInput): Promise<FormattedTax> {
  const existing = await prisma.tax.findFirst({
    where: { name: { equals: input.name.trim(), mode: 'insensitive' } },
  });

  if (existing) {
    throw new ConflictError('A tax with this name already exists');
  }

  const tax = await prisma.tax.create({
    data: {
      name: input.name.trim(),
      rate: toDecimal(input.rate),
      isActive: input.isActive ?? true,
    },
  });

  return formatTax(tax);
}

export async function updateTax(id: string, input: UpdateTaxInput): Promise<FormattedTax> {
  const existing = await prisma.tax.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Tax rate not found');
  }

  if (input.name && input.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
    const duplicate = await prisma.tax.findFirst({
      where: {
        name: { equals: input.name.trim(), mode: 'insensitive' },
        id: { not: id },
      },
    });
    if (duplicate) {
      throw new ConflictError('A tax with this name already exists');
    }
  }

  const dataToUpdate: Prisma.TaxUpdateInput = {};
  if (input.name !== undefined) dataToUpdate.name = input.name.trim();
  if (input.rate !== undefined) dataToUpdate.rate = toDecimal(input.rate);
  if (input.isActive !== undefined) dataToUpdate.isActive = input.isActive;

  const updated = await prisma.tax.update({
    where: { id },
    data: dataToUpdate,
  });

  return formatTax(updated);
}

export async function deleteTax(id: string): Promise<{ id: string; softDeleted: boolean }> {
  const existing = await prisma.tax.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Tax rate not found');
  }

  // Check if used by any product or subscription line
  const [productCount, subLineCount] = await Promise.all([
    prisma.product.count({ where: { taxId: id } }),
    prisma.subscriptionLine.count({ where: { taxId: id } }),
  ]);

  if (productCount > 0 || subLineCount > 0) {
    // Soft-deactivate to preserve audit trail and relational integrity
    await prisma.tax.update({
      where: { id },
      data: { isActive: false },
    });
    return { id, softDeleted: true };
  }

  await prisma.tax.delete({ where: { id } });
  return { id, softDeleted: false };
}

