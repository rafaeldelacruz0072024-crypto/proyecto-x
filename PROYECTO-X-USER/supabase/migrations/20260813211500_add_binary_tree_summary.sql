-- NOVA Digital: arbol binario visible solo para el propietario conectado.
create or replace function public.get_my_binary_tree(p_max_depth integer default 6)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with recursive tree as (
    select
      p.id, p.binary_parent_id, p.binary_side, p.username, p.full_name, p.email,
      0 as depth,
      array[p.id] as path
    from public.profiles p
    where p.id = (select auth.uid())

    union all

    select
      child.id, child.binary_parent_id, child.binary_side, child.username,
      child.full_name, child.email, tree.depth + 1, tree.path || child.id
    from public.profiles child
    join tree on child.binary_parent_id = tree.id
    where tree.depth < greatest(1, least(coalesce(p_max_depth, 6), 12))
      and not child.id = any(tree.path)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'parent_id', binary_parent_id,
        'side', binary_side,
        'username', coalesce(username, full_name, split_part(email, '@', 1), 'Usuario'),
        'depth', depth
      ) order by depth, username
    ),
    '[]'::jsonb
  )
  from tree;
$$;

revoke all on function public.get_my_binary_tree(integer) from public, anon;
grant execute on function public.get_my_binary_tree(integer) to authenticated;
