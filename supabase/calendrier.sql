-- Locus : le Calendrier (27.11.2026) — les événements propres au calendrier (ce qui ne vit nulle part ailleurs).
-- À coller une fois dans Supabase > SQL Editor > New query, puis « Run ». On peut le relancer sans risque.
--
-- Les projets, séances de la Forge et tâches placés restent où ils sont (p.days / p.weeks, h:<semaine>,
-- logs/<semaine>.sessions[id].day, n.jour) : le calendrier les lit et les écrit là (commun/calendrier.js).
-- Cette table ne garde que les activités, jobs, rendez-vous, et les blocs « projet » / « tâche » libres.
--
-- Un élément a un jour ; en option un moment (matin / aprem) OU une heure précise (debut, qui gagne).
-- Heures de Zurich, sans fuseau (comme h:<semaine>).
-- Réservé pour plus tard : modèles (UMA : modele, modele_role, decalage_min) et rappels.

create table if not exists public.locus_evenements (
  user_id      uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id           text        not null default replace(gen_random_uuid()::text, '-', ''),
  jour         date        not null,
  jusqu_au     date,                                   -- plusieurs jours (vacances) : dernier jour inclus
  moment       text        check (moment in ('matin', 'aprem')),
  debut        time,                                   -- heure précise ; gagne sur « moment »
  duree_min    integer     check (duree_min is null or duree_min between 5 and 1440),
  type         text        not null default 'rdv' check (type in ('activite', 'job', 'rdv', 'projet', 'tache')),
  titre        text        not null default '',
  lieu         text,
  note         text,
  couleur      text,                                   -- couleur de données (facultative)
  options      jsonb       not null default '{}'::jsonb, -- { declare: bool, trajet_min, prepa_min }
  lien         jsonb,                                  -- { projet: '<id>' } ou { tache: '<id>' }
  modele       text,                                   -- modèles UMA (plus tard) : éléments d'une même instance
  modele_role  text,                                   --   réveil, train, repas, tupp…
  decalage_min integer,                                --   placé par rapport à l'heure de début de l'instance
  rappels      jsonb,                                  -- (plus tard) [{ avant_min }]
  deleted      boolean     not null default false,
  cree         timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, id),
  check (jusqu_au is null or jusqu_au >= jour)
);
create index if not exists locus_evenements_jour on public.locus_evenements (user_id, jour);
create index if not exists locus_evenements_jusqu on public.locus_evenements (user_id, jusqu_au) where jusqu_au is not null;

create or replace function public.locus_evenements_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists locus_evenements_touch on public.locus_evenements;
create trigger locus_evenements_touch before insert or update on public.locus_evenements for each row execute function public.locus_evenements_touch();

alter table public.locus_evenements enable row level security;
drop policy if exists "mes evenements" on public.locus_evenements;
create policy "mes evenements" on public.locus_evenements for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.locus_evenements from anon;
grant select, insert, update, delete on public.locus_evenements to authenticated;

notify pgrst, 'reload schema';

-- Vérification : doit afficher « calendrier prêt ».
select 'calendrier prêt' as resultat where exists (select 1 from pg_tables where tablename = 'locus_evenements');
