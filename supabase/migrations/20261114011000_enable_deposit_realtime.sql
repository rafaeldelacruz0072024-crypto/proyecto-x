do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles', 'transactions']
  loop
    if not exists (
      select 1 from pg_publication_tables publication
      where publication.pubname = 'supabase_realtime'
        and publication.schemaname = 'public'
        and publication.tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
