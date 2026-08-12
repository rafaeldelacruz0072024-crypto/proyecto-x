-- ============================================================
-- DIAGNÓSTICO: ¿Por qué no se pagaron comisiones a joseprueba1-10?
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Ver los usuarios joseprueba y su cadena de referidos
SELECT 
  p.id,
  p.username,
  p.email,
  p.full_name,
  p.referred_by,
  p.status,
  p.wallet_balance,
  p.credit_balance,
  (SELECT username FROM profiles WHERE id = p.referred_by) AS sponsor_username
FROM profiles p
WHERE p.username ILIKE '%joseprueba%' 
   OR p.email ILIKE '%joseprueba%'
   OR p.full_name ILIKE '%joseprueba%'
ORDER BY p.username;

-- 2. Ver las inversiones de estos usuarios
SELECT 
  i.id AS investment_id,
  i.user_id,
  p.username,
  i.amount,
  i.status AS investment_status,
  i.is_referral_commission_paid,
  i.created_at
FROM investments i
JOIN profiles p ON p.id = i.user_id
WHERE p.username ILIKE '%joseprueba%' 
   OR p.email ILIKE '%joseprueba%'
   OR p.full_name ILIKE '%joseprueba%'
ORDER BY i.created_at;

-- 3. Ver comisiones generadas POR estas inversiones (como origen)
SELECT 
  t.id AS transaction_id,
  t.user_id AS comission_recipient,
  pr.username AS recipient_username,
  t.amount,
  t.type,
  t.status,
  t.description,
  t.reference_id AS investment_id,
  t.created_at
FROM transactions t
JOIN profiles pr ON pr.id = t.user_id
WHERE t.reference_id IN (
  SELECT i.id FROM investments i
  JOIN profiles p ON p.id = i.user_id
  WHERE p.username ILIKE '%joseprueba%' 
     OR p.email ILIKE '%joseprueba%'
     OR p.full_name ILIKE '%joseprueba%'
)
AND t.type = 'REFERRAL_COMMISSION'
ORDER BY t.created_at;

-- 4. Ver comisiones RECIBIDAS por estos usuarios
SELECT 
  t.id AS transaction_id,
  t.user_id,
  p.username,
  t.amount,
  t.type,
  t.description,
  t.created_at
FROM transactions t
JOIN profiles p ON p.id = t.user_id
WHERE (p.username ILIKE '%joseprueba%' 
   OR p.email ILIKE '%joseprueba%'
   OR p.full_name ILIKE '%joseprueba%')
AND t.type = 'REFERRAL_COMMISSION'
ORDER BY t.created_at;

-- 5. Verificar que residual_config existe en system_settings
SELECT residual_config FROM system_settings LIMIT 1;

-- 6. Verificar si el trigger existe
SELECT 
  trigger_name, 
  event_manipulation, 
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'investments'
AND trigger_name LIKE '%referral%';
