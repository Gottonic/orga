-- Locus, étape 5 : le pont du lundi. Un lien privé, en lecture seule, que la tâche planifiée du lundi (Claude) peut lire.
-- À coller une fois dans Supabase > SQL Editor > New query, puis « Run ». (Après schema.sql, mine.sql et biblio.sql.)
-- Le lien contient une clé secrète créée depuis l'Établi (Récap › « Lien pour la séance du lundi ») ; Supabase n'en garde que l'empreinte.
-- Une nouvelle clé remplace l'ancienne : l'ancien lien ne marche plus.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.locus_cles (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  cle_hash text not null,
  cree     timestamptz not null default now()
);
alter table public.locus_cles enable row level security;   -- aucune règle : on n'y touche que par les deux fonctions ci-dessous
revoke all on public.locus_cles from anon, authenticated;

-- Créer (ou remplacer) la clé : réservé à la personne connectée, renvoie la clé une seule fois.
create or replace function public.locus_cle_nouvelle() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare c text := encode(gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  insert into public.locus_cles (user_id, cle_hash) values (auth.uid(), encode(digest(c, 'sha256'), 'hex'))
  on conflict (user_id) do update set cle_hash = excluded.cle_hash, cree = now();
  return c;
end $$;
revoke all on function public.locus_cle_nouvelle() from public, anon;
grant execute on function public.locus_cle_nouvelle() to authenticated;

-- Ce que la séance du lundi lit : projets ouverts et domaines (Établi), heures et factures ouvertes (Mine ; heures GDT par semaine, lues par la Mine),
-- vide-tête et journal des deux dernières semaines (Bibliothèque). Lecture seule.
create or replace function public.locus_lundi(cle text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  u uuid;
  sem text := to_char(now() at time zone 'Europe/Zurich', 'IYYY-"W"IW');
  sem_av text := to_char((now() at time zone 'Europe/Zurich') - interval '7 days', 'IYYY-"W"IW');
  depuis text := to_char((now() at time zone 'Europe/Zurich') - interval '14 days', 'YYYY-MM-DD');
begin
  select user_id into u from public.locus_cles where cle_hash = encode(digest(coalesce(cle, ''), 'sha256'), 'hex');
  if u is null then raise exception 'clé inconnue'; end if;
  return jsonb_build_object(
    'le', now(), 'semaine', sem, 'semaine_passee', sem_av,
    'domaines', (select coalesce(jsonb_agg(jsonb_build_object('id', data->>'id', 'nom', data->>'name', 'emoji', data->>'emoji', 'archive', data->>'closed')), '[]'::jsonb)
                 from public.rows where user_id = u and key like 'd:%' and not deleted),
    'projets', (select coalesce(jsonb_agg(jsonb_build_object('id', data->>'id', 'nom', data->>'name', 'emoji', data->>'emoji', 'domaine', data->>'parent',
                  'nature', data->>'nature', 'taille', data->>'size', 'jours', data->'dur', 'importance', data->'imp', 'echeance', data->>'due',
                  'idee', data->'later', 'prevu', data->>'prevu', 'semaines', data->'weeks', 'dates', data->'days', 'touche', data->>'touche',
                  'taches_ouvertes', (select coalesce(jsonb_agg(x->>'t'), '[]'::jsonb) from jsonb_array_elements(coalesce(data->'tasks', '[]'::jsonb)) x
                                      where coalesce((x->>'d')::boolean, false) = false and coalesce((x->>'s')::boolean, false) = false))), '[]'::jsonb)
                from public.rows where user_id = u and key like 'p:%' and not deleted and data->>'closed' is null),
    'heures', (select coalesce(jsonb_agg(jsonb_build_object('date', h.data->>'date', 'minutes', h.data->'min', 'mandat', m.data->>'nom', 'note', h.data->>'note') order by h.data->>'date'), '[]'::jsonb)
               from public.mine_rows h left join public.mine_rows m on m.user_id = u and m.key = 'm:' || (h.data->>'mandat')
               where h.user_id = u and h.key like 'h:%' and not h.deleted and h.data->>'date' >= depuis),
    'heures_gdt_par_semaine', (select data->'gdtHeures'->'sem' from public.mine_rows where user_id = u and key = 's:reglages' and not deleted),
    'factures_ouvertes', (select coalesce(jsonb_agg(jsonb_build_object('num', data->>'num', 'date', data->>'date', 'objet', data->>'objet')), '[]'::jsonb)
               from public.mine_rows where user_id = u and key like 'd:%' and not deleted and data->>'type' = 'facture' and data->>'etat' = 'envoyee'),
    'vide_tete', (select coalesce(jsonb_agg(jsonb_build_object('texte', data->>'t', 'note', data->>'d', 'le', data->>'cree') order by (data->>'o')::numeric), '[]'::jsonb)
               from public.biblio_rows where user_id = u and key like 'n:%' and not deleted and data->>'p' = 'vide' and data->>'a' is null),
    'journal', jsonb_build_object(
       sem_av, jsonb_build_object('note', (select data->'n' from public.biblio_rows where user_id = u and key = 'w:' || sem_av and not deleted),
                 'lignes', (select coalesce(jsonb_agg(data->>'t' order by (data->>'o')::numeric), '[]'::jsonb) from public.biblio_rows
                            where user_id = u and key like 'n:%' and not deleted and data->>'p' = 'j:' || sem_av and data->>'a' is null)),
       sem, jsonb_build_object('note', (select data->'n' from public.biblio_rows where user_id = u and key = 'w:' || sem and not deleted),
                 'lignes', (select coalesce(jsonb_agg(data->>'t' order by (data->>'o')::numeric), '[]'::jsonb) from public.biblio_rows
                            where user_id = u and key like 'n:%' and not deleted and data->>'p' = 'j:' || sem and data->>'a' is null)))
  );
end $$;
revoke all on function public.locus_lundi(text) from public;
grant execute on function public.locus_lundi(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Vérification : doit afficher « pont du lundi prêt ».
select 'pont du lundi prêt' as resultat where exists (select 1 from pg_proc where proname = 'locus_lundi');
