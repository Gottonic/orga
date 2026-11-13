-- La Mine (dossier mine/) : le travail pro (activités, mandats, clients, heures, devis, factures).
-- À coller une fois dans Supabase > SQL Editor > New query, puis « Run ».
-- (À côté des tables des autres apps : rien n'est touché de ce côté-là. La Mine lit la table de la Banque, sans jamais l'écrire.)

-- Une table, comme les autres apps : chaque activité, mandat, contact, heure, document… est une ligne.
-- « kind » dit ce que c'est ; « data » contient le détail. L'app garde tout en mémoire et marche hors ligne.
create table if not exists public.mine_rows (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  key        text        not null,
  kind       text        not null check (kind in ('activite','mandat','contact','heure','document','lien','reglage')),
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index if not exists mine_rows_user_updated on public.mine_rows (user_id, updated_at);

-- L'heure de modification est toujours celle du serveur.
create or replace function public.mine_rows_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists mine_rows_touch on public.mine_rows;
create trigger mine_rows_touch before insert or update on public.mine_rows for each row execute function public.mine_rows_touch();

-- Chacun ne voit et ne modifie que ses propres lignes (on n'efface jamais : « deleted » passe à vrai).
alter table public.mine_rows enable row level security;
drop policy if exists "mine : lire ses lignes" on public.mine_rows;
drop policy if exists "mine : ajouter ses lignes" on public.mine_rows;
drop policy if exists "mine : modifier ses lignes" on public.mine_rows;
create policy "mine : lire ses lignes"     on public.mine_rows for select to authenticated using (auth.uid() = user_id);
create policy "mine : ajouter ses lignes"  on public.mine_rows for insert to authenticated with check (auth.uid() = user_id);
create policy "mine : modifier ses lignes" on public.mine_rows for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.mine_rows from anon;
grant select, insert, update on public.mine_rows to authenticated;

-- Supabase relit la liste des tables (sinon l'app peut répondre « Could not find the table »).
notify pgrst, 'reload schema';

-- Vérification : doit afficher « mine_rows prête ».
select 'mine_rows prête' as resultat where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'mine_rows');
