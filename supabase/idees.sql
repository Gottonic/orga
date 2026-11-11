-- ORGA : les idées et les bugs notés avec l'ampoule 💡, pour toutes les apps (une seule table, colonne « app »).
-- À coller une fois dans Supabase > SQL Editor > New query, puis « Run ». Ne touche pas aux autres apps.

create table if not exists public.idees (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  key        text        not null,
  app        text        not null,          -- orga, etabli, banque, forge…
  data       jsonb,                         -- { titre, type: bug|idee, details, cree, fait, faitLe }
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index if not exists idees_user_updated on public.idees (user_id, updated_at);

-- L'heure de modification est toujours celle du serveur.
create or replace function public.idees_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists idees_touch on public.idees;
create trigger idees_touch before insert or update on public.idees for each row execute function public.idees_touch();

-- Chacun ne voit et ne modifie que ses propres lignes (on n'efface jamais : « deleted » passe à vrai).
alter table public.idees enable row level security;
drop policy if exists "idees : lire ses lignes" on public.idees;
drop policy if exists "idees : ajouter ses lignes" on public.idees;
drop policy if exists "idees : modifier ses lignes" on public.idees;
create policy "idees : lire ses lignes"     on public.idees for select to authenticated using (auth.uid() = user_id);
create policy "idees : ajouter ses lignes"  on public.idees for insert to authenticated with check (auth.uid() = user_id);
create policy "idees : modifier ses lignes" on public.idees for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.idees from anon;
grant select, insert, update on public.idees to authenticated;

-- Supabase relit la liste des tables (sinon : « Could not find the table »).
notify pgrst, 'reload schema';

-- Vérification : doit afficher « idees prête ».
select 'idees prête' as resultat where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'idees');
