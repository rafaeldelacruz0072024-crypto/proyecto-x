-- The public registration flow accepts the existing ROOT referral code.
-- GK-NOVA-ROOT includes a second hyphen, so the former ^GK-[A-Z0-9]{4,30}$
-- expression rejected a valid active sponsor before the signup could begin.
create or replace function public.validate_sponsor_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as 'select exists (
  select 1
  from public.profiles
  where ref_code = upper(trim(coalesce(p_code, '''')))
    and upper(trim(coalesce(p_code, ''''))) ~ ''^GK-[A-Z0-9-]{4,30}$''
    and status = ''active''
);';

revoke all on function public.validate_sponsor_code(text) from public, authenticated;
grant execute on function public.validate_sponsor_code(text) to anon, authenticated;
