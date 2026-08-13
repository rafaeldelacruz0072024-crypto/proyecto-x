-- MIGRATION: ADD TELEGRAM BOT SETTINGS
-- RUN THIS IN SUPABASE SQL EDITOR

ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT,
ADD COLUMN IF NOT EXISTS telegram_welcome_en TEXT,
ADD COLUMN IF NOT EXISTS telegram_welcome_es TEXT,
ADD COLUMN IF NOT EXISTS telegram_welcome_fr TEXT,
ADD COLUMN IF NOT EXISTS telegram_welcome_it TEXT,
ADD COLUMN IF NOT EXISTS telegram_welcome_ja TEXT,
ADD COLUMN IF NOT EXISTS telegram_welcome_pt TEXT,
ADD COLUMN IF NOT EXISTS telegram_welcome_zh TEXT;

-- OPTIONAL: Add standard default welcome messages if they don't exist
UPDATE public.system_settings 
SET 
  telegram_welcome_en = COALESCE(telegram_welcome_en, 'Welcome to PROYECTO X! Follow our channel and bot to earn rewards.'),
  telegram_welcome_es = COALESCE(telegram_welcome_es, '¡Bienvenido a PROYECTO X! Sigue nuestro canal y bot para ganar recompensas.'),
  telegram_welcome_pt = COALESCE(telegram_welcome_pt, 'Bem-vindo ao PROYECTO X! Siga nosso canal e bot para ganhar recompensas.'),
  telegram_welcome_zh = COALESCE(telegram_welcome_zh, '欢迎来到 PROYECTO X！关注我们的频道和机器人以获取奖励。')
WHERE telegram_welcome_en IS NULL;

COMMENT ON COLUMN public.system_settings.telegram_bot_token IS 'Telegram Bot Auth Token (Sensitive)';
