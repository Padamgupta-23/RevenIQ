import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://owqoorexzuvwziketnpg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cW9vcmV4enV2d3ppa2V0bnBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzQxNjMwOSwiZXhwIjoyMTA4OTkyMzA5fQ.IqioL9CoxEMB2aoScQw-uxGhvSUOLLevGKdQVnCNtIg';

export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export interface SupabaseUserData {
  email: string;
  password?: string;
  name: string;
  phone?: string;
  company?: string;
  address?: string;
  role: string;
}

/**
 * Saves or updates user credentials and profile details in Supabase Auth & user storage.
 */
export async function syncUserToSupabase(data: SupabaseUserData) {
  try {
    const email = data.email.toLowerCase().trim();

    // Check if user already exists in Supabase Auth
    const { data: usersList, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('[Supabase] Error listing users:', listError);
    }

    const existingUser = usersList?.users?.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (existingUser) {
      // Update existing user details in Supabase
      const updatePayload: {
        user_metadata: Record<string, unknown>;
        password?: string;
      } = {
        user_metadata: {
          name: data.name,
          phone: data.phone,
          company: data.company,
          address: data.address,
          role: data.role,
        },
      };

      if (data.password) {
        updatePayload.password = data.password;
      }

      const { data: updated, error: updateErr } =
        await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          updatePayload
        );

      if (updateErr) {
        console.error('[Supabase] Failed to update user:', updateErr);
      } else {
        console.log(`[Supabase] Successfully updated user: ${email} (ID: ${existingUser.id})`);
      }

      return updated?.user || existingUser;
    }

    // Create new user in Supabase
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          name: data.name,
          phone: data.phone,
          company: data.company,
          address: data.address,
          role: data.role,
        },
      });

    if (createErr) {
      console.error('[Supabase] Failed to create user:', createErr);
    } else {
      console.log(`[Supabase] Successfully saved user to Supabase: ${email} (ID: ${created.user?.id})`);
    }

    return created?.user;
  } catch (err) {
    console.error('[Supabase] Unexpected error syncing user:', err);
    return null;
  }
}

/**
 * Updates a user's password in Supabase.
 */
export async function updateSupabasePassword(email: string, newPassword: string) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
    const existing = usersList?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (existing) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        existing.id,
        {
          password: newPassword,
        }
      );
      if (error) {
        console.error('[Supabase] Error updating password:', error);
      } else {
        console.log(`[Supabase] Password updated in Supabase for: ${normalizedEmail}`);
      }
    }
  } catch (err) {
    console.error('[Supabase] Error in updateSupabasePassword:', err);
  }
}

export default supabaseAdmin;

