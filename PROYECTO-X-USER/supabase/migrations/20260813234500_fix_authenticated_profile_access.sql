-- Allow authenticated users to evaluate the admin branch used by the
-- profiles RLS policy. The function is SECURITY DEFINER and only returns a
-- boolean, while the policy still limits profile rows to the owner or admins.
revoke all on function private.is_admin(uuid) from public, anon;
grant execute on function private.is_admin(uuid) to authenticated;
