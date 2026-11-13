begin;

create table public.influencer_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  rules text not null check (char_length(trim(rules)) between 1 and 4000),
  kind text not null check (kind in ('views', 'ugc')),
  reward_cents integer not null check (reward_cents between 1 and 100000),
  min_views integer not null check (min_views between 0 and 1000000000),
  closes_on date not null,
  active boolean not null default true,
  check ((kind = 'views' and min_views >= 1000) or (kind = 'ugc' and min_views = 0))
);

create table public.influencer_submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.influencer_campaigns(id),
  user_id uuid not null default auth.uid() references public.profiles(id),
  title text not null check (char_length(trim(title)) between 1 and 120),
  handle text not null check (handle ~ '^@[A-Za-z0-9_.-]{1,60}$'),
  post_url text check (
    post_url ~ '^https://(www[.]tiktok[.]com/@[A-Za-z0-9_.-]+/video/[0-9]+|www[.]instagram[.]com/(reel|p|tv)/[A-Za-z0-9_-]+|www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]{11})$'
  ),
  video_path text unique,
  kind text not null,
  reward_cents integer not null,
  min_views integer not null,
  verified_views integer not null default 0 check (verified_views between 0 and 1000000000),
  creative_cents integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  review_note text check (char_length(review_note) <= 1000),
  payment_reference text check (char_length(trim(payment_reference)) between 1 and 200),
  reviewed_by uuid references public.profiles(id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  amount_cents bigint generated always as (
    case when status in ('approved', 'paid') then
      case when kind = 'views' then (verified_views / 1000)::bigint * reward_cents else creative_cents end
    else 0 end
  ) stored,
  check (creative_cents between 0 and reward_cents),
  check ((status = 'paid') = (paid_at is not null and payment_reference is not null))
);

-- A publication keeps its identity if its TikTok handle or Instagram URL type changes.
create unique index influencer_submissions_post_idx on public.influencer_submissions (
  split_part(post_url, '/', 3),
  substring(post_url from '[=/]([A-Za-z0-9_-]+)$')
) where post_url is not null;

create index influencer_submissions_user_idx on public.influencer_submissions(user_id, created_at desc);
create index influencer_submissions_rank_idx on public.influencer_submissions(campaign_id, verified_views desc, id)
where kind = 'views' and status <> 'rejected' and verified_views > 0;
create index influencer_referrals_idx on public.profiles(referred_by);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('influencer-videos', 'influencer-videos', false, 52428800, array['video/mp4', 'video/webm', 'video/quicktime']);

alter table public.influencer_campaigns enable row level security;
alter table public.influencer_submissions enable row level security;
revoke all on public.influencer_campaigns, public.influencer_submissions from public, anon, authenticated;
grant select, insert, update on public.influencer_campaigns to authenticated;
grant select on public.influencer_submissions to authenticated;
grant insert (id, campaign_id, title, handle, post_url, video_path) on public.influencer_submissions to authenticated;
grant update (verified_views, creative_cents, status, review_note, payment_reference) on public.influencer_submissions to authenticated;

create policy influencer_read_campaigns on public.influencer_campaigns for select to authenticated
using (active or private.is_admin((select auth.uid())));
create policy influencer_create_campaigns on public.influencer_campaigns for insert to authenticated
with check (private.is_admin((select auth.uid())));
create policy influencer_update_campaigns on public.influencer_campaigns for update to authenticated
using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));
create policy influencer_read_submissions on public.influencer_submissions for select to authenticated
using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));
create policy influencer_create_submissions on public.influencer_submissions for insert to authenticated
with check (user_id = (select auth.uid()));
create policy influencer_review_submissions on public.influencer_submissions for update to authenticated
using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

create policy influencer_upload_video on storage.objects for insert to authenticated
with check (bucket_id = 'influencer-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy influencer_read_video on storage.objects for select to authenticated
using (bucket_id = 'influencer-videos' and (
  (storage.foldername(name))[1] = (select auth.uid())::text or private.is_admin((select auth.uid()))
));
create policy influencer_remove_unsent_video on storage.objects for delete to authenticated
using (bucket_id = 'influencer-videos' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.influencer_submissions s where s.video_path = name));

create function private.enforce_influencer_submission()
returns trigger language plpgsql set search_path = '' as $$
declare
  campaign public.influencer_campaigns%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into campaign from public.influencer_campaigns where id = new.campaign_id;
    if not found or not campaign.active or campaign.closes_on < (now() at time zone 'America/Santo_Domingo')::date then
      raise exception 'La campaña ya no recibe envíos.';
    end if;
    new.kind := campaign.kind;
    new.reward_cents := campaign.reward_cents;
    new.min_views := campaign.min_views;
    if new.kind = 'views' and new.post_url is null then
      raise exception 'Se requiere el enlace de la publicación.';
    end if;
    if new.kind = 'ugc' and (new.video_path is null or new.post_url is not null) then
      raise exception 'Adjunta el archivo original para la campaña creativa.';
    end if;
    if new.video_path is not null and (
      new.video_path !~ ('^' || new.user_id || '/' || new.id || '[.](mp4|webm|mov)$')
      or not exists (select 1 from storage.objects where bucket_id = 'influencer-videos' and name = new.video_path)
    ) then
      raise exception 'El archivo de video no está disponible.';
    end if;
    return new;
  end if;

  if old.status = 'paid' or (new.status = 'paid' and old.status <> 'approved') then
    raise exception 'Solo se puede registrar el pago de un envío aprobado que sigue pendiente de pago.';
  end if;
  if new.status = 'paid' then
    if (new.verified_views, new.creative_cents) is distinct from (old.verified_views, old.creative_cents) then
      raise exception 'Guarda la revisión antes de registrar el pago.';
    end if;
    new.paid_at := now();
  elsif new.payment_reference is not null then
    raise exception 'La referencia corresponde a un pago registrado.';
  end if;
  if (new.kind = 'views' and new.creative_cents <> 0)
     or (new.kind = 'ugc' and new.verified_views <> 0) then
    raise exception 'La recompensa debe corresponder al tipo de campaña.';
  end if;
  if new.status in ('approved', 'paid') and (
    (new.kind = 'views' and new.verified_views < new.min_views) or
    (new.kind = 'ugc' and new.creative_cents = 0)
  ) then
    raise exception 'El envío aún no reúne las condiciones para aprobar la recompensa.';
  end if;
  new.reviewed_by := auth.uid();
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger enforce_influencer_submission
before insert or update on public.influencer_submissions
for each row execute function private.enforce_influencer_submission();

create function private.influencer_overview()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'registrations', (select count(*) from public.profiles where referred_by = auth.uid()),
    'ranking', coalesce((
      select jsonb_agg(jsonb_build_object('campaign_id', c.id, 'handle', r.handle, 'views', r.verified_views)
        order by c.id, r.verified_views desc, r.id)
      from public.influencer_campaigns c
      cross join lateral (
        select s.handle, s.verified_views, s.id from public.influencer_submissions s
        where s.campaign_id = c.id and s.kind = 'views' and s.status <> 'rejected' and s.verified_views > 0
        order by s.verified_views desc, s.id limit 3
      ) r
      where c.active
    ), '[]'::jsonb)
  )
  where auth.uid() is not null;
$$;

create function public.influencer_overview()
returns jsonb language sql stable set search_path = '' as $$
  select private.influencer_overview();
$$;

revoke all on function private.influencer_overview(), public.influencer_overview() from public, anon;
grant execute on function private.influencer_overview(), public.influencer_overview() to authenticated;

insert into public.influencer_campaigns (title, rules, kind, reward_cents, min_views, closes_on) values
  ('¿Cómo funciona Nova Digital?', 'Crea un video original sobre Nova Digital y publícalo en TikTok, Instagram o YouTube. Se pagan bloques completos de 1,000 vistas válidas después de alcanzar el mínimo. El equipo revisa la publicación pública.', 'views', 430, 5000, '2026-12-30'),
  ('Nova Digital Creator Challenge', 'Publica un video original sobre Nova Digital en TikTok, Instagram o YouTube. Se pagan bloques completos de 1,000 vistas válidas. El equipo revisa la publicación pública.', 'views', 300, 1000, '2026-12-30'),
  ('Contenido original para Nova Digital', 'Sube tu video original para revisión. El equipo determina la recompensa según la calidad y el cumplimiento de la campaña.', 'ugc', 100000, 0, '2026-12-30');

commit;
