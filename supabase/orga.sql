-- ORGA : le socle commun à toutes les apps. À coller dans Supabase > SQL Editor > New query, puis « Run ».
-- On peut le relancer sans risque : rien n'est effacé, ni dans ORGA ni dans les apps.
--   1. l'ampoule 💡 : la table des bugs et idées (remplace idees.sql) ;
--   2. les captures d'écran jointes aux idées : un dossier privé « idees » ;
--   3. la place utilisée sur Supabase, affichée dans Réglages.

-- 1. Ampoule : une ligne par idée, colonne « app » (orga, etabli, banque, forge, marche…).
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


-- 2. Captures d'écran : un dossier privé par personne, 5 Mo max par image (l'app les réduit avant l'envoi).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('idees', 'idees', false, 5242880, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "idees captures : lire" on storage.objects;
drop policy if exists "idees captures : ajouter" on storage.objects;
drop policy if exists "idees captures : modifier" on storage.objects;
drop policy if exists "idees captures : effacer" on storage.objects;
create policy "idees captures : lire"     on storage.objects for select to authenticated using (bucket_id = 'idees' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "idees captures : ajouter"  on storage.objects for insert to authenticated with check (bucket_id = 'idees' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "idees captures : modifier" on storage.objects for update to authenticated using (bucket_id = 'idees' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "idees captures : effacer"  on storage.objects for delete to authenticated using (bucket_id = 'idees' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Place utilisée : taille de la base, de chaque table et de chaque dossier de fichiers (en octets).
--    Seulement des totaux : aucune donnée n'est lue. Réservé aux personnes connectées.
create or replace function public.orga_espace() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'base', pg_catalog.pg_database_size(pg_catalog.current_database()),
    'tables', coalesce((
      select jsonb_object_agg(c.relname, pg_catalog.pg_total_relation_size(c.oid))
      from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'), '{}'::jsonb),
    'fichiers', coalesce((
      select jsonb_object_agg(x.bucket_id, x.octets)
      from (select o.bucket_id, sum(coalesce((o.metadata->>'size')::bigint, 0)) as octets
            from storage.objects o group by o.bucket_id) x), '{}'::jsonb),
    'nb_fichiers', (select count(*) from storage.objects),
    'le', now()
  );
$$;
revoke all on function public.orga_espace() from public, anon;
grant execute on function public.orga_espace() to authenticated;

-- Supabase relit la liste des tables et des fonctions (sinon : « Could not find… »).
notify pgrst, 'reload schema';

-- Vérification : doit afficher « ORGA prêt ».
select 'ORGA prêt' as resultat
where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'idees')
  and exists (select 1 from storage.buckets where id = 'idees')
  and exists (select 1 from pg_catalog.pg_proc where proname = 'orga_espace');
