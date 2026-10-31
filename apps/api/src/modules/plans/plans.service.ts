import { Prisma, BillingPeriod } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { parsePagination, buildPaginationMeta, PaginationMeta } from '../../lib/pagination';
import { NotFoundError, ConflictError } from '../../middleware/errorHandler';
import { toDecimal } from '../../lib/money';
import { CreatePlanInput, UpdatePlanInput, ListPlansQuery } from './plans.schemas';

export interface FormattedPlan {
  id: string;
  name: string;
  price: string;
  billingPeriod: BillingPeriod;
  minQuantity: number;
  startDate: Date;
  endDate: Date | null;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function formatPlan(plan: {
  id: string;
  name: string;
  price: Prisma.Decimal;
  billingPeriod: BillingPeriod;
  minQuantity: number;
  startDate: Date;
  endDate: Date | null;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): FormattedPlan {
  return {
    id: plan.id,
    name: plan.name,
    price: toDecimal(plan.price).toFixed(2),
    billingPeriod: plan.billingPeriod,
    minQuantity: plan.minQuantity,
    startDate: plan.startDate,
    endDate: plan.endDate,
    autoClose: plan.autoClose,
    closable: plan.closable,
    pausable: plan.pausable,
    renewable: plan.renewable,
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

export async function listPlans(query: ListPlansQuery): Promise<{
  data: FormattedPlan[];
  meta: PaginationMeta;
}> {
  const pagination = parsePagination(query as Record<string, unknown>);
  const where: Prisma.PlanWhereInput = {};

  if (query.billingPeriod) {
    where.billingPeriod = query.billingPeriod;
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  if (pagination.search) {
    where.name = { contains: pagination.search, mode: 'insensitive' };
  }

  const [total, plans] = await Promise.all([
    prisma.plan.count({ where }),
    prisma.plan.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    data: plans.map(formatPlan),
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

export async function listAvailablePlans(): Promise<FormattedPlan[]> {
  const now = new Date();

  const plans = await prisma.plan.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: { price: 'asc' },
  });

  return plans.map(formatPlan);
}

export async function getPlanById(id: string): Promise<FormattedPlan> {
  const plan = await prisma.plan.findUnique({
    where: { id },
  });

  if (!plan) {
    throw new NotFoundError('Plan not found');
  }

  return formatPlan(plan);
}

export async function createPlan(input: CreatePlanInput): Promise<FormattedPlan> {
  const existing = await prisma.plan.findFirst({
    where: { name: { equals: input.name.trim(), mode: 'insensitive' } },
  });

  if (existing) {
    throw new ConflictError('A plan with this name already exists');
  }

  const plan = await prisma.plan.create({
    data: {
      name: input.name.trim(),
      price: toDecimal(input.price),
      billingPeriod: input.billingPeriod,
      minQuantity: input.minQuantity,
      startDate: input.startDate,
      endDate: input.endDate || null,
      autoClose: input.autoClose,
      closable: input.closable,
      pausable: input.pausable,
      renewable: input.renewable,
      isActive: input.isActive,
    },
  });

  return formatPlan(plan);
}

export async function updatePlan(id: string, input: UpdatePlanInput): Promise<FormattedPlan> {
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Plan not found');
  }

  // Cross-validate dates if only one is updated
  const startDate = input.startDate || existing.startDate;
  const endDate = input.endDate !== undefined ? input.endDate : existing.endDate;

  if (endDate && endDate.getTime() <= startDate.getTime()) {
    throw new ConflictError('End date must be strictly after start date');
  }

  const dataToUpdate: Prisma.PlanUpdateInput = {};
  if (input.name !== undefined) dataToUpdate.name = input.name.trim();
  if (input.price !== undefined) dataToUpdate.price = toDecimal(input.price);
  if (input.billingPeriod !== undefined) dataToUpdate.billingPeriod = input.billingPeriod;
  if (input.minQuantity !== undefined) dataToUpdate.minQuantity = input.minQuantity;
  if (input.startDate !== undefined) dataToUpdate.startDate = input.startDate;
  if (input.endDate !== undefined) dataToUpdate.endDate = input.endDate;
  if (input.autoClose !== undefined) dataToUpdate.autoClose = input.autoClose;
  if (input.closable !== undefined) dataToUpdate.closable = input.closable;
  if (input.pausable !== undefined) dataToUpdate.pausable = input.pausable;
  if (input.renewable !== undefined) dataToUpdate.renewable = input.renewable;
  if (input.isActive !== undefined) dataToUpdate.isActive = input.isActive;

  const updated = await prisma.plan.update({
    where: { id },
    data: dataToUpdate,
  });

  return formatPlan(updated);
}

export async function deletePlan(id: string): Promise<{ id: string; softDeleted: boolean }> {
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Plan not found');
  }

  // Check if used in subscriptions or templates
  const [subCount, templateCount] = await Promise.all([
    prisma.subscription.count({ where: { planId: id } }),
    prisma.quotationTemplate.count({ where: { planId: id } }),
  ]);

  if (subCount > 0 || templateCount > 0) {
    await prisma.plan.update({
      where: { id },
      data: { isActive: false },
    });
    return { id, softDeleted: true };
  }

  await prisma.plan.delete({ where: { id } });
  return { id, softDeleted: false };
}

