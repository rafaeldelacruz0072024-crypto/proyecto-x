-- Fix RLS policies for monthly_books table
-- Run this in Supabase SQL Editor

-- 1. Make sure the table exists with correct structure
CREATE TABLE IF NOT EXISTS public.monthly_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    author TEXT,
    month_label TEXT,
    month_order INTEGER,
    cover_url TEXT,
    pdf_url TEXT,
    audio_url TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.monthly_books ENABLE ROW LEVEL SECURITY;

-- 3. Drop any conflicting policies
DROP POLICY IF EXISTS "Public read monthly_books" ON public.monthly_books;
DROP POLICY IF EXISTS "Admin manage monthly_books" ON public.monthly_books;
DROP POLICY IF EXISTS "Admins can manage monthly_books" ON public.monthly_books;
DROP POLICY IF EXISTS "Users can view monthly_books" ON public.monthly_books;

-- 4. Allow all authenticated users to read
CREATE POLICY "Public read monthly_books"
    ON public.monthly_books FOR SELECT
    USING (true);

-- 5. Allow admin/sub-admin to INSERT, UPDATE, DELETE
CREATE POLICY "Admin manage monthly_books"
    ON public.monthly_books FOR ALL
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'sub-admin')
    )
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'sub-admin')
    );
