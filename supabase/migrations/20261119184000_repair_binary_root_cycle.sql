-- The canonical root must not have a placement parent. Detaching it
-- breaks the registration cycle while preserving its descendants.
update public.profiles
set binary_parent_id = null,
    binary_side = null,
    binary_registered_at = null,
    updated_at = now()
where ref_code = 'GK-NOVA-ROOT'
  and binary_parent_id is not null;
