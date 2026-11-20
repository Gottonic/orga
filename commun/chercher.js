/* Locus — la recherche commune (18.11.2026, demande de Nicolas : « le système de recherche dans toutes les apps »).
   Sur l'accueil : dans toutes les apps. Dans une app (loupe de l'en-tête, ajoutée par commun/cadre.js) : seulement
   les éléments de cette app. Chaque ligne prend les couleurs de son app.
   Usage : LocusChercher.ouvrir({ app: 'marche' | null, surClic: (item) => {} })
     item = { app, type, id, wk, t, s } ; sans surClic, l'élément s'ouvre dans l'app courante (bouton caché qui
     déclenche l'action de l'app : Établi « open », Bibliothèque « aller », Marché « art », Mine « mandat » / « contact »,
     Banque « data-tx », Forge onglets). Lecture seule, avec la session commune (orga-auth). */
(function () {
  'use strict';
  const SB_URL = 'https://rzcpjsffpvuvbdtqymms.supabase.co', SB_KEY = 'sb_publishable_mJNXDji0NMOmLFqo3GusGg_JBkFhJmC';
  const C = { /* couleurs des lieux (commun/lieux.css) : page, texte, texte 2, surface, ligne, accent, sur l'accent */
    locus: ['#4A4458', '#F3F1E7', '#C9C2D8', '#5A536A', '#6E6780', '#C3B6DF', '#2A2535'],
    etabli: ['#CDB893', '#262321', '#54493A', '#E9DDC6', '#B9A57F', '#2F2C29', '#F2C230'],
    banque: ['#15302A', '#F2ECDC', '#9DB3A9', '#1E3E36', '#2F5449', '#D6B15E', '#1E1606'],
    forge: ['#1A1714', '#EFE3CC', '#8F8372', '#25201C', '#3D352E', '#8DBA88', '#1A1714'],
    marche: ['#D7E6C3', '#1E3324', '#4F6650', '#F8F5EA', '#BFD1A8', '#B83C28', '#FFF5EE'],
    mine: ['#DCE1E6', '#1D2833', '#53606D', '#F7F9FB', '#C3CAD2', '#4E3A86', '#F6F2FF'],
    bibliotheque: ['#6E2733', '#F9E9E4', '#E0B9B6', '#5E1F2A', '#8A4450', '#E8C27A', '#3A1A10']
  };
  const NOMS = { etabli: 'l’Établi', banque: 'la Banque', forge: 'la Forge', marche: 'le Marché', mine: 'la Mine', bibliotheque: 'la Bibliothèque' };
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plain = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  const wkNum = (k) => Number(String(k).split('-W')[1]);
  const fDate = (d) => { const a = String(d || '').slice(0, 10).split('-').map(Number); if (a.length < 3 || !a[0]) return ''; return a[2] + ' ' + MOIS[a[1] - 1] + ' ' + a[0]; };
  const chf = (x) => 'CHF ' + (Math.round((+x || 0) * 100) / 100).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  /* surligner en ignorant accents et ligatures : on retrouve la place dans le texte d'origine */
  function marque(t, q) {
    const s = String(t || ''); const map = []; let pl = '';
    for (let i = 0; i < s.length; i++) { const c = plain(s[i]); for (let k = 0; k < c.length; k++) map.push(i); pl += c; }
    const i = pl.indexOf(q); if (i < 0 || !q) return esc(s); const a = map[i], z = map[i + q.length - 1] + 1;
    return esc(s.slice(0, a)) + '<mark>' + esc(s.slice(a, z)) + '</mark>' + esc(s.slice(z));
  }
  /* filtre « ou » de Supabase : chaque champ, avec et sans ligature (oeuf → œuf) */
  function ouIlike(champs, brut) {
    const v = brut.trim().replace(/[%_,()"\\]/g, ' ').trim(); const vs = [...new Set([v, v.replace(/oe/gi, 'œ'), v.replace(/ae/gi, 'æ')])];
    return champs.flatMap((c) => vs.map((x) => `${c}.ilike."%${x}%"`)).join(',');
  }
  let sb = null, PB = null, uid = null;
  async function pret() {
    if (!sb && window.supabase && window.supabase.createClient) sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: false, storageKey: 'orga-auth' } });
    if (sb && !uid) { try { const s = (await sb.auth.getSession()).data.session; uid = s && s.user ? s.user.id : null; } catch (e) {} }
    if (uid && !PB && window.Projets) { PB = Projets.base(sb, uid); PB.tirer(); }
  }
  function forgeSemaines() { try { const f = JSON.parse(localStorage.getItem('locus-forge') || 'null'); return (f && f.semaines) || null; } catch (e) { return null; } }

  /* le moteur : la liste des éléments trouvés, dans l'ordre d'affichage */
  async function trouver(brut, app) {
    const q = plain(brut).trim(), R = [], dans = (a) => !app || app === a;
    if (q.length < 2) return R;
    if (dans('etabli') && PB) {
      PB.liste().filter((p) => plain(p.name).includes(q)).slice(0, 8).forEach((p) => R.push({ app: 'etabli', type: 'projet', id: p.id, e: p.emoji, t: p.name, s: (window.Projets && Projets.ETATS[Projets.etat(p)]) || '' }));
      PB.domaines().filter((d) => plain(d.name).includes(q)).slice(0, 4).forEach((d) => R.push({ app: 'etabli', type: 'domaine', id: d.id, e: d.emoji, t: d.name, s: 'Domaine' }));
      const T = []; [...PB.liste(), ...PB.domaines()].forEach((p) => { if (p.closed) return; Projets.tachesSeules(p.tasks).forEach((x) => { if (plain(x.t).includes(q)) T.push({ p, x }); }); });
      T.slice(0, 10).forEach(({ p, x }) => R.push({ app: 'etabli', type: Projets.estDomaine(p) ? 'domaine' : 'projet', id: p.id, t: x.t, s: (x.d ? 'Tâche faite · ' : 'Tâche · ') + (p.emoji ? p.emoji + ' ' : '') + p.name }));
    }
    const fs = dans('forge') ? forgeSemaines() : null;
    if (fs) { const vu = new Set(); Object.entries(fs).forEach(([wk, L]) => (L || []).forEach((x) => { if (!vu.has(x.t) && plain(x.t).includes(q)) { vu.add(x.t); R.push({ app: 'forge', type: 'seance', id: x.id, wk, t: x.t, s: 'Séance · S' + wkNum(wk) + (typeof x.day === 'number' ? ' · ' + JOURS[x.day] : '') }); } })); }
    const req = [];
    if (sb && uid) {
      if (dans('bibliotheque')) req.push(['notes', sb.from('biblio_rows').select('key,data').like('key', 'n:%').eq('deleted', false).or(ouIlike(['data->>t', 'data->>d'], brut)).limit(25)]);
      if (dans('mine')) { req.push(['mands', sb.from('mine_rows').select('key,data').like('key', 'm:%').eq('deleted', false).or(ouIlike(['data->>nom'], brut)).limit(8)]);
        req.push(['conts', sb.from('mine_rows').select('key,data').like('key', 'c:%').eq('deleted', false).or(ouIlike(['data->>nom', 'data->>org'], brut)).limit(6)]); }
      if (dans('marche')) req.push(['arts', sb.from('marche_rows').select('key,data').eq('deleted', false).or(ouIlike(['data->>nom'], brut)).limit(12)]);
      if (dans('forge')) req.push(['exos', sb.from('carnet').select('key,data').like('key', 'exos/%').eq('deleted', false).or(ouIlike(['data->>name'], brut)).limit(8)]);
      if (dans('banque')) req.push(['ops', sb.from('cash_rows').select('key,data').like('key', 't:%').eq('deleted', false).or(ouIlike(['data->>tiers', 'data->>note'], brut)).limit(app ? 25 : 12)]);
    }
    const D = {};
    try { const rs = await Promise.all(req.map((x) => x[1])); rs.forEach((r, i) => { D[req[i][0]] = ((r && r.data) || []).filter((x) => x && x.data).map((x) => Object.assign({ _k: x.key }, x.data)); }); } catch (e) {}
    const ou = (n) => { const p = String(n.p || ''); if (p === 'vide') return 'Vide-tête'; if (p === 'taches') return n.m2 ? 'Tâches · 2 min' : 'Tâches'; if (p.startsWith('j:')) return 'Journal S' + wkNum(p.slice(2));
      if (p.startsWith('p:')) { const x = PB && PB.get(p.slice(2)); return x ? 'Notes · ' + x.name : 'Notes'; } if (p.startsWith('d:')) { const x = PB && PB.domaine(p.slice(2)); return x ? 'Notes · ' + x.name : 'Notes'; } return 'Notes'; };
    (D.notes || []).forEach((n) => { const ent = plain(n.t).includes(q); R.push({ app: 'bibliotheque', type: 'ligne', id: n.id, t: n.t || '…', sm: ent ? '' : n.d, s: ou(n) + (n.a ? ' · archivée' : '') }); });
    (D.mands || []).forEach((m) => R.push({ app: 'mine', type: 'mandat', id: m.id, t: m.nom, s: 'Mandat' }));
    (D.conts || []).forEach((c) => R.push({ app: 'mine', type: 'contact', id: c.id, t: c.org || c.nom || '', s: 'Contact' + (c.org && c.nom ? ' · ' + c.nom : '') }));
    (D.arts || []).filter((x) => /^[ae]:/.test(x._k)).forEach((x) => R.push({ app: 'marche', type: 'article', id: x.id, t: x.nom, s: x._k.startsWith('e:') ? 'Envie' : x.liste ? 'Sur la liste' : 'Article' }));
    (D.exos || []).forEach((x) => R.push({ app: 'forge', type: 'exo', id: x._k.slice(5), t: x.name, s: 'Exercice' }));
    (D.ops || []).sort((a, b) => String(b.date).localeCompare(String(a.date))).forEach((t) => { const ent = plain(t.tiers).includes(q);
      R.push({ app: 'banque', type: 'op', id: t.id, t: t.tiers || t.note || 'Opération', sm: ent || !t.tiers ? '' : t.note, s: [fDate(t.date), t.montant != null ? chf(Math.abs(t.montant)) : '', ent && t.note ? t.note : ''].filter(Boolean).join(' · ') }); });
    return R;
  }

  /* ouvrir un élément dans l'app courante : un bouton caché déclenche l'action que l'app connaît déjà */
  function ouvrirIci(x) {
    const b = document.createElement('button'); b.type = 'button'; b.hidden = true;
    if (x.app === 'etabli' && x.type === 'projet') { b.dataset.act = 'open'; b.dataset.id = x.id; }
    else if (x.app === 'etabli' && x.type === 'domaine') { b.dataset.act = 'open'; b.dataset.id = x.id; }
    else if (x.app === 'bibliotheque') { b.dataset.act = 'aller'; b.dataset.id = x.id; }
    else if (x.app === 'marche') { b.dataset.act = 'art'; b.dataset.id = x.id; }
    else if (x.app === 'mine') { b.dataset.act = x.type === 'contact' ? 'contact' : 'mandat'; b.dataset.id = x.id; }
    else if (x.app === 'banque') { b.dataset.tx = x.id; }
    else if (x.app === 'forge') { const t = document.querySelector('#tabs [data-view="' + (x.type === 'exo' ? 'exos' : 'semaine') + '"]'); if (t) t.click(); return; }
    document.body.appendChild(b); b.click(); b.remove();
  }

  let $o = null, minut = null, opts = {};
  const CSS = (L) => { const c = C[L] || C.locus; return `
#locus-chercher{position:fixed;inset:0;z-index:2147482000;background:${c[0]};color:${c[1]};display:flex;flex-direction:column;font-family:"Space Grotesk",system-ui,sans-serif;font-size:15px;line-height:1.45;color-scheme:${['banque', 'forge', 'bibliotheque', 'locus'].includes(L) ? 'dark' : 'light'}}
#locus-chercher *{box-sizing:border-box}
#locus-chercher header{flex:none;display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 6px) 10px 6px;background:color-mix(in srgb,${c[0]} 88%,#000)}
#locus-chercher header h2{margin:0;flex:1;font:700 15px/1.2 "Unbounded","Space Grotesk",sans-serif;letter-spacing:-.02em}
#locus-chercher .x{all:unset;width:42px;height:44px;display:grid;place-items:center;cursor:pointer;color:inherit}
#locus-chercher .corps{flex:1;overflow:auto;padding:16px max(16px,env(safe-area-inset-right,0px)) 24px max(16px,env(safe-area-inset-left,0px));max-width:760px;width:100%;margin:0 auto;display:flex;flex-direction:column;gap:14px}
#locus-chercher input{height:48px;border-radius:99px;border:1px solid ${c[4]};background:${c[3]};color:${c[1] === '#F2ECDC' || c[1] === '#EFE3CC' || c[1] === '#F3F1E7' ? c[1] : c[1]};padding:0 18px;font:inherit;font-size:16px;width:100%}
#locus-chercher .note{margin:0;color:${c[2]};font-size:13px}
#locus-chercher ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
#locus-chercher li button{all:unset;box-sizing:border-box;width:100%;display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:12px;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(127,127,127,.18)}
#locus-chercher li .t{display:block}
#locus-chercher li small{font-size:12px}
#locus-chercher mark{border-radius:3px;padding:0 1px}
${Object.entries(C).map(([k, v]) => `#locus-chercher li[data-l="${k}"] button{background:${v[0]};color:${v[1]}}#locus-chercher li[data-l="${k}"] small{color:${v[2]}}#locus-chercher li[data-l="${k}"] mark{background:${v[5]};color:${v[6]}}`).join('\n')}
#locus-chercher li[data-l="${L}"] button{background:${c[3]};${L === 'bibliotheque' ? 'color:#2E1418' : ''}}${L === 'bibliotheque' ? '#locus-chercher li[data-l="bibliotheque"] small{color:#795359}' : ''}`; };
  function fermer() { if (!$o) return; $o.remove(); $o = null; document.documentElement.style.overflow = ''; }
  async function ouvrir(o) {
    opts = o || {}; const app = opts.app || null, L = app || 'locus'; fermer();
    $o = document.createElement('div'); $o.id = 'locus-chercher'; $o.setAttribute('role', 'dialog'); $o.setAttribute('aria-label', 'Chercher');
    $o.innerHTML = `<style>${CSS(L)}</style><header><button type="button" class="x" data-x aria-label="Fermer"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"><path d="M4 4l12 12M16 4 4 16"/></svg></button><h2>${app ? 'Chercher dans ' + esc(NOMS[app] || app) : 'Chercher partout'}</h2></header>
      <div class="corps"><input type="search" placeholder="${app ? 'Un mot…' : 'Un mot : projet, note, mandat, article…'}" autocomplete="off" aria-label="Chercher" enterkeyhint="search"><div class="r"><p class="note">Au moins deux lettres.</p></div></div>`;
    document.body.appendChild($o); document.documentElement.style.overflow = 'hidden';
    const i = $o.querySelector('input'), $r = $o.querySelector('.r'); let R = [];
    setTimeout(() => i.focus(), 30);
    $o.querySelector('[data-x]').addEventListener('click', fermer);
    $o.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermer(); });
    i.addEventListener('input', () => { clearTimeout(minut); const v = i.value; minut = setTimeout(async () => {
      const q = plain(v).trim(); if (q.length < 2) { $r.innerHTML = '<p class="note">Au moins deux lettres.</p>'; return; }
      await pret(); const L2 = await trouver(v, app); if (!$o || plain(i.value).trim() !== q) return; R = L2;
      $r.innerHTML = R.length ? '<ul>' + R.map((x, k) => `<li data-l="${x.app}"><button type="button" data-k="${k}"><span class="t">${x.e ? esc(x.e) + ' ' : ''}${marque(x.t, q)}</span><small>${x.sm ? marque(x.sm, q) + ' · ' : ''}${esc(x.s || '')}</small></button></li>`).join('') + '</ul>' : '<p class="note">Rien trouvé.</p>';
    }, 250); });
    $r.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; const x = R[+b.dataset.k]; if (!x) return; fermer(); if (opts.surClic) opts.surClic(x); else ouvrirIci(x); });
    pret();
  }
  window.LocusChercher = { ouvrir, fermer, trouver, marque, plain };
})();
