-- MIGRATION: ADD MISSING TELEGRAM LINKS SETTINGS
-- RUN THIS IN SUPABASE SQL EDITOR

ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS telegram_reward_amount NUMERIC DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS telegram_link_connect TEXT DEFAULT 'https://t.me/GeminixOfficial',
ADD COLUMN IF NOT EXISTS telegram_link_bot TEXT DEFAULT 'https://t.me/geminix_bot',
ADD COLUMN IF NOT EXISTS telegram_link_channel TEXT DEFAULT 'https://t.me/GeminixNews',
ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN DEFAULT true;

-- Ensure default values for existing rows
UPDATE public.system_settings 
SET 
  telegram_reward_amount = COALESCE(telegram_reward_amount, 5.00),
  telegram_link_connect = COALESCE(telegram_link_connect, 'https://t.me/GeminixOfficial'),
  telegram_link_bot = COALESCE(telegram_link_bot, 'https://t.me/geminix_bot'),
  telegram_link_channel = COALESCE(telegram_link_channel, 'https://t.me/GeminixNews'),
  telegram_enabled = COALESCE(telegram_enabled, true)
WHERE id IS NOT NULL;
