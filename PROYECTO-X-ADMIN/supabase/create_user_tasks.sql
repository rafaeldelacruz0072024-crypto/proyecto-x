-- ==============================================================================================
-- TELEGRAM REWARDS & CHALLENGES: Tabla para seguimiento de tareas del Bot
-- Ejecutar en Supabase SQL Editor
-- ==============================================================================================

-- 1. Crear tabla de Tareas de Usuarios
CREATE TABLE IF NOT EXISTS public.user_tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL, -- Ej: 'telegram_connect', 'telegram_bot', 'telegram_channel'
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, COMPLETED, REJECTED
    metadata JSONB DEFAULT '{}'::JSONB, -- Para guardar datos extras (ej: telegram_username)
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, task_id) -- Un usuario no puede tener la misma tarea duplicada
);

-- 2. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_user_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_tasks_updated_at ON public.user_tasks;
CREATE TRIGGER trg_user_tasks_updated_at
BEFORE UPDATE ON public.user_tasks
FOR EACH ROW
EXECUTE FUNCTION update_user_tasks_updated_at();

-- 3. Habilitar Seguridad de Filas (Row Level Security - RLS)
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad (RLS Policies)
-- Los usuarios solo pueden ver sus propias tareas
DROP POLICY IF EXISTS "Users can view own tasks" ON public.user_tasks;
CREATE POLICY "Users can view own tasks" 
ON public.user_tasks FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Los usuarios pueden actualizar el status de sus propias tareas (ej: al dar clic en 'Completar')
DROP POLICY IF EXISTS "Users can update own tasks" ON public.user_tasks;
CREATE POLICY "Users can update own tasks" 
ON public.user_tasks FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can modify own tasks" ON public.user_tasks;
CREATE POLICY "Users can modify own tasks" 
ON public.user_tasks FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Los administradores (service_role) y el Bot pueden saltar RLS y hacer de todo.
