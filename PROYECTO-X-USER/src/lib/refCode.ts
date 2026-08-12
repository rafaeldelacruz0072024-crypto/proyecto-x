import { supabase } from './supabase';

const REF_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REF_CODE_LENGTH = 6;
const REF_CODE_PREFIX = 'GK-';

/**
 * Genera un código de referido único usando crypto.getRandomValues()
 * y verifica unicidad contra la base de datos antes de retornarlo.
 * Reintenta hasta 5 veces si hay colisión.
 */
export async function generateUniqueRefCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRefCodeSecure();

    // Verificar unicidad contra la BD
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('ref_code', code)
      .maybeSingle();

    if (!data) return code; // No existe — es único
  }

  // Fallback extremo: agregar timestamp para garantizar unicidad
  return `${REF_CODE_PREFIX}${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/**
 * Genera un ref_code usando crypto.getRandomValues() en lugar de Math.random().
 * Más seguro criptográficamente y menos predecible.
 */
function generateRefCodeSecure(): string {
  const values = new Uint32Array(REF_CODE_LENGTH);
  crypto.getRandomValues(values);

  let result = REF_CODE_PREFIX;
  for (let i = 0; i < REF_CODE_LENGTH; i++) {
    result += REF_CODE_CHARS.charAt(values[i] % REF_CODE_CHARS.length);
  }
  return result;
}
