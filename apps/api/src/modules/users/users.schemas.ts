import { z } from 'zod';
import { emailSchema, passwordSchema } from '../auth/auth.schemas';

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sort: z.string().optional(),
  role: z.enum(['ADMIN', 'STAFF', 'CUSTOMER']).optional(),
  isActive: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean())
    .optional(),
});

export const createStaffSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  role: z.enum(['STAFF', 'ADMIN'], {
    errorMap: () => ({ message: 'Role must be either STAFF or ADMIN' }),
  }),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim().optional(),
  role: z.enum(['ADMIN', 'STAFF', 'CUSTOMER']).optional(),
  isActive: z.boolean().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

