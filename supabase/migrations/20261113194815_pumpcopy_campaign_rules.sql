begin;

alter table public.influencer_campaigns
  add column description text not null default '',
  add column requires_statistics boolean not null default false,
  add constraint influencer_statistics_for_views check (not requires_statistics or kind = 'views');

alter table public.influencer_submissions add column statistics_path text unique;
grant insert (statistics_path) on public.influencer_submissions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('influencer-statistics', 'influencer-statistics', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']);

create policy influencer_upload_statistics on storage.objects for insert to authenticated
with check (bucket_id = 'influencer-statistics' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy influencer_read_statistics on storage.objects for select to authenticated
using (bucket_id = 'influencer-statistics' and (
  (storage.foldername(name))[1] = (select auth.uid())::text or private.is_admin((select auth.uid()))
));

create policy influencer_remove_unsent_statistics on storage.objects for delete to authenticated
using (bucket_id = 'influencer-statistics' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.influencer_submissions s where s.statistics_path = name));

create function private.enforce_influencer_statistics()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.statistics_path is null then
    if exists (select 1 from public.influencer_campaigns where id = new.campaign_id and requires_statistics) then
      raise exception 'Adjunta una captura de las estadísticas del video.';
    end if;
  elsif new.kind <> 'views'
    or new.statistics_path !~ ('^' || new.user_id || '/' || new.id || '[.](png|jpg|webp)$')
    or not exists (
      select 1 from storage.objects where bucket_id = 'influencer-statistics' and name = new.statistics_path
    ) then
    raise exception 'La captura de estadísticas no está disponible.';
  end if;
  return new;
end;
$$;

-- Run after enforce_influencer_submission, which sets the campaign kind.
create trigger enforce_influencer_statistics
before insert on public.influencer_submissions
for each row execute function private.enforce_influencer_statistics();

update public.influencer_campaigns
set title = 'PumpCopy Creator Challenge',
    reward_cents = 250,
    min_views = 1000,
    requires_statistics = true,
    description = '¿Te gusta crear contenido sobre tecnología, trading o memecoins? Queremos ideas originales sobre PumpCopy que hagan pensar y participar a tu audiencia. Comparte preguntas, comparaciones, análisis o retos. ¿Qué pregunta sobre copy trading convertirías en tu primer video?',
    rules = $rules$1. Aparece frente a cámara y usa tu propia voz durante la mayor parte del video.
2. Crea un video original, vertical 9:16, con resolución mínima de 1080 × 1920 y duración de 30 a 90 segundos.
3. Incluye un gancho durante los primeros 3 segundos, una explicación sencilla de qué es PumpCopy, al menos dos funciones de la plataforma y una invitación clara a conocerla.
4. Explica el tema con tus propias palabras. No se aceptan videos que se limiten a leer un guion completo de manera artificial.
5. Puedes usar imágenes, grabaciones de pantalla y recursos oficiales de PumpCopy como apoyo. Tú debes seguir siendo el protagonista.
6. Menciona PumpCopy en voz alta y muestra el nombre o el logo en pantalla.
7. Etiqueta la cuenta oficial de PumpCopy en la descripción e incluye #PumpCopy y #PumpCopyCreators.
8. Mantén tu cuenta pública y la publicación disponible durante al menos 30 días.
9. Envía el enlace directo del video y una captura de sus estadísticas para solicitar la validación.
10. Solo cuentan vistas orgánicas, públicas, válidas y verificables obtenidas durante el periodo activo de la campaña. Los videos aprobados ganan US$2.50 por cada bloque completo de 1,000 vistas verificadas. El mínimo es de 1,000 vistas.
11. No se permiten bots, compra de vistas, publicidad pagada, intercambios de interacción ni otros métodos de manipulación.$rules$
where title = 'Nova Digital Creator Challenge' and kind = 'views';

commit;
