-- ADD PROYECTO X CARD FIELDS TO PROFILES TABLE
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS proyecto_x_card_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS proyecto_x_card_user TEXT;

-- COMMENT FOR DOCUMENTATION
COMMENT ON COLUMN profiles.proyecto_x_card_address IS 'User Proyecto X Card target address (BEP-20/Internal)';
COMMENT ON COLUMN profiles.proyecto_x_card_user IS 'Bancus username for card identification';
