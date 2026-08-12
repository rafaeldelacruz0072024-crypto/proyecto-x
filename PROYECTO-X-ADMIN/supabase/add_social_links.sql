-- Add Instagram and YouTube link columns to system_config
ALTER TABLE public.system_config
  ADD COLUMN IF NOT EXISTS instagram_link TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS youtube_link TEXT DEFAULT '';
