import { Request, Response, NextFunction } from 'express';
import { ok, paginated } from '../../lib/response';
import * as usersService from './users.service';
import { ListUsersQuery, CreateStaffInput, UpdateUserInput } from './users.schemas';

export async function listUsersHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const query = req.query as unknown as ListUsersQuery;
    const result = await usersService.listUsers(query, req.user!);
    return paginated(res, result.data, result.meta);
  } catch (error) {
    next(error);
  }
}

export async function createStaffHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const input = req.body as CreateStaffInput;
    const user = await usersService.createStaff(input, req.user!);
    return ok(res, { user }, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateUserHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const targetId = req.params.id;
    const input = req.body as UpdateUserInput;
    const user = await usersService.updateUser(targetId, input, req.user!);
    return ok(res, { user });
  } catch (error) {
    next(error);
  }
}

export async function deactivateUserHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const targetId = req.params.id;
    const user = await usersService.deactivateUser(targetId, req.user!);
    return ok(res, { user, message: 'User account deactivated' });
  } catch (error) {
    next(error);
  }
}

