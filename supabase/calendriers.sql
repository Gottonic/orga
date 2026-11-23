-- Locus : les calendriers Proton que Locus lit (23.11.2026), pour la routine du lundi (« L'agenda », « Placer… »).
-- À coller une fois dans Supabase > SQL Editor > New query, puis « Run ». Puis créer la fonction « calendriers »
-- (supabase/functions/calendriers/index.ts). Chaque calendrier est un lien de partage Proton (« Partager avec tout le monde »,
-- vue complète). Le lien reste dans cette table : l'app n'en lit que le nom et la couleur ; la fonction le lit avec ta connexion.

create table if not exists public.locus_calendriers (
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id       text not null default replace(gen_random_uuid()::text, '-', ''),
  nom      text not null,
  url      text not null check (url ~* '^(https|webcal)://'),
  couleur  text,
  cree     timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.locus_calendriers enable row level security;
drop policy if exists "mes calendriers" on public.locus_calendriers;
create policy "mes calendriers" on public.locus_calendriers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.locus_calendriers from anon;
grant select, insert, update, delete on public.locus_calendriers to authenticated;

notify pgrst, 'reload schema';

-- Vérification : doit afficher « calendriers prêts ».
select 'calendriers prêts' as resultat where exists (select 1 from pg_tables where tablename = 'locus_calendriers');
