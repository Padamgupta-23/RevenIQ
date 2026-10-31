import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  listUsersQuerySchema,
  createStaffSchema,
  updateUserSchema,
} from './users.schemas';
import {
  listUsersHandler,
  createStaffHandler,
  updateUserHandler,
  deactivateUserHandler,
} from './users.controller';

export const usersRouter = Router();

// GET /api/v1/users - Admin can view all; Staff can view customers (?role=CUSTOMER); Customers get 403
usersRouter.get(
  '/',
  requireAuth,
  validate({ query: listUsersQuerySchema }),
  listUsersHandler
);

// POST /api/v1/users/staff - Admin only: create STAFF or ADMIN accounts
usersRouter.post(
  '/staff',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createStaffSchema }),
  createStaffHandler
);

// PATCH /api/v1/users/:id - Admin only: update user details
usersRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: updateUserSchema }),
  updateUserHandler
);

// POST /api/v1/users/:id/deactivate - Admin only: deactivate user account
usersRouter.post(
  '/:id/deactivate',
  requireAuth,
  requireRole('ADMIN'),
  deactivateUserHandler
);

