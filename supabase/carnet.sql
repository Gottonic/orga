-- Forge (entraînement parkour) : base de données. Déjà en place, à ne relancer que pour repartir de zéro.
-- La table et le dossier de fichiers s'appellent « carnet » (ancien nom de l'app). Ne touche pas aux autres apps.

-- Une seule table : chaque bloc, semaine, journal, test… est une ligne (clé « collection/id »).
create table if not exists public.carnet (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  key        text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index if not exists carnet_user_updated on public.carnet (user_id, updated_at);

-- L'heure de modification est toujours celle du serveur.
create or replace function public.carnet_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists carnet_touch on public.carnet;
create trigger carnet_touch before insert or update on public.carnet for each row execute function public.carnet_touch();

-- Chacun ne voit et ne modifie que ses propres lignes.
alter table public.carnet enable row level security;
drop policy if exists "carnet lire"     on public.carnet;
drop policy if exists "carnet ajouter"  on public.carnet;
drop policy if exists "carnet modifier" on public.carnet;
create policy "carnet lire"     on public.carnet for select to authenticated using (auth.uid() = user_id);
create policy "carnet ajouter"  on public.carnet for insert to authenticated with check (auth.uid() = user_id);
create policy "carnet modifier" on public.carnet for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.carnet from anon;
grant select, insert, update on public.carnet to authenticated;

-- Fichiers privés (photos, images d'exercices, GIF) : un dossier par personne, invisible pour les autres.
insert into storage.buckets (id, name, public) values ('carnet', 'carnet', false) on conflict (id) do nothing;
drop policy if exists "carnet fichiers lire"      on storage.objects;
drop policy if exists "carnet fichiers ajouter"   on storage.objects;
drop policy if exists "carnet fichiers modifier"  on storage.objects;
drop policy if exists "carnet fichiers supprimer" on storage.objects;
create policy "carnet fichiers lire"      on storage.objects for select to authenticated using (bucket_id = 'carnet' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "carnet fichiers ajouter"   on storage.objects for insert to authenticated with check (bucket_id = 'carnet' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "carnet fichiers modifier"  on storage.objects for update to authenticated using (bucket_id = 'carnet' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "carnet fichiers supprimer" on storage.objects for delete to authenticated using (bucket_id = 'carnet' and (storage.foldername(name))[1] = auth.uid()::text);
