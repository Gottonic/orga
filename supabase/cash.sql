-- Cash : base de données. À coller une fois dans Supabase > SQL Editor > New query, puis « Run ».
-- (À côté de la table d'Établi : rien n'est touché de ce côté-là.)

-- Une table, comme Établi : chaque compte, catégorie, tag, transaction, règle, budget… est une ligne.
-- « kind » dit ce que c'est ; « data » contient le détail. L'app garde tout en mémoire et marche hors ligne.
create table if not exists public.cash_rows (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  key        text        not null,
  kind       text        not null check (kind in ('compte','categorie','tag','tx','regle','budget','objectif','dette','valeur','document','reglage','import')),
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index if not exists cash_rows_user_updated on public.cash_rows (user_id, updated_at);
create index if not exists cash_rows_user_kind on public.cash_rows (user_id, kind);

-- L'heure de modification est toujours celle du serveur.
create or replace function public.cash_rows_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists cash_rows_touch on public.cash_rows;
create trigger cash_rows_touch before insert or update on public.cash_rows for each row execute function public.cash_rows_touch();

-- Chacun ne voit et ne modifie que ses propres lignes (on n'efface jamais : « deleted » passe à vrai).
alter table public.cash_rows enable row level security;
drop policy if exists "cash : lire ses lignes" on public.cash_rows;
drop policy if exists "cash : ajouter ses lignes" on public.cash_rows;
drop policy if exists "cash : modifier ses lignes" on public.cash_rows;
create policy "cash : lire ses lignes"     on public.cash_rows for select to authenticated using (auth.uid() = user_id);
create policy "cash : ajouter ses lignes"  on public.cash_rows for insert to authenticated with check (auth.uid() = user_id);
create policy "cash : modifier ses lignes" on public.cash_rows for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.cash_rows from anon;
grant select, insert, update on public.cash_rows to authenticated;

-- Documents (garanties, factures) : un dossier privé par personne, 10 Mo max, images et PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cash-documents', 'cash-documents', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;
drop policy if exists "cash docs : lire" on storage.objects;
drop policy if exists "cash docs : ajouter" on storage.objects;
drop policy if exists "cash docs : modifier" on storage.objects;
drop policy if exists "cash docs : effacer" on storage.objects;
create policy "cash docs : lire"     on storage.objects for select to authenticated using (bucket_id = 'cash-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cash docs : ajouter"  on storage.objects for insert to authenticated with check (bucket_id = 'cash-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cash docs : modifier" on storage.objects for update to authenticated using (bucket_id = 'cash-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cash docs : effacer"  on storage.objects for delete to authenticated using (bucket_id = 'cash-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Vérification : doit afficher « cash_rows prête ».
select 'cash_rows prête' as resultat where exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'cash_rows');
