-- ============================================================
-- MERCADOS DE DEMOSTRACIÓN — Ejecutar en Supabase SQL Editor
-- Crea 3 mercados de ejemplo para demostración
-- ============================================================

INSERT INTO public.prediction_markets (
    title, description, category, image_url,
    options, total_pool, status, house_fee_pct,
    closes_at, resolves_at
) VALUES

-- MERCADO 1: CRYPTO
(
    '¿Bitcoin superará los $100,000 antes del 30 de abril de 2026?',
    'El precio de BTC debe cerrar por encima de $100,000 en cualquier exchange principal (Binance, Coinbase) antes del 30 de abril de 2026.',
    'CRYPTO',
    'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
    '[
        {"id":"A","label":"Sí, lo superará","pool":680},
        {"id":"B","label":"No lo superará","pool":320}
    ]'::jsonb,
    1000.00,
    'OPEN',
    2.0,
    NOW() + INTERVAL '44 days',
    NOW() + INTERVAL '47 days'
),

-- MERCADO 2: CRYPTO
(
    '¿Ethereum alcanzará $5,000 en 2026?',
    'ETH debe alcanzar o superar los $5,000 en precio spot en cualquier momento durante el año 2026.',
    'CRYPTO',
    'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    '[
        {"id":"A","label":"Sí, alcanzará $5K","pool":420},
        {"id":"B","label":"No llegará a $5K","pool":580}
    ]'::jsonb,
    1000.00,
    'OPEN',
    2.0,
    NOW() + INTERVAL '90 days',
    NOW() + INTERVAL '95 days'
),

-- MERCADO 3: ECONOMIA
(
    '¿La FED recortará tasas de interés en la reunión de mayo 2026?',
    'La Reserva Federal de EE.UU. anuncia un recorte de al menos 0.25% en su reunión de política monetaria de mayo 2026.',
    'ECONOMY',
    NULL,
    '[
        {"id":"A","label":"Sí, recortará","pool":350},
        {"id":"B","label":"No recortará","pool":450},
        {"id":"C","label":"Subirá tasas","pool":200}
    ]'::jsonb,
    1000.00,
    'OPEN',
    2.0,
    NOW() + INTERVAL '55 days',
    NOW() + INTERVAL '60 days'
);

-- Verificar que se crearon correctamente
SELECT id, title, category, total_pool, status,
       jsonb_array_length(options) AS num_options,
       closes_at::DATE AS closes_date
FROM public.prediction_markets
ORDER BY created_at DESC
LIMIT 5;
