
// ⚠️ DEFAULTS de respaldo: Estos valores se usan SOLO si system_settings no está disponible.
// La fuente de verdad es SIEMPRE la tabla system_settings en Supabase.
export const MIN_INVESTMENT = 10.00;    // Sincronizado con min_investment en system_settings
export const MAX_INVESTMENT = 10000.00; // Sincronizado con max_investment en system_settings
export const WITHDRAWAL_FEE = 0.00;     // 0% — respaldo de withdrawal_fee en system_settings
export const MIN_WITHDRAWAL = 10.00;    // Sincronizado con min_withdrawal en system_settings

export const COMMISSION_LEVELS = [
  { start: 1, end: 1, percentage: 0.10 },
  { start: 2, end: 2, percentage: 0.05 },
  { start: 3, end: 3, percentage: 0.03 },
  { start: 4, end: 10, percentage: 0.02 },
  { start: 11, end: 20, percentage: 0.01 },
  { start: 21, end: 30, percentage: 0.008 },
];
