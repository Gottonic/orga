// Locus : l'agenda de Locus au format calendrier (.ics), pour que Proton Calendar puisse le suivre (19.11.2026).
// Fonction Supabase « agenda » : https://rzcpjsffpvuvbdtqymms.supabase.co/functions/v1/agenda?cle=<clé secrète>
// À créer dans Supabase > Edge Functions > Deploy a new function > Via Editor, nom « agenda », coller ce fichier,
// puis, dans les détails de la fonction, désactiver « Verify JWT » (Proton n'envoie pas de connexion : la clé du lien suffit).
// Elle n'a besoin d'aucun secret : elle lit la fonction SQL locus_agenda(cle) (supabase/agenda.sql) avec la clé publique.
const SB = 'https://rzcpjsffpvuvbdtqymms.supabase.co';
const CLE_PUBLIQUE = 'sb_publishable_mJNXDji0NMOmLFqo3GusGg_JBkFhJmC';

type Ev = { id: string; debut: string; fin: string; titre: string };
const texte = (s: string) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const jour = (s: string) => String(s).slice(0, 10).replace(/-/g, '');
/* lignes de 75 octets au plus (règle du format .ics) */
function plier(l: string): string {
  const b = new TextEncoder().encode(l); if (b.length <= 75) return l;
  const out: string[] = []; let cur = '', n = 0;
  for (const ch of l) { const k = new TextEncoder().encode(ch).length; if (n + k > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; } cur += ch; n += k; }
  out.push(cur); return out.join('\r\n ');
}

Deno.serve(async (req) => {
  const cle = new URL(req.url).searchParams.get('cle') ?? '';
  const r = await fetch(`${SB}/rest/v1/rpc/locus_agenda`, {
    method: 'POST', headers: { apikey: CLE_PUBLIQUE, 'Content-Type': 'application/json' }, body: JSON.stringify({ cle }),
  });
  if (!r.ok) return new Response('Lien inconnu', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const L: Ev[] = await r.json();
  const st = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Locus//Agenda//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Locus', 'X-WR-TIMEZONE:Europe/Zurich', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  for (const e of L) {
    lignes.push('BEGIN:VEVENT', `UID:${e.id}@locus`, `DTSTAMP:${st}`, `DTSTART;VALUE=DATE:${jour(e.debut)}`, `DTEND;VALUE=DATE:${jour(e.fin)}`,
      plier(`SUMMARY:${texte(e.titre)}`), 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  lignes.push('END:VCALENDAR');
  return new Response(lignes.join('\r\n') + '\r\n', { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' } });
});
