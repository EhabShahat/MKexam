-- Quick Fix: Grant permissions for admin management functions
-- Run this in Supabase SQL Editor to fix "Add New Admin" functionality

-- PART 1: Fix permissions grants
-- Admin list/management functions
grant execute on function public.admin_list_admins() to anon, authenticated, service_role;
grant execute on function public.admin_add_admin_by_email(text) to anon, authenticated, service_role;
grant execute on function public.admin_update_admin_email(uuid, text) to anon, authenticated, service_role;
grant execute on function public.admin_remove_admin(uuid) to anon, authenticated, service_role;

-- Admin creation and password functions
grant execute on function public.admin_create_user(text, text, text, boolean) to anon, authenticated, service_role;
grant execute on function public.admin_set_user_password(uuid, text) to anon, authenticated, service_role;

-- Auth login function
grant execute on function public.auth_login(text, text) to anon, authenticated, service_role;

-- PART 2: Fix "column reference 'user_id' is ambiguous" error
-- This happens when RLS is enabled on admin_users table
-- We need to explicitly qualify column names in ON CONFLICT clauses

-- Fix admin_create_user function
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
    INSERT INTO public.admin_users (user_id, email)
    VALUES (v_uid, v_email)
    ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email
    WHERE admin_users.user_id = EXCLUDED.user_id;
  END IF;

  RETURN QUERY SELECT v_uid, v_username, v_email, p_is_admin;
END;
$function$;
