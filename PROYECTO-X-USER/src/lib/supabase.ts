import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase'; // We might not have this, but let's stick to the manual types for now as we did in Admin
// Actually, I'll just keep the client export and remove the duplicate types since they are now in src/types/index.ts
// But wait, the previous file had types exported. If other files import { Profile } from './supabase', this break them.
// So I should export them from here by re-exporting.

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export * from '../types';
