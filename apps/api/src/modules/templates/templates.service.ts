import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { parsePagination, buildPaginationMeta, PaginationMeta } from '../../lib/pagination';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler';
import { toDecimal } from '../../lib/money';
import {
  CreateTemplateInput,
  UpdateTemplateInput,
  ListTemplatesQuery,
} from './templates.schemas';

export interface FormattedTemplateLine {
  id: string;
  templateId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
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
}

export interface FormattedTemplate {
  id: string;
  name: string;
  planId: string;
  validityDays: number;
  isActive: boolean;
  plan?: {
    id: string;
    name: string;
    price: string;
    billingPeriod: string;
  };
  lines: FormattedTemplateLine[];
  createdAt: Date;
}

export function formatTemplate(t: any): FormattedTemplate {
  return {
    id: t.id,
    name: t.name,
    planId: t.planId,
    validityDays: t.validityDays,
    isActive: t.isActive,
    plan: t.plan
      ? {
          id: t.plan.id,
          name: t.plan.name,
          price: toDecimal(t.plan.price).toFixed(2),
          billingPeriod: t.plan.billingPeriod,
        }
      : undefined,
    lines: (t.lines || []).map((l: any) => ({
      id: l.id,
      templateId: l.templateId,
      productId: l.productId,
      variantId: l.variantId,
      quantity: l.quantity,
      product: l.product
        ? {
            id: l.product.id,
            name: l.product.name,
            type: l.product.type,
            salesPrice: toDecimal(l.product.salesPrice).toFixed(2),
          }
        : undefined,
      variant: l.variant
        ? {
            id: l.variant.id,
            attribute: l.variant.attribute,
            value: l.variant.value,
            extraPrice: toDecimal(l.variant.extraPrice).toFixed(2),
          }
        : null,
    })),
    createdAt: t.createdAt,
  };
}

export async function listTemplates(query: ListTemplatesQuery): Promise<{
  data: FormattedTemplate[];
  meta: PaginationMeta;
}> {
  const pagination = parsePagination(query as Record<string, unknown>);
  const where: Prisma.QuotationTemplateWhereInput = {};

  if (query.planId) where.planId = query.planId;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (pagination.search) {
    where.name = { contains: pagination.search, mode: 'insensitive' };
  }

  const [total, templates] = await Promise.all([
    prisma.quotationTemplate.count({ where }),
    prisma.quotationTemplate.findMany({
      where,
      include: {
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    data: templates.map(formatTemplate),
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

export async function getTemplateById(id: string): Promise<FormattedTemplate> {
  const template = await prisma.quotationTemplate.findUnique({
    where: { id },
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

  if (!template) {
    throw new NotFoundError('Quotation template not found');
  }

  return formatTemplate(template);
}

export async function createTemplate(
  input: CreateTemplateInput
): Promise<FormattedTemplate> {
  const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
  if (!plan) {
    throw new NotFoundError('Associated plan not found');
  }

  const existing = await prisma.quotationTemplate.findFirst({
    where: { name: { equals: input.name.trim(), mode: 'insensitive' } },
  });

  if (existing) {
    throw new ConflictError('A quotation template with this name already exists');
  }

  const template = await prisma.quotationTemplate.create({
    data: {
      name: input.name.trim(),
      planId: input.planId,
      validityDays: input.validityDays,
      isActive: input.isActive ?? true,
      lines: {
        create: input.lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId || null,
          quantity: line.quantity,
        })),
      },
    },
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

  return formatTemplate(template);
}

export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput
): Promise<FormattedTemplate> {
  const existing = await prisma.quotationTemplate.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Quotation template not found');
  }

  if (input.planId) {
    const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
    if (!plan) {
      throw new NotFoundError('Associated plan not found');
    }
  }

  const dataToUpdate: Prisma.QuotationTemplateUpdateInput = {};
  if (input.name !== undefined) dataToUpdate.name = input.name.trim();
  if (input.planId !== undefined) dataToUpdate.plan = { connect: { id: input.planId } };
  if (input.validityDays !== undefined) dataToUpdate.validityDays = input.validityDays;
  if (input.isActive !== undefined) dataToUpdate.isActive = input.isActive;

  if (input.lines !== undefined) {
    // Delete existing lines and re-create
    await prisma.quotationTemplateLine.deleteMany({ where: { templateId: id } });
    await prisma.quotationTemplateLine.createMany({
      data: input.lines.map((line) => ({
        templateId: id,
        productId: line.productId,
        variantId: line.variantId || null,
        quantity: line.quantity,
      })),
    });
  }

  const updated = await prisma.quotationTemplate.update({
    where: { id },
    data: dataToUpdate,
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

  return formatTemplate(updated);
}

export async function deleteTemplate(
  id: string
): Promise<{ id: string; deleted: boolean }> {
  const existing = await prisma.quotationTemplate.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Quotation template not found');
  }

  // Check if used in subscriptions
  const subCount = await prisma.subscription.count({ where: { templateId: id } });
  if (subCount > 0) {
    await prisma.quotationTemplate.update({
      where: { id },
      data: { isActive: false },
    });
    return { id, deleted: false };
  }

  await prisma.quotationTemplate.delete({ where: { id } });
  return { id, deleted: true };
}

