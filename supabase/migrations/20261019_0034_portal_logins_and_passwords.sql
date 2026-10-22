-- =====================================================================
--  MIGRATION: 20261019_0034_portal_logins_and_passwords.sql
--  PURPOSE: Zero-Trust Portal Credentials & Passwords Management
--  TABLES: portal_logins, portal_login_attempts
--  FUNCTIONS: portal_login, portal_get_credentials, portal_update_credential
-- =====================================================================

-- 1. Ensure pgcrypto extension is enabled for blowfish bcrypt hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Table: portal_logins
CREATE TABLE IF NOT EXISTS public.portal_logins (
  role          TEXT PRIMARY KEY CHECK (role IN ('admin', 'staff')),
  login_id      TEXT NOT NULL UNIQUE,
  password      TEXT,
  password_hash TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Table: portal_login_attempts (Brute-force lockout protection)
CREATE TABLE IF NOT EXISTS public.portal_login_attempts (
  login_id      TEXT PRIMARY KEY,
  failed_count  INTEGER NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.portal_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_login_attempts ENABLE ROW LEVEL SECURITY;

-- Zero public table policies: Direct browser SELECT/INSERT/UPDATE/DELETE are blocked.
-- All interactions must pass through the SECURITY DEFINER functions below.

-- 5. Seed default credentials if not already present
INSERT INTO public.portal_logins (role, login_id, password, password_hash)
VALUES
  ('admin', 'admin', 'admin123', crypt('admin123', gen_salt('bf'))),
  ('staff', 'staff', 'staff123', crypt('staff123', gen_salt('bf')))
ON CONFLICT (role) DO NOTHING;

-- 6. RPC: portal_login
-- Authenticates a user against bcrypt hash or password column with brute-force lockout.
CREATE OR REPLACE FUNCTION public.portal_login(p_id TEXT, p_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lookup_id TEXT;
  v_role TEXT;
  v_actual_login_id TEXT;
  v_stored_hash TEXT;
  v_stored_plain TEXT;
  v_locked_until TIMESTAMPTZ;
  v_matched BOOLEAN := FALSE;
BEGIN
  IF p_id IS NULL OR trim(p_id) = '' OR p_password IS NULL THEN
    RETURN NULL;
  END IF;

  v_lookup_id := lower(trim(p_id));

  -- Match either by login_id (case-insensitive) or by role
  SELECT role, login_id, password_hash, password
  INTO v_role, v_actual_login_id, v_stored_hash, v_stored_plain
  FROM public.portal_logins
  WHERE lower(login_id) = v_lookup_id OR role = v_lookup_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Check brute-force lockout for this login_id
  SELECT locked_until
  INTO v_locked_until
  FROM public.portal_login_attempts
  WHERE lower(login_id) = lower(v_actual_login_id);

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    -- Account is temporarily locked out
    RETURN NULL;
  END IF;

  -- Match against bcrypt hash
  IF v_stored_hash IS NOT NULL AND v_stored_hash <> '' THEN
    IF v_stored_hash = crypt(p_password, v_stored_hash) THEN
      v_matched := TRUE;
    END IF;
  END IF;

  -- Fallback to clear password string match
  IF NOT v_matched AND v_stored_plain IS NOT NULL AND v_stored_plain <> '' THEN
    IF v_stored_plain = p_password THEN
      v_matched := TRUE;
    END IF;
  END IF;

  IF v_matched THEN
    -- Reset failure counter on successful authentication
    DELETE FROM public.portal_login_attempts
    WHERE lower(login_id) = lower(v_actual_login_id);

    RETURN v_role;
  ELSE
    -- Increment failure counter and lock for 15 minutes after 5 strikes
    INSERT INTO public.portal_login_attempts (login_id, failed_count, locked_until)
    VALUES (v_actual_login_id, 1, NULL)
    ON CONFLICT (login_id) DO UPDATE SET
      failed_count = public.portal_login_attempts.failed_count + 1,
      locked_until = CASE
        WHEN public.portal_login_attempts.failed_count + 1 >= 5 THEN now() + interval '15 minutes'
        ELSE NULL
      END;

    RETURN NULL;
  END IF;
END;
$$;

-- 7. RPC: portal_get_credentials
-- Returns both admin and staff login IDs and clear passwords to an authenticated admin.
CREATE OR REPLACE FUNCTION public.portal_get_credentials(p_admin_id TEXT, p_admin_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_result JSONB;
BEGIN
  -- Authenticate caller as admin
  v_caller_role := public.portal_login(p_admin_id, p_admin_password);

  IF v_caller_role IS NULL OR v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Authentication failed or account locked. Please check your admin password.';
  END IF;

  -- Aggregate credentials into JSON object
  SELECT jsonb_object_agg(
    role,
    jsonb_build_object(
      'role', role,
      'login_id', login_id,
      'password', COALESCE(password, ''),
      'updated_at', updated_at
    )
  )
  INTO v_result
  FROM public.portal_logins;

  RETURN v_result;
END;
$$;

-- 8. RPC: portal_update_credential
-- Allows an authenticated admin to change login IDs and passwords for admin or staff.
CREATE OR REPLACE FUNCTION public.portal_update_credential(
  p_admin_id TEXT,
  p_admin_password TEXT,
  p_target_role TEXT,
  p_new_login_id TEXT,
  p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_clean_login_id TEXT;
  v_old_login_id TEXT;
BEGIN
  -- Re-authenticate caller as admin
  v_caller_role := public.portal_login(p_admin_id, p_admin_password);

  IF v_caller_role IS NULL OR v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Authentication failed or account locked. Please check your admin password.';
  END IF;

  -- Validate target role
  IF p_target_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Invalid target role. Must be either admin or staff.';
  END IF;

  -- Validate string length constraints
  v_clean_login_id := trim(p_new_login_id);
  IF length(v_clean_login_id) < 3 THEN
    RAISE EXCEPTION 'Login ID must be at least 3 characters long.';
  END IF;

  IF length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long.';
  END IF;

  -- Ensure new login_id is not already taken by another role
  IF EXISTS (
    SELECT 1 FROM public.portal_logins
    WHERE lower(login_id) = lower(v_clean_login_id) AND role <> p_target_role
  ) THEN
    RAISE EXCEPTION 'Login ID "%" is already taken by another role.', v_clean_login_id;
  END IF;

  -- Get old login_id to clear lockout history
  SELECT login_id INTO v_old_login_id FROM public.portal_logins WHERE role = p_target_role;

  -- Update target row with new login ID, password, and fresh bcrypt hash
  UPDATE public.portal_logins
  SET
    login_id = v_clean_login_id,
    password = p_new_password,
    password_hash = crypt(p_new_password, gen_salt('bf')),
    updated_at = now()
  WHERE role = p_target_role;

  -- Reset lockout records for both old and new login_ids
  IF v_old_login_id IS NOT NULL THEN
    DELETE FROM public.portal_login_attempts WHERE lower(login_id) = lower(v_old_login_id);
  END IF;
  DELETE FROM public.portal_login_attempts WHERE lower(login_id) = lower(v_clean_login_id);

  RETURN TRUE;
END;
$$;

-- 9. Permissions & Execution Grants
GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;
GRANT ALL ON TABLE public.portal_logins, public.portal_login_attempts TO service_role;
GRANT EXECUTE ON FUNCTION public.portal_login(TEXT, TEXT) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_credentials(TEXT, TEXT) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_update_credential(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role, anon, authenticated;
