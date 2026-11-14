-- Locus, étape 3 : les dossiers de projet sur l'ordinateur.
-- À coller une fois dans Supabase > SQL Editor > New query, puis « Run ».
-- Les fichiers vivent sur l'ordinateur (dossier Locus). Supabase garde seulement une fiche par fichier
-- (nom, dossier, taille, date) et, le temps du transport, les fichiers envoyés depuis le téléphone.

-- 1. Les fiches : une ligne par fichier, comme les autres tables de Locus.
create table if not exists public.fichiers (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  key        text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index if not exists fichiers_user_updated on public.fichiers (user_id, updated_at);

create or replace function public.fichiers_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists fichiers_touch on public.fichiers;
create trigger fichiers_touch before insert or update on public.fichiers for each row execute function public.fichiers_touch();

alter table public.fichiers enable row level security;
drop policy if exists "fichiers : lire ses lignes" on public.fichiers;
drop policy if exists "fichiers : ajouter ses lignes" on public.fichiers;
drop policy if exists "fichiers : modifier ses lignes" on public.fichiers;
create policy "fichiers : lire ses lignes"     on public.fichiers for select to authenticated using (auth.uid() = user_id);
create policy "fichiers : ajouter ses lignes"  on public.fichiers for insert to authenticated with check (auth.uid() = user_id);
create policy "fichiers : modifier ses lignes" on public.fichiers for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.fichiers from anon;
grant select, insert, update on public.fichiers to authenticated;

-- 2. Le transit : un dossier privé par personne, 50 Mo au plus par fichier.
--    Un fichier n'y reste que jusqu'à la prochaine ouverture de Locus sur l'ordinateur, puis il est effacé.
insert into storage.buckets (id, name, public, file_size_limit)
values ('transit', 'transit', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "transit : lire" on storage.objects;
drop policy if exists "transit : ajouter" on storage.objects;
drop policy if exists "transit : modifier" on storage.objects;
drop policy if exists "transit : effacer" on storage.objects;
create policy "transit : lire"     on storage.objects for select to authenticated using (bucket_id = 'transit' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "transit : ajouter"  on storage.objects for insert to authenticated with check (bucket_id = 'transit' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "transit : modifier" on storage.objects for update to authenticated using (bucket_id = 'transit' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "transit : effacer"  on storage.objects for delete to authenticated using (bucket_id = 'transit' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';

-- Vérification : doit afficher « fichiers prêts ».
select 'fichiers prêts' as resultat
where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'fichiers')
  and exists (select 1 from storage.buckets where id = 'transit');
