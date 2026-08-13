-- ADD NOVA DIGITAL CARD FIELDS TO PROFILES TABLE
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nova_digital_card_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nova_digital_card_user TEXT;

-- COMMENT FOR DOCUMENTATION
COMMENT ON COLUMN profiles.nova_digital_card_address IS 'User NOVA Digital Card target address (BEP-20/Internal)';
COMMENT ON COLUMN profiles.nova_digital_card_user IS 'Bancus username for card identification';
