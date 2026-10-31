import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { signToken } from '../../middleware/auth.js';
import {
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from '../../middleware/errorHandler.js';
import { sendPasswordResetEmail } from '../../lib/mailer.js';
import { syncUserToSupabase, updateSupabasePassword } from '../../lib/supabase.js';
import {
  SignupInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './auth.schemas.js';

export async function signup(input: SignupInput) {
  const email = input.email.toLowerCase().trim();

  // Check if user already exists in database
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    throw new ConflictError('Email already registered');
  }

  // Hash password with bcrypt cost 10
  const passwordHash = await bcrypt.hash(input.password, 10);

  // Always create role CUSTOMER on public signup
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: input.name,
      phone: input.phone,
      company: input.company,
      address: input.address,
      role: Role.CUSTOMER,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      company: true,
      address: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  // Save all user details into Supabase
  try {
    if (process.env.NODE_ENV !== 'test') {
      await syncUserToSupabase({
        email: user.email,
        password: input.password,
        name: user.name,
        phone: user.phone || undefined,
        company: user.company || undefined,
        address: user.address || undefined,
        role: user.role,
      });
    }
  } catch (err) {
    console.error('[AuthService] Supabase sync notice:', err);
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  return { user, token };
}

export async function login(input: LoginInput) {
  const email = input.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new ForbiddenError('User account is deactivated');
  }

  const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  const safeUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    company: user.company,
    address: user.address,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };

  return { user: safeUser, token };
}

export async function forgotPassword(input: ForgotPasswordInput) {
  const email = input.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always respond with the same generic message whether or not the email exists
  const genericResponse = {
    message:
      'If that email address is in our database, we will send you an email to reset your password.',
  };

  if (!user || !user.isActive) {
    return genericResponse;
  }

  // Generate random token and store SHA-256 hash with 1 hour expiry
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  try {
    await sendPasswordResetEmail(user.email, rawToken);
  } catch (err) {
    console.error('[AuthService] Failed to send password reset email:', err);
  }

  return genericResponse;
}

export async function resetPassword(input: ResetPasswordInput) {
  const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    !resetToken ||
    resetToken.usedAt !== null ||
    resetToken.expiresAt < new Date() ||
    !resetToken.user.isActive
  ) {
    throw new ValidationError('Invalid or expired reset token');
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(input.password, 10);

  // Invalidate this token and all other unused tokens for this user in same transaction
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: newPasswordHash },
    });

    // Mark current token as used
    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    // Invalidate other unused tokens
    await tx.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        usedAt: null,
        id: { not: resetToken.id },
      },
      data: {
        usedAt: new Date(),
      },
    });
  });

  // Sync new password to Supabase
  try {
    if (process.env.NODE_ENV !== 'test') {
      await updateSupabasePassword(resetToken.user.email, input.password);
    }
  } catch (err) {
    console.error('[AuthService] Supabase password update notice:', err);
  }

  return { message: 'Password has been reset successfully. You can now log in.' };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      company: true,
      address: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or account is deactivated');
  }

  return user;
}
