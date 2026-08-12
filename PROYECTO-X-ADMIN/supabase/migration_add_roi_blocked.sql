-- Add roi_blocked column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS roi_blocked BOOLEAN DEFAULT false;
