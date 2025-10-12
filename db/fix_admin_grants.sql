-- Quick Fix: Grant permissions for admin management functions
-- Run this in Supabase SQL Editor to fix "Add New Admin" functionality

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
