-- La Bibliothèque (dossier bibliotheque/) : vide-tête, notes des projets et des domaines, journal. Étape 4 du plan.
-- À coller une fois dans Supabase > SQL Editor > New query, puis « Run ».
-- Une ligne par ligne de notes (n:<id>), plus les pages de la semaine (w:<année-Wsemaine>) et les réglages (s:…).

-- Une table, comme les autres apps de Locus.
create table if not exists public.biblio_rows (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  key        text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index if not exists biblio_rows_user_updated on public.biblio_rows (user_id, updated_at);

create or replace function public.biblio_rows_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists biblio_rows_touch on public.biblio_rows;
create trigger biblio_rows_touch before insert or update on public.biblio_rows for each row execute function public.biblio_rows_touch();

alter table public.biblio_rows enable row level security;
drop policy if exists "biblio : lire ses lignes" on public.biblio_rows;
drop policy if exists "biblio : ajouter ses lignes" on public.biblio_rows;
drop policy if exists "biblio : modifier ses lignes" on public.biblio_rows;
create policy "biblio : lire ses lignes"     on public.biblio_rows for select to authenticated using (auth.uid() = user_id);
create policy "biblio : ajouter ses lignes"  on public.biblio_rows for insert to authenticated with check (auth.uid() = user_id);
create policy "biblio : modifier ses lignes" on public.biblio_rows for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.biblio_rows from anon;
grant select, insert, update on public.biblio_rows to authenticated;

notify pgrst, 'reload schema';

-- Vérification : doit afficher « biblio_rows prête ».
select 'biblio_rows prête' as resultat where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'biblio_rows');
