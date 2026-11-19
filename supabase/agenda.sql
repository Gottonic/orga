-- Locus : l'agenda de Locus dans Proton Calendar (19.11.2026, choix de Nicolas : « proposition A »).
-- Ce que tu places dans Locus (projets sur des jours ou des semaines, séances de la Forge) devient un calendrier que Proton
-- peut suivre (« Ajouter un calendrier depuis une URL »). Lecture seule côté Proton ; Proton le relit toutes les 8 à 16 heures.
-- À coller une fois dans Supabase > SQL Editor > New query, puis « Run ». (Après schema.sql et carnet.sql.)
-- Le lien contient une clé secrète créée depuis Locus (routine du lundi › L'agenda) ; Supabase n'en garde que l'empreinte.
-- Une nouvelle clé remplace l'ancienne : l'ancien lien ne marche plus. Clé à part de celle du pont du lundi.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.locus_agenda_cles (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  cle_hash text not null,
  cree     timestamptz not null default now()
);
alter table public.locus_agenda_cles enable row level security;   -- aucune règle : seulement par les deux fonctions ci-dessous
revoke all on public.locus_agenda_cles from anon, authenticated;

create or replace function public.locus_agenda_cle_nouvelle() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare c text := encode(gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  insert into public.locus_agenda_cles (user_id, cle_hash) values (auth.uid(), encode(digest(c, 'sha256'), 'hex'))
  on conflict (user_id) do update set cle_hash = excluded.cle_hash, cree = now();
  return c;
end $$;
revoke all on function public.locus_agenda_cle_nouvelle() from public, anon;
grant execute on function public.locus_agenda_cle_nouvelle() to authenticated;

-- lundi d'une semaine ISO « 2026-W48 »
create or replace function public.locus_lundi_de(w text) returns date
language sql immutable as $$
  select (date_trunc('week', make_date(split_part(w, '-W', 1)::int, 1, 4))::date + (split_part(w, '-W', 2)::int - 1) * 7)
$$;

-- Les évènements, de 2 semaines en arrière à 10 semaines en avant : { id, debut, fin (exclue), titre }. Journées entières.
create or replace function public.locus_agenda(cle text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  u uuid;
  d0 date := (now() at time zone 'Europe/Zurich')::date - 14;
  d1 date := (now() at time zone 'Europe/Zurich')::date + 70;
begin
  select user_id into u from public.locus_agenda_cles where cle_hash = encode(digest(coalesce(cle, ''), 'sha256'), 'hex');
  if u is null then raise exception 'clé inconnue'; end if;
  return coalesce((select jsonb_agg(e order by e->>'debut') from (
    -- projets placés sur des jours
    select jsonb_build_object('id', 'p-' || (r.data->>'id') || '-' || d, 'debut', d, 'fin', (d::date + 1)::text,
             'titre', trim(coalesce(r.data->>'emoji', '') || ' ' || coalesce(r.data->>'name', 'Projet'))) as e
      from public.rows r, jsonb_array_elements_text(coalesce(r.data->'days', '[]'::jsonb)) d
     where r.user_id = u and r.key like 'p:%' and not r.deleted and r.data->>'closed' is null
       and d ~ '^\d{4}-\d{2}-\d{2}$' and d::date between d0 and d1
    union all
    -- projets placés sur toute une semaine (du lundi au vendredi)
    select jsonb_build_object('id', 'pw-' || (r.data->>'id') || '-' || w, 'debut', public.locus_lundi_de(w)::text, 'fin', (public.locus_lundi_de(w) + 5)::text,
             'titre', trim(coalesce(r.data->>'emoji', '') || ' ' || coalesce(r.data->>'name', 'Projet')) || ' · semaine')
      from public.rows r, jsonb_array_elements_text(coalesce(r.data->'weeks', '[]'::jsonb)) w
     where r.user_id = u and r.key like 'p:%' and not r.deleted and r.data->>'closed' is null
       and w ~ '^\d{4}-W\d{2}$' and public.locus_lundi_de(w) between d0 - 7 and d1
    union all
    -- séances de la Forge placées sur un jour (publiées par la Forge dans « locus/semaines »)
    select jsonb_build_object('id', 'f-' || s.wk || '-' || (x->>'id'), 'debut', (public.locus_lundi_de(s.wk) + (x->>'day')::int)::text,
             'fin', (public.locus_lundi_de(s.wk) + (x->>'day')::int + 1)::text, 'titre', 'Forge · ' || coalesce(x->>'t', 'Séance'))
      from public.carnet c, jsonb_each(coalesce(c.data->'semaines', '{}'::jsonb)) as s(wk, arr), jsonb_array_elements(s.arr) x
     where c.user_id = u and c.key = 'locus/semaines' and not c.deleted and s.wk ~ '^\d{4}-W\d{2}$'
       and jsonb_typeof(x->'day') = 'number' and (x->>'day')::int between 0 and 6
  ) t), '[]'::jsonb);
end $$;
revoke all on function public.locus_agenda(text) from public;
grant execute on function public.locus_agenda(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Vérification : doit afficher « agenda prêt ».
select 'agenda prêt' as resultat where exists (select 1 from pg_proc where proname = 'locus_agenda');
