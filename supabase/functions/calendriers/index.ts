// Locus : lire les calendriers Proton de Nicolas (23.11.2026), pour l'étape « L'agenda » de la routine du lundi et les étapes « Placer ».
// Fonction Supabase « calendriers » : https://rzcpjsffpvuvbdtqymms.supabase.co/functions/v1/calendriers?de=AAAA-MM-JJ&a=AAAA-MM-JJ
// À créer dans Supabase > Edge Functions > Deploy a new function > Via Editor, nom « calendriers », coller ce fichier, puis,
// dans les détails de la fonction, désactiver « Verify JWT » (comme « agenda »). Ce n'est pas un trou : la fonction ne lit la table
// locus_calendriers (supabase/calendriers.sql) qu'avec la connexion de la personne qui appelle ; sans connexion, elle ne trouve rien.
// Les liens de partage des calendriers restent dans Supabase : l'app ne lit que les noms et les couleurs, jamais les liens.
const SB = 'https://rzcpjsffpvuvbdtqymms.supabase.co';
const CLE_PUBLIQUE = 'sb_publishable_mJNXDji0NMOmLFqo3GusGg_JBkFhJmC';
const TZ = 'Europe/Zurich';
const JOUR = 86400000;
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

type Prop = { name: string; params: Record<string, string>; value: string };
export type Ev = { titre: string; lieu?: string; note?: string; debut: string; fin: string; journee: boolean };

/* ---------- lecture du format .ics ---------- */
function prop(l: string): Prop | null {
  let q = false, i = 0;
  for (; i < l.length; i++) { const c = l[i]; if (c === '"') q = !q; else if (c === ':' && !q) break; }
  if (i >= l.length) return null;
  const tete = l.slice(0, i), value = l.slice(i + 1), morceaux: string[] = [];
  let cur = ''; q = false;
  for (const c of tete) { if (c === '"') { q = !q; continue; } if (c === ';' && !q) { morceaux.push(cur); cur = ''; } else cur += c; }
  morceaux.push(cur);
  const params: Record<string, string> = {};
  for (const m of morceaux.slice(1)) { const k = m.indexOf('='); if (k > 0) params[m.slice(0, k).toUpperCase()] = m.slice(k + 1); }
  return { name: morceaux[0].toUpperCase(), params, value };
}
const sansEchap = (s: string) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
/* la description (« remarques » d'un évènement, 25.11) garde ses retours à la ligne ; 2000 caractères au plus */
const texteLong = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim().slice(0, 2000);
function blocs(t: string): Prop[][] {
  const L = t.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/), out: Prop[][] = [];
  let ev: Prop[] | null = null, profond = 0;
  for (const l of L) {
    if (l === 'BEGIN:VEVENT') { ev = []; profond = 0; continue; }
    if (l === 'END:VEVENT') { if (ev) out.push(ev); ev = null; continue; }
    if (!ev) continue;
    if (l.startsWith('BEGIN:')) { profond++; continue; }
    if (l.startsWith('END:')) { profond--; continue; }
    if (profond > 0) continue;
    const p = prop(l); if (p) ev.push(p);
  }
  return out;
}

/* ---------- dates : tout est ramené à l'heure murale de Zurich, gardée en « ms UTC » (calculs de jours sans soucis d'heure d'été) ---------- */
const fmt = new Map<string, Intl.DateTimeFormat>();
function murale(ms: number, tz: string): number {
  let f = fmt.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); fmt.set(tz, f); }
  const p: Record<string, number> = {}; for (const x of f.formatToParts(new Date(ms))) if (x.type !== 'literal') p[x.type] = +x.value;
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}
function zoneValide(tz: string) { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }
/* une valeur DTSTART / DTEND / EXDATE… → { t: heure murale de Zurich, jour: date seule ? } */
function lire(v: string, params: Record<string, string>): { t: number; jour: boolean } | null {
  v = v.trim();
  let m = /^(\d{4})(\d\d)(\d\d)$/.exec(v);
  if (m || params.VALUE === 'DATE') { m = m || /^(\d{4})(\d\d)(\d\d)/.exec(v); if (!m) return null; return { t: Date.UTC(+m[1], +m[2] - 1, +m[3]), jour: true }; }
  m = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)?(Z)?$/.exec(v); if (!m) return null;
  const w = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  if (m[7]) return { t: murale(w, TZ), jour: false };
  const tz = (params.TZID || '').replace(/^\/+/, '');
  if (!tz || tz === TZ || !zoneValide(tz)) return { t: w, jour: false };
  let u = w - (murale(w, tz) - w); u = w - (murale(u, tz) - u);  // heure murale de tz → instant → heure murale de Zurich
  return { t: murale(u, TZ), jour: false };
}
function duree(v: string): number {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim()); if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * ((+m[2] || 0) * 7 * JOUR + (+m[3] || 0) * JOUR + (+m[4] || 0) * 3600000 + (+m[5] || 0) * 60000 + (+m[6] || 0) * 1000);
}

/* ---------- répétitions (RRULE) : quotidien, hebdo (BYDAY), mensuel (BYMONTHDAY, BYDAY « 1MO », « -1FR »), annuel ---------- */
const JOURS: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
const lundiDe = (t: number) => { const d = new Date(t); const j = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - j * JOUR; };
function repetitions(debut: number, rr: string, jourSeul: boolean, fin: number): number[] {
  const R: Record<string, string> = {}; for (const x of rr.split(';')) { const k = x.indexOf('='); if (k > 0) R[x.slice(0, k).toUpperCase()] = x.slice(k + 1); }
  const freq = R.FREQ, pas = Math.max(1, +R.INTERVAL || 1), max = R.COUNT ? +R.COUNT : Infinity;
  let jusque = Infinity; if (R.UNTIL) { const u = lire(R.UNTIL, {}); if (u) jusque = u.jour ? u.t + JOUR - 1 : u.t; }
  const limite = Math.min(fin, jusque), heure = debut - Date.UTC(new Date(debut).getUTCFullYear(), new Date(debut).getUTCMonth(), new Date(debut).getUTCDate());
  const byday = (R.BYDAY || '').split(',').filter(Boolean), bymd = (R.BYMONTHDAY || '').split(',').filter(Boolean).map(Number);
  const out: number[] = []; let n = 0;
  const pousser = (t: number) => { if (t < debut) return true; if (t > limite || n >= max) return false; out.push(t); n++; return true; };
  const d0 = new Date(debut);
  for (let k = 0; k < 5000; k++) {
    if (freq === 'DAILY') { if (!pousser(debut + k * pas * JOUR)) break; }
    else if (freq === 'WEEKLY') {
      const sem = lundiDe(debut) + k * pas * 7 * JOUR; if (sem > limite) break;
      const js = byday.length ? byday.map((b) => JOURS[b.slice(-2)]).filter((x) => x !== undefined).sort((a, b) => a - b) : [(d0.getUTCDay() + 6) % 7];
      let go = true; for (const j of js) if (!pousser(sem + j * JOUR + heure)) { go = false; break; } if (!go) break;
    } else if (freq === 'MONTHLY') {
      const y = d0.getUTCFullYear(), mo = d0.getUTCMonth() + k * pas, debMois = Date.UTC(y, mo, 1); if (debMois > limite) break;
      const nbJ = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate(), dates: number[] = [];
      if (byday.length) for (const b of byday) {
        const m = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(b); if (!m) continue; const wd = JOURS[m[2]], ord = m[1] ? +m[1] : 0;
        const prem = ((wd - ((new Date(debMois).getUTCDay() + 6) % 7)) + 7) % 7 + 1, tous: number[] = []; for (let d = prem; d <= nbJ; d += 7) tous.push(d);
        if (!ord) dates.push(...tous); else { const d = ord > 0 ? tous[ord - 1] : tous[tous.length + ord]; if (d) dates.push(d); }
      } else for (const d of (bymd.length ? bymd : [d0.getUTCDate()])) { const dd = d < 0 ? nbJ + d + 1 : d; if (dd >= 1 && dd <= nbJ) dates.push(dd); }
      let go = true; for (const d of dates.sort((a, b) => a - b)) if (!pousser(Date.UTC(y, mo, d) + heure)) { go = false; break; } if (!go) break;
    } else if (freq === 'YEARLY') {
      const y = d0.getUTCFullYear() + k * pas; if (Date.UTC(y, 0, 1) > limite) break;
      const t = Date.UTC(y, d0.getUTCMonth(), d0.getUTCDate()); if (new Date(t).getUTCDate() !== d0.getUTCDate()) continue;  // 29 février
      if (!pousser(t + heure)) break;
    } else { pousser(debut); break; }
  }
  void jourSeul; return out;
}

const iso = (t: number, jour: boolean) => new Date(t).toISOString().slice(0, jour ? 10 : 16);
/* les évènements d'un calendrier qui touchent la fenêtre [de, a] (dates comprises) */
export function evenements(texte: string, de: string, a: string): Ev[] {
  const d0 = Date.parse(de + 'T00:00:00Z'), d1 = Date.parse(a + 'T00:00:00Z') + JOUR, out: Ev[] = [];
  const B = blocs(texte), remplaces = new Set<string>();
  for (const b of B) { const rid = b.find((p) => p.name === 'RECURRENCE-ID'), uid = b.find((p) => p.name === 'UID'); if (rid && uid) { const r = lire(rid.value, rid.params); if (r) remplaces.add(uid.value + '|' + r.t); } }
  for (const b of B) {
    const g = (n: string) => b.find((p) => p.name === n);
    if ((g('STATUS')?.value || '').toUpperCase() === 'CANCELLED') continue;
    const ds = g('DTSTART'); if (!ds) continue; const s = lire(ds.value, ds.params); if (!s) continue;
    const de_ = g('DTEND'), du = g('DURATION'); let e = de_ ? lire(de_.value, de_.params) : null;
    let long = e ? e.t - s.t : du ? duree(du.value) : (s.jour ? JOUR : 0); if (long < 0) long = 0;
    const titre = sansEchap(g('SUMMARY')?.value || '(sans titre)'), lieu = sansEchap(g('LOCATION')?.value || ''), note = texteLong(g('DESCRIPTION')?.value || ''), uid = g('UID')?.value || '';
    const exd = new Set<number>(); for (const p of b.filter((p) => p.name === 'EXDATE')) for (const v of p.value.split(',')) { const x = lire(v, p.params); if (x) exd.add(x.t); }
    const rr = g('RRULE'), rid = g('RECURRENCE-ID');
    const debuts = rr && !rid ? repetitions(s.t, rr.value, s.jour, d1) : [s.t];
    for (const t of debuts) {
      if (rr && !rid && (exd.has(t) || remplaces.has(uid + '|' + t))) continue;
      const f = t + long; if (!(t < d1 && (f > d0 || (long === 0 && t >= d0)))) continue;
      out.push({ titre, ...(lieu ? { lieu } : {}), ...(note ? { note } : {}), debut: iso(t, s.jour), fin: iso(s.jour ? Math.max(f, t + JOUR) : f, s.jour), journee: s.jour });
    }
    void e; e = null;
  }
  return out;
}

if (typeof Deno !== 'undefined') Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const auth = req.headers.get('Authorization') || '';
  if (!/^Bearer \S+/.test(auth)) return json({ erreur: 'non connecté' }, 401);
  const u = new URL(req.url), jourOk = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const auj = new Date().toISOString().slice(0, 10);
  const de = jourOk(u.searchParams.get('de')) ? u.searchParams.get('de')! : auj, a = jourOk(u.searchParams.get('a')) ? u.searchParams.get('a')! : new Date(Date.now() + 21 * JOUR).toISOString().slice(0, 10);
  if (Date.parse(a) - Date.parse(de) > 120 * JOUR || a < de) return json({ erreur: 'fenêtre trop grande' }, 400);
  const r = await fetch(`${SB}/rest/v1/locus_calendriers?select=id,nom,url,couleur&order=cree`, { headers: { apikey: CLE_PUBLIQUE, Authorization: auth } });
  if (!r.ok) return json({ erreur: r.status === 404 ? 'Lance d’abord supabase/calendriers.sql' : 'calendriers illisibles (' + r.status + ')' }, r.status === 401 ? 401 : 500);
  const cals: { id: string; nom: string; url: string; couleur?: string }[] = await r.json();
  const out: { ev: (Ev & { cal: string })[]; cals: { id: string; nom: string; couleur?: string; n: number }[]; erreurs: { cal: string; nom: string; message: string }[] } = { ev: [], cals: [], erreurs: [] };
  await Promise.all(cals.map(async (c) => {
    try {
      const ctl = new AbortController(), minut = setTimeout(() => ctl.abort(), 15000);
      const rep = await fetch(c.url.replace(/^webcal:/i, 'https:'), { signal: ctl.signal, headers: { Accept: 'text/calendar, */*' } }); clearTimeout(minut);
      if (!rep.ok) throw new Error('le lien répond ' + rep.status);
      const t = await rep.text(); if (!t.includes('BEGIN:VCALENDAR')) throw new Error('ce lien ne donne pas un calendrier');
      const E = evenements(t, de, a); out.ev.push(...E.map((e) => ({ ...e, cal: c.id }))); out.cals.push({ id: c.id, nom: c.nom, couleur: c.couleur, n: E.length });
    } catch (e) { out.erreurs.push({ cal: c.id, nom: c.nom, message: (e as Error).name === 'AbortError' ? 'pas de réponse' : String((e as Error).message || e) }); }
  }));
  out.ev.sort((x, y) => (x.debut < y.debut ? -1 : x.debut > y.debut ? 1 : 0));
  return json(out);
});
