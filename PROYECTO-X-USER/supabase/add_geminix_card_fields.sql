-- ADD GEMINIX CARD FIELDS TO PROFILES TABLE
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS geminix_card_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS geminix_card_user TEXT;

-- COMMENT FOR DOCUMENTATION
COMMENT ON COLUMN profiles.geminix_card_address IS 'User Geminix Card target address (BEP-20/Internal)';
COMMENT ON COLUMN profiles.geminix_card_user IS 'Bancus username for card identification';
