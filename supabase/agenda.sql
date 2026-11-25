-- Locus : l'agenda de Locus dans Proton Calendar (19.11.2026, choix de Nicolas : « proposition A »).
-- Ce que tu places dans Locus (projets sur des jours ou des semaines, séances de la Forge, tâches ; avec leur heure depuis le 23.11) devient un calendrier que Proton
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

-- Heures placées dans la routine du lundi (23.11) : biblio_rows « h:<semaine> » = { p: {'<projet>|<date>': 'HH:MM'}, f: {'<séance>': 'HH:MM'}, t: {'<tâche>': 'HH:MM'} }.
create or replace function public.locus_heure(u uuid, w text, g text, k text) returns text
language sql stable set search_path = public as $$
  select h.data -> g ->> k from public.biblio_rows h where h.user_id = u and h.key = 'h:' || w and not h.deleted
$$;
revoke all on function public.locus_heure(uuid, text, text, text) from public, anon, authenticated;
-- la même chose en jsonb : pour les projets, une liste de créneaux [{h:'HH:MM', min}, …] (23.11 : plusieurs par jour, durée réglable)
create or replace function public.locus_heure_j(u uuid, w text, g text, k text) returns jsonb
language sql stable set search_path = public as $$
  select h.data -> g -> k from public.biblio_rows h where h.user_id = u and h.key = 'h:' || w and not h.deleted
$$;
revoke all on function public.locus_heure_j(uuid, text, text, text) from public, anon, authenticated;

-- un évènement : journée entière, ou de l'heure placée pendant « duree » minutes (heure de Zurich)
create or replace function public.locus_ev(id text, d date, hr text, duree int, titre text) returns jsonb
language sql immutable as $$
  select case when hr ~ '^\d{2}:\d{2}$'
    then jsonb_build_object('id', id, 'debut', d::text || 'T' || hr, 'fin', to_char(d + hr::time + make_interval(mins => duree), 'YYYY-MM-DD"T"HH24:MI'), 'titre', titre)
    else jsonb_build_object('id', id, 'debut', d::text, 'fin', (d + 1)::text, 'titre', titre) end
$$;

-- Les évènements, de 2 semaines en arrière à 10 semaines en avant : { id, debut, fin (exclue), titre }.
-- Journées entières, ou avec l'heure placée : un projet dure 4 h, une séance le temps prévu dans la Forge. Plus de tâches depuis le 25.11.
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
    -- projets placés sur des jours : un évènement par créneau (ou la journée entière s'il n'y a pas d'heure)
    select public.locus_ev('p-' || (r.data->>'id') || '-' || d || '-' || c.n, d::date, c.hr, c.mn,
             trim(coalesce(r.data->>'emoji', '') || ' ' || coalesce(r.data->>'name', 'Projet'))) as e
      from public.rows r
      cross join lateral jsonb_array_elements_text(coalesce(r.data->'days', '[]'::jsonb)) d
      cross join lateral (select public.locus_heure_j(u, to_char(d::date, 'IYYY-"W"IW'), 'p', (r.data->>'id') || '|' || d) as v) hv
      cross join lateral (
        select x->>'h' as hr, coalesce(nullif(x->>'min', '')::int, 240) as mn, t.n from jsonb_array_elements(hv.v) with ordinality as t(x, n) where jsonb_typeof(hv.v) = 'array'
        union all select hv.v #>> '{}', 240, 1 where jsonb_typeof(hv.v) = 'string'
        union all select null, 240, 1 where hv.v is null or jsonb_typeof(hv.v) not in ('array', 'string')
      ) c
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
    select public.locus_ev('f-' || s.wk || '-' || (x->>'id'), public.locus_lundi_de(s.wk) + (x->>'day')::int,
             public.locus_heure(u, s.wk, 'f', x->>'id'), coalesce(nullif(x->>'min', '')::int, 60), 'Forge · ' || coalesce(x->>'t', 'Séance'))
      from public.carnet c, jsonb_each(coalesce(c.data->'semaines', '{}'::jsonb)) as s(wk, arr), jsonb_array_elements(s.arr) x
     where c.user_id = u and c.key = 'locus/semaines' and not c.deleted and s.wk ~ '^\d{4}-W\d{2}$'
       and jsonb_typeof(x->'day') = 'number' and (x->>'day')::int between 0 and 6
    -- (25.11, choix de Nicolas : les tâches ne vont plus dans l'agenda Locus ; seulement les projets et les séances)
  ) t), '[]'::jsonb);
end $$;
revoke all on function public.locus_agenda(text) from public;
grant execute on function public.locus_agenda(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Vérification : doit afficher « agenda prêt ».
select 'agenda prêt' as resultat where exists (select 1 from pg_proc where proname = 'locus_agenda');
