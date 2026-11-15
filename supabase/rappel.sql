-- Locus, Bibliothèque : le rappel du dimanche matin (15.11.2026).
-- À coller une fois dans Supabase > SQL Editor > New query, puis « Run ». (Après biblio.sql et lundi.sql.)
-- L'action GitHub « Rappel du dimanche » (.github/workflows/rappel-dimanche.yml) appelle cette fonction avec la clé du lien
-- du lundi (secret LOCUS_CLE du dépôt) : elle reçoit les abonnements aux notifications de chaque appareil
-- (lignes s:push-<appareil> de biblio_rows, avec leurs clés VAPID) et sait si le bilan de la semaine est déjà rempli.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.locus_rappel(cle text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  u uuid;
  sem text := to_char(now() at time zone 'Europe/Zurich', 'IYYY-"W"IW');
  w jsonb;
begin
  select user_id into u from public.locus_cles where cle_hash = encode(digest(coalesce(cle, ''), 'sha256'), 'hex');
  if u is null then raise exception 'clé inconnue'; end if;
  select data into w from public.biblio_rows where user_id = u and key = 'w:' || sem and not deleted;
  return jsonb_build_object(
    'semaine', sem,
    'bilan_fait', coalesce(w ? 'calme' and w ? 'energie' and w ? 'prod', false),
    'abonnements', (select coalesce(jsonb_agg(jsonb_build_object('sub', data->'sub', 'pub', data->>'pub', 'priv', data->>'priv', 'appareil', data->>'appareil')), '[]'::jsonb)
                    from public.biblio_rows where user_id = u and key like 's:push-%' and not deleted and data ? 'sub'));
end $$;
revoke all on function public.locus_rappel(text) from public;
grant execute on function public.locus_rappel(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Vérification : doit afficher « rappel du dimanche prêt ».
select 'rappel du dimanche prêt' as resultat where exists (select 1 from pg_proc where proname = 'locus_rappel');
