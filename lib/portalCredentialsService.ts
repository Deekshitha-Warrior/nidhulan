"use server";

import { getSupabaseClient, isDatabaseConfigured } from "@/lib/db";

export interface PortalCredentialItem {
  role: "admin" | "staff";
  login_id: string;
  password?: string;
  updated_at?: string;
}

export interface PortalCredentialsMap {
  admin: PortalCredentialItem;
  staff: PortalCredentialItem;
}

export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch portal credentials (admin & staff) by verifying the current admin password.
 * Zero-trust: verified directly in the database via the SECURITY DEFINER RPC.
 */
export async function fetchPortalCredentials(
  adminId: string,
  adminPassword: string
): Promise<ServiceResult<PortalCredentialsMap>> {
  if (!isDatabaseConfigured()) {
    return {
      success: false,
      error: "Supabase database is not configured. Please check your environment variables.",
    };
  }

  const cleanAdminId = adminId.trim() || "admin";
  const cleanPassword = adminPassword.trim();

  if (!cleanPassword) {
    return {
      success: false,
      error: "Admin password is required.",
    };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("portal_get_credentials", {
      p_admin_id: cleanAdminId,
      p_admin_password: cleanPassword,
    });

    if (error) {
      // Check for common error codes or missing function
      if (error.code === "PGRST202" || error.message?.includes("function portal_get_credentials")) {
        return {
          success: false,
          error: "Database function 'portal_get_credentials' is missing. Please run the SQL migration in Supabase.",
        };
      }
      return {
        success: false,
        error: error.message || "Failed to verify admin credentials.",
      };
    }

    if (!data || typeof data !== "object") {
      return {
        success: false,
        error: "Authentication failed. Incorrect admin ID or password.",
      };
    }

    return {
      success: true,
      data: data as PortalCredentialsMap,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "An unexpected server error occurred.";
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Update login ID and password for either Admin or Staff.
 * Re-authenticates caller with their verified admin password.
 */
export async function updatePortalCredential(
  adminId: string,
  adminPassword: string,
  targetRole: "admin" | "staff",
  newLoginId: string,
  newPassword: string
): Promise<ServiceResult<void>> {
  if (!isDatabaseConfigured()) {
    return {
      success: false,
      error: "Supabase database is not configured.",
    };
  }

  const cleanAdminId = adminId.trim() || "admin";
  const cleanAdminPassword = adminPassword.trim();
  const cleanNewLoginId = newLoginId.trim();
  const cleanNewPassword = newPassword.trim();

  if (!cleanAdminPassword) {
    return { success: false, error: "Current admin password is required for authentication." };
  }
  if (!cleanNewLoginId || cleanNewLoginId.length < 3) {
    return { success: false, error: "New Login ID must be at least 3 characters." };
  }
  if (!cleanNewPassword || cleanNewPassword.length < 6) {
    return { success: false, error: "New password must be at least 6 characters." };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("portal_update_credential", {
      p_admin_id: cleanAdminId,
      p_admin_password: cleanAdminPassword,
      p_target_role: targetRole,
      p_new_login_id: cleanNewLoginId,
      p_new_password: cleanNewPassword,
    });

    if (error) {
      return {
        success: false,
        error: error.message || `Failed to update ${targetRole} credentials.`,
      };
    }

    if (!data) {
      return {
        success: false,
        error: "Update rejected. Please ensure the admin password is correct and retry.",
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "An unexpected server error occurred.";
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Quick probe to get current admin login_id for display/pre-fill.
 * Safe query - does NOT return passwords or sensitive hashes.
 */
export async function getAdminPublicLoginId(): Promise<string> {
  if (!isDatabaseConfigured()) return "admin";
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("portal_logins")
      .select("login_id")
      .eq("role", "admin")
      .maybeSingle();

    return data?.login_id || "admin";
  } catch {
    return "admin";
  }
}
