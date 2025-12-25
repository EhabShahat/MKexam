-- ============================================================================
-- URGENT FIX: Run this in Supabase SQL Editor to fix admin creation error
-- Error: "column reference 'user_id' is ambiguous"
-- ============================================================================

-- Fix the admin_create_user function
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_username text,
  p_email text,
  p_password text,
  p_is_admin boolean DEFAULT false
)
RETURNS TABLE(user_id uuid, username text, email text, is_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_username text;
  v_email text;
  v_hash text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_username := nullif(trim(p_username), '');
  v_email := nullif(lower(trim(p_email)), '');

  IF v_username IS NULL AND v_email IS NULL THEN
    RAISE EXCEPTION 'missing_identifier';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'weak_password';
  END IF;

  -- enforce uniqueness manually to provide clearer errors
  IF v_username IS NOT NULL AND EXISTS(SELECT 1 FROM public.users u WHERE lower(u.username) = lower(v_username)) THEN
    RAISE EXCEPTION 'duplicate_username';
  END IF;
  IF v_email IS NOT NULL AND EXISTS(SELECT 1 FROM public.users u WHERE lower(u.email) = v_email) THEN
    RAISE EXCEPTION 'duplicate_email';
  END IF;

  v_hash := crypt(p_password, gen_salt('bf'));

  INSERT INTO public.users (username, email, password_hash)
  VALUES (v_username, v_email, v_hash)
  RETURNING id INTO v_uid;

  IF p_is_admin THEN
    -- Fixed: Explicitly check if admin exists before inserting
    IF EXISTS(SELECT 1 FROM public.admin_users WHERE admin_users.user_id = v_uid) THEN
      UPDATE public.admin_users 
      SET email = v_email 
      WHERE admin_users.user_id = v_uid;
    ELSE
      INSERT INTO public.admin_users (user_id, email)
      VALUES (v_uid, v_email);
    END IF;
  END IF;

  RETURN QUERY SELECT v_uid, v_username, v_email, p_is_admin;
END;
$function$;

-- Also fix admin_add_admin_by_email function
CREATE OR REPLACE FUNCTION public.admin_add_admin_by_email(p_email text)
 RETURNS TABLE(user_id uuid, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  -- Find or create a user by email in public.users
  SELECT u.id INTO v_uid
  FROM public.users u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_uid IS NULL THEN
    INSERT INTO public.users(email) VALUES (v_email)
    ON CONFLICT (email) DO NOTHING;
    SELECT u.id INTO v_uid FROM public.users u WHERE lower(u.email) = v_email LIMIT 1;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'user_create_failed';
  END IF;

  -- Fixed: Explicitly check if admin exists before inserting
  IF EXISTS(SELECT 1 FROM public.admin_users WHERE admin_users.user_id = v_uid) THEN
    UPDATE public.admin_users 
    SET email = v_email 
    WHERE admin_users.user_id = v_uid;
  ELSE
    INSERT INTO public.admin_users (user_id, email)
    VALUES (v_uid, v_email);
  END IF;

  RETURN QUERY SELECT v_uid, v_email;
END;
$function$;

-- ============================================================================
-- SUCCESS! Now try adding an admin from the UI again
-- ============================================================================
