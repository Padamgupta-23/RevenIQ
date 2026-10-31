import bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import {
  parsePagination,
  buildPaginationMeta,
  PaginationMeta,
} from '../../lib/pagination';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../middleware/errorHandler';
import { syncUserToSupabase } from '../../lib/supabase';
import {
  ListUsersQuery,
  CreateStaffInput,
  UpdateUserInput,
} from './users.schemas';

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  phone: true,
  company: true,
  address: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface ListUsersResult {
  data: Array<{
    id: string;
    email: string;
    name: string;
    role: Role;
    isActive: boolean;
    phone: string | null;
    company: string | null;
    address: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  meta: PaginationMeta;
}

export async function listUsers(
  query: ListUsersQuery,
  currentUser: { id: string; role: Role; email: string }
): Promise<ListUsersResult> {
  // RBAC checks per AGENTS.md Section 7 & PROMPTS.md P1-2:
  // - CUSTOMER role cannot access the users directory at all (403)
  // - STAFF role can ONLY access customer list (?role=CUSTOMER)
  // - ADMIN role can view all or filter by any role
  if (currentUser.role === Role.CUSTOMER) {
    throw new ForbiddenError('Customers cannot access the users directory');
  }

  if (currentUser.role === Role.STAFF && query.role !== Role.CUSTOMER) {
    throw new ForbiddenError(
      'Staff members can only view the customer directory (?role=CUSTOMER)'
    );
  }

  const pagination = parsePagination(query as Record<string, unknown>);

  const where: Prisma.UserWhereInput = {};

  if (query.role) {
    where.role = query.role;
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  if (pagination.search) {
    where.OR = [
      { name: { contains: pagination.search, mode: 'insensitive' } },
      { email: { contains: pagination.search, mode: 'insensitive' } },
      { company: { contains: pagination.search, mode: 'insensitive' } },
    ];
  }

  // Sorting
  let orderBy: Prisma.UserOrderByWithRelationInput = { createdAt: 'desc' };
  if (pagination.sortField) {
    const validFields = ['name', 'email', 'createdAt', 'role', 'isActive'];
    if (validFields.includes(pagination.sortField)) {
      orderBy = { [pagination.sortField]: pagination.sortOrder || 'asc' };
    }
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: SAFE_USER_SELECT,
      skip: pagination.skip,
      take: pagination.take,
      orderBy,
    }),
  ]);

  return {
    data: users,
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

export async function createStaff(
  input: CreateStaffInput,
  currentUser: { id: string; role: Role }
) {
  // Only ADMIN can create staff or admin users
  if (currentUser.role !== Role.ADMIN) {
    throw new ForbiddenError('Only administrators can create staff or admin accounts');
  }

  const email = input.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: input.name.trim(),
      role: input.role,
      phone: input.phone?.trim() || null,
      company: input.company?.trim() || null,
      address: input.address?.trim() || null,
      isActive: true,
    },
    select: SAFE_USER_SELECT,
  });

  // Sync to Supabase in background
  syncUserToSupabase({
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone ?? undefined,
    company: user.company ?? undefined,
    address: user.address ?? undefined,
    password: input.password,
  }).catch((err) => {
    console.error('Failed to sync new staff to Supabase:', err);
  });

  return user;
}

export async function updateUser(
  targetId: string,
  input: UpdateUserInput,
  currentUser: { id: string; role: Role }
) {
  // Only ADMIN can update user accounts
  if (currentUser.role !== Role.ADMIN) {
    throw new ForbiddenError('Only administrators can update user accounts');
  }

  const existing = await prisma.user.findUnique({
    where: { id: targetId },
  });

  if (!existing) {
    throw new NotFoundError('User not found');
  }

  // Self-protection guard per AGENTS.md & PROMPTS.md:
  // Prevent an admin from deactivating or demoting themselves
  if (targetId === currentUser.id) {
    if (input.isActive === false) {
      throw new ConflictError('Admin cannot deactivate their own account');
    }
    if (input.role && input.role !== Role.ADMIN) {
      throw new ConflictError('Admin cannot demote their own account');
    }
  }

  const dataToUpdate: Prisma.UserUpdateInput = {};

  if (input.name !== undefined) dataToUpdate.name = input.name.trim();
  if (input.role !== undefined) dataToUpdate.role = input.role;
  if (input.isActive !== undefined) dataToUpdate.isActive = input.isActive;
  if (input.phone !== undefined) dataToUpdate.phone = input.phone?.trim() || null;
  if (input.company !== undefined) dataToUpdate.company = input.company?.trim() || null;
  if (input.address !== undefined) dataToUpdate.address = input.address?.trim() || null;

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: dataToUpdate,
    select: SAFE_USER_SELECT,
  });

  // Sync update to Supabase
  syncUserToSupabase({
    email: updated.email,
    name: updated.name,
    role: updated.role,
    phone: updated.phone ?? undefined,
    company: updated.company ?? undefined,
    address: updated.address ?? undefined,
  }).catch((err) => {
    console.error('Failed to sync updated user to Supabase:', err);
  });

  return updated;
}

export async function deactivateUser(
  targetId: string,
  currentUser: { id: string; role: Role }
) {
  return updateUser(targetId, { isActive: false }, currentUser);
}
