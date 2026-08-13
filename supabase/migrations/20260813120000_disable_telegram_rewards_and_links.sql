-- Telegram rewards and public links are retired from NOVA Digital.
-- Historical records remain untouched for audit purposes.
do $$
declare
  v_column_name text;
begin
  foreach v_column_name in array array[
    'telegram_reward_amount',
    'telegram_link_connect',
    'telegram_link_bot',
    'telegram_link_channel',
    'telegram_bot_token',
    'telegram_welcome_en',
    'telegram_welcome_es',
    'telegram_welcome_fr',
    'telegram_welcome_it',
    'telegram_welcome_ja',
    'telegram_welcome_pt',
    'telegram_welcome_zh'
  ] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'system_settings'
        and information_schema.columns.column_name = v_column_name
    ) then
      execute format('update public.system_settings set %I = null', v_column_name);
    end if;
  end loop;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'system_settings'
      and column_name = 'telegram_enabled'
  ) then
    update public.system_settings set telegram_enabled = false;
  end if;
end;
$$;

-- Any previous linked task records are retained, but cannot produce a new reward.
-- The public client function that credited balances has been removed in this commit.
