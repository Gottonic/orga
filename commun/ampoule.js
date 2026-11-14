/* ORGA — l'ampoule 💡 : noter un bug ou une idée, dans chaque app et sur l'accueil.

   Dans une page :
     <script src="../commun/ampoule.js" data-app="forge" data-avant="#gear" data-classe="gear"></script>
   - data-app     : orga | etabli | banque | forge | marche | mine (à quelle app appartiennent les idées notées ici)
   - data-avant / data-apres : à côté de quel élément placer le bouton 💡 (sélecteur CSS),
     ou bien un élément [data-ampoule] déjà présent dans la page
   - data-classe  : classe(s) du bouton, pour qu'il prenne le style de l'app ; data-taille : taille de l'émoji

   Données : table Supabase « idees » (une ligne par idée, colonne « app »), même connexion que les apps
   (clé « orga-auth »). Copie locale « orga-idees » : on peut noter hors ligne, l'envoi se fait dès que possible.
   Une idée : { titre, type: 'bug' | 'idee', details, cree, fait?, faitLe?, captures?: [{ id, w, h, path? }] }
   — cochée = faite, elle quitte la liste ; un mois après, elle est effacée pour de bon (avec ses captures).
   Captures d'écran : collées (Ctrl+V), glissées ou choisies, réduites à 1600 px (WebP), gardées sur l'appareil
   (cache « idees-media ») puis envoyées dans le dossier privé « idees » de Supabase (<utilisateur>/<id>.webp). */
(function () {
  'use strict';
  const ME = document.currentScript;
  const D = (ME && ME.dataset) || {};
  const APP = D.app || 'orga';
  const SB_URL = 'https://rzcpjsffpvuvbdtqymms.supabase.co', SB_KEY = 'sb_publishable_mJNXDji0NMOmLFqo3GusGg_JBkFhJmC';
  const TABLE = 'idees', LS = 'orga-idees';
  const APPS = { orga: 'Locus', etabli: 'L’Établi', banque: 'La Banque', forge: 'La Forge', marche: 'Le Marché', mine: 'La Mine' };
  const TYPES = [['bug', '🐞', 'Bug'], ['idee', '💡', 'Idée']];
  const ATK = '"Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",sans-serif';
  const PAPIER = { f: '#F3F1E7', c: '#FFFFFF', i: '#1E1E1E', m: '#6B6A62', l: '#CFCCBF', a: '#3C3C3C', ai: '#FFFFFF', s: '#FFECB0', r: '0px', p: '0px', font: ATK, titre: ATK };
  const THEMES = {
    orga: Object.assign({}, PAPIER, { a: '#4A4458', ai: '#F3F1E7' }),
    etabli: PAPIER,
    banque: { f: '#F4F5F7', c: '#FFFFFF', i: '#17181B', m: '#5C6270', l: '#E2E5EA', a: '#F0B54A', ai: '#1A1406', s: '#FBEFD6', r: '20px', p: '99px', font: ATK, titre: '"Bricolage Grotesque",' + ATK },
    marche: { f: '#F5EEDF', c: '#FFFCF5', i: '#24211B', m: '#6F6656', l: '#E6DBC6', a: '#2E6B4E', ai: '#FFFFFF', s: '#E2EEE4', r: '14px', p: '99px', font: ATK, titre: ATK },
    mine: { f: '#ECE7DF', c: '#FFFFFF', i: '#2B2420', m: '#6E655C', l: '#D8D0C4', a: '#2B2420', ai: '#FFFFFF', s: '#F6E7CC', r: '0px', p: '0px', font: ATK, titre: '"Big Shoulders Stencil Display",' + ATK },
    forge: { f: '#1A1714', c: '#25201C', i: '#EFE3CC', m: '#8F8372', l: '#3D352E', a: '#E0A15E', ai: '#1A1714', s: '#3A2C1F', r: '22px', p: '99px', font: '"Space Grotesk",system-ui,sans-serif', titre: 'Unbounded,"Space Grotesk",sans-serif', sombre: true }
  };
  const T = THEMES[APP] || PAPIER;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- copie locale (partagée par toutes les apps : même origine) ---------- */
  function load() {
    try { const x = JSON.parse(localStorage.getItem(LS) || 'null'); if (x && x.rows) return { rows: x.rows, dirty: new Set(x.dirty || []), last: x.last || null, effacer: x.effacer || [] }; } catch (e) {}
    return { rows: {}, dirty: new Set(), last: null, effacer: [] };
  }
  function save(S) { try { localStorage.setItem(LS, JSON.stringify({ rows: S.rows, dirty: [...S.dirty], last: S.last, effacer: S.effacer || [] })); } catch (e) {} }
  function modifier(key, fn) { const S = load(); const r = S.rows[key] || { app: APP, data: {}, deleted: false }; fn(r); S.rows[key] = r; S.dirty.add(key); save(S); }
  const liste = (app) => { const S = load(); return Object.entries(S.rows).filter(([, r]) => !r.deleted && r.data && (!app || r.app === app))
    .map(([key, r]) => Object.assign({ key, app: r.app }, r.data)).sort((a, b) => String(b.cree || '').localeCompare(String(a.cree || ''))); };
  const capsAttente = (S) => Object.values(S.rows).some((r) => !r.deleted && r.data && (r.data.captures || []).some((c) => !c.path));
  const aFaire = () => { const S = load(); return S.dirty.size || S.effacer.length || capsAttente(S); };
  const nouvelleCle = () => 'idee:' + APP + ':' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- captures d'écran ---------- */
  const BUCKET = 'idees', MEDIA = 'idees-media', MAXCAP = 6, MAXPX = 1600;
  const cleLocale = (id) => new URL('__idees/' + id, ME.src).href;
  const enMemoire = new Map(), urls = new Map();
  async function preparer(file) {
    let src = null;
    try { src = await createImageBitmap(file); } catch (e) {
      src = await new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ko; im.src = URL.createObjectURL(file); });
    }
    const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight, k = Math.min(1, MAXPX / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h); g.drawImage(src, 0, 0, w, h);
    let blob = await new Promise((ok) => cv.toBlob(ok, 'image/webp', 0.82));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.85));
    return { blob, w, h };
  }
  async function garderLocal(id, blob) { enMemoire.set(id, blob); try { const c = await caches.open(MEDIA); await c.put(cleLocale(id), new Response(blob, { headers: { 'content-type': blob.type } })); } catch (e) {} }
  async function lireLocal(id) {
    if (enMemoire.has(id)) return enMemoire.get(id);
    try { const c = await caches.open(MEDIA); const r = await c.match(cleLocale(id)); return r ? await r.blob() : null; } catch (e) { return null; }
  }
  async function oublierLocal(id) {
    enMemoire.delete(id); try { const c = await caches.open(MEDIA); await c.delete(cleLocale(id)); } catch (e) {}
    const u = urls.get(id); if (u) { URL.revokeObjectURL(u); urls.delete(id); }
  }
  /* retire des captures : l'image part de l'appareil, et de Supabase si elle y était déjà */
  function oublierCaptures(S, caps) { (caps || []).forEach((c) => { oublierLocal(c.id); if (c.path && !S.effacer.includes(c.path)) S.effacer.push(c.path); }); }
  async function urlDe(cap) {
    if (urls.has(cap.id)) return urls.get(cap.id);
    const b = await blobDe(cap);
    if (!b) return null;
    const u = URL.createObjectURL(b); urls.set(cap.id, u); return u;
  }
  async function blobDe(cap) {
    let b = await lireLocal(cap.id);
    if (!b && cap.path && navigator.onLine) {
      const c = await connecte();
      if (c) { try { const { data } = await c.storage.from(BUCKET).download(cap.path); if (data) { b = data; garderLocal(cap.id, data); } } catch (e) {} }
    }
    return b;
  }
  /* une idée faite depuis plus d'un mois est effacée, ses captures aussi */
  const GARDE_FAITES = 31 * 864e5;
  function purger() {
    const S = load(), lim = Date.now() - GARDE_FAITES; let n = 0;
    for (const [k, r] of Object.entries(S.rows)) {
      if (r.deleted || !r.data || !r.data.fait || !r.data.faitLe) continue;
      if (!(Date.parse(r.data.faitLe) < lim)) continue;
      oublierCaptures(S, r.data.captures); r.deleted = true; S.dirty.add(k); n++;
    }
    if (n) save(S);
    return n;
  }
  async function envoyerCaptures(c) {
    const S0 = load();
    if (S0.effacer.length) {
      const lot = S0.effacer.slice(0, 100); const { error } = await c.storage.from(BUCKET).remove(lot);
      if (!error) { const S = load(); S.effacer = S.effacer.filter((x) => !lot.includes(x)); save(S); }
    }
    if (!capsAttente(S0)) return;
    const { data } = await c.auth.getSession(); const uid = data && data.session && data.session.user.id; if (!uid) return;
    for (const [key, r] of Object.entries(S0.rows)) {
      if (r.deleted || !r.data) continue;
      for (const cap of r.data.captures || []) {
        if (cap.path) continue;
        const b = await lireLocal(cap.id); if (!b) continue;
        const path = uid + '/' + cap.id + (b.type === 'image/webp' ? '.webp' : b.type === 'image/png' ? '.png' : '.jpg');
        const { error } = await c.storage.from(BUCKET).upload(path, b, { contentType: b.type, upsert: true });
        if (error) throw Object.assign(new Error(String(error.message || error.error || 'envoi')), { capture: true });
        modifier(key, (rr) => { (rr.data.captures || []).forEach((x) => { if (x.id === cap.id) x.path = path; }); });
      }
    }
  }

  /* ---------- synchro avec Supabase ---------- */
  let sb = null, etat = '', etatCap = '', chargement = null;
  function lib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(true);
    if (!chargement) chargement = new Promise((ok) => { const s = document.createElement('script'); s.src = new URL('supabase.js', ME.src).href; s.onload = () => ok(true); s.onerror = () => ok(false); document.head.appendChild(s); });
    return chargement;
  }
  async function client() {
    if (sb) return sb;
    if (!(await lib())) return null;
    /* même session que les apps ; c'est l'app qui la renouvelle, la bibliothèque évite les doublons (verrou) */
    sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { storageKey: 'orga-auth', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false } });
    return sb;
  }
  async function connecte() { const c = await client(); if (!c) return null; try { const { data } = await c.auth.getSession(); return data && data.session ? c : null; } catch (e) { return null; } }
  async function envoyer(c) {
    const S = load(); if (!S.dirty.size) return;
    const keys = [...S.dirty].filter((k) => S.rows[k]);
    const avant = JSON.stringify(keys.map((k) => S.rows[k]));
    const { error } = await c.from(TABLE).upsert(keys.map((k) => ({ key: k, app: S.rows[k].app, data: S.rows[k].data, deleted: !!S.rows[k].deleted })), { onConflict: 'user_id,key' });
    if (error) throw error;
    const S2 = load(); if (JSON.stringify(keys.map((k) => S2.rows[k])) === avant) { keys.forEach((k) => S2.dirty.delete(k)); save(S2); }
  }
  async function recevoir(c) {
    let q = c.from(TABLE).select('key,app,data,deleted,updated_at').order('updated_at').limit(2000);
    const S0 = load(); if (S0.last) q = q.gte('updated_at', S0.last);
    const { data, error } = await q; if (error) throw error;
    const S = load();
    for (const r of data || []) { if (!S.dirty.has(r.key)) S.rows[r.key] = { app: r.app, data: r.data, deleted: r.deleted }; if (!S.last || r.updated_at > S.last) S.last = r.updated_at; }
    save(S);
  }
  let enCours = null;
  function sync() {
    if (enCours) return enCours;
    enCours = (async () => {
      try {
        purger();
        if (!navigator.onLine) { etat = 'horsligne'; return; }
        const c = await connecte(); if (!c) { etat = 'login'; return; }
        await envoyer(c); await recevoir(c);
        try { await envoyerCaptures(c); if (load().dirty.size) await envoyer(c); etatCap = ''; }
        catch (e) { etatCap = /bucket|not found|404/i.test(String(e && e.message)) ? 'dossier' : navigator.onLine ? 'erreur' : 'horsligne'; }
        etat = etatCap || (aFaire() ? 'attente' : 'ok');
      } catch (e) {
        const m = String((e && (e.message || e.code)) || e);
        etat = /idees|PGRST205|42P01|schema cache/i.test(m) ? 'table' : navigator.onLine ? 'erreur' : 'horsligne';
      } finally { enCours = null; if (ouvert) dessiner(); }
    })();
    return enCours;
  }
  addEventListener('online', () => { if (aFaire()) sync(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ouvert) sync(); else if (document.visibilityState === 'hidden' && aFaire()) sync(); });

  /* ---------- fenêtre ---------- */
  let host = null, root = null, ouvert = false, bouton = null;
  const V = { type: 'idee', faites: false, edit: null, tout: false, attente: [] };
  const fin = () => matchMedia('(pointer:fine)').matches;
  const CSS = `:host{all:initial}
*{box-sizing:border-box;margin:0}
.scrim{position:fixed;inset:0;z-index:2147483000;background:rgba(15,15,15,.38);display:flex;align-items:flex-end;justify-content:center;
  --f:${T.f};--c:${T.c};--i:${T.i};--m:${T.m};--l:${T.l};--a:${T.a};--ai:${T.ai};--s:${T.s};--r:${T.r};--p:${T.p}}
.sheet{width:min(560px,100%);max-height:min(88vh,100%);overflow:auto;overscroll-behavior:contain;background:var(--f);color:var(--i);font:15px/1.45 ${T.font};
  border-radius:var(--r) var(--r) 0 0;box-shadow:0 -6px 30px rgba(0,0,0,.18);
  padding:16px max(16px,env(safe-area-inset-right,0px)) calc(18px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));display:flex;flex-direction:column;gap:12px}
@media (min-width:700px){.scrim{align-items:center;padding:24px}.sheet{border-radius:var(--r)}}
.head{display:flex;align-items:flex-start;gap:10px}
.head h2{flex:1;font:700 1.2rem/1.2 ${T.titre};letter-spacing:-.01em}
.head .sous{display:block;font:400 .85rem/1.3 ${T.font};color:var(--m);margin-top:3px}
button{font:inherit;color:inherit;cursor:pointer}
.x{border:0;background:transparent;font-size:1.3rem;line-height:1;padding:4px 6px;color:var(--m)}
.chips,.seg{display:flex;gap:6px;flex-wrap:wrap}
.chip{border:1px solid var(--l);background:var(--c);border-radius:var(--p);padding:6px 12px;font-size:.92rem}
.chip.on{background:var(--s);border-color:var(--i);font-weight:700}
.ajout{display:flex;gap:8px}
input[type=text],textarea{width:100%;font:inherit;color:var(--i);background:var(--c);border:1px solid var(--l);border-radius:calc(var(--r) * .6);padding:10px 12px;outline:none}
input[type=text]:focus,textarea:focus{border-color:var(--i)}
textarea{resize:vertical;min-height:70px}
.plus{flex:none;width:46px;border:0;background:var(--a);color:var(--ai);border-radius:calc(var(--r) * .6);font-size:1.4rem;font-weight:700}
.btn{border:1px solid var(--l);background:var(--c);border-radius:var(--p);padding:9px 14px;font-size:.92rem}
.btn.prim{background:var(--a);border-color:var(--a);color:var(--ai);font-weight:700}
.btn.danger{color:${T.sombre ? '#E8505B' : '#B23A2B'}}
.sheet{color-scheme:${T.sombre ? 'dark' : 'light'}}${T.sombre ? '.scrim{background:rgba(10,8,6,.66)}' : ''}
.lien{border:0;background:transparent;padding:4px 0;color:var(--m);text-decoration:underline;text-underline-offset:3px;font-size:.88rem}
details summary{color:var(--m);font-size:.88rem;cursor:pointer;list-style:none}
details summary::-webkit-details-marker{display:none}
details[open] summary{margin-bottom:6px}
.liste{display:flex;flex-direction:column;border:1px solid var(--l);border-radius:calc(var(--r) * .6);background:var(--c);overflow:hidden}
.ligne{display:flex;align-items:center;gap:10px;padding:4px 10px;border-top:1px solid var(--l)}
.ligne:first-child{border-top:0}
.ligne input{width:20px;height:20px;flex:none;accent-color:${T.a === '#D6E0FF' ? '#4F6EF7' : T.a};margin:0}
.ligne .t{flex:1;min-width:0;border:0;background:transparent;text-align:left;padding:9px 0;display:flex;flex-direction:column}
.ligne .t small{color:var(--m);font-size:.8rem}
.ligne.fait .t span{text-decoration:line-through;color:var(--m)}
.vide{color:var(--m);padding:6px 0}
.app{font:700 .78rem/1 ${T.font};text-transform:uppercase;letter-spacing:.08em;color:var(--m);margin:6px 0 -4px}
.pied{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.etat{font-size:.8rem;color:var(--m)}
.champ{display:flex;flex-direction:column;gap:5px}
.champ>span{font-size:.85rem;color:var(--m)}
.fin{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.fin .danger{margin-right:auto}
.caps{display:flex;gap:8px;flex-wrap:wrap}
.caps:empty{display:none}
.cap{position:relative;width:76px;height:76px;flex:none;border:1px solid var(--l);border-radius:calc(var(--r) * .4);overflow:hidden;background:var(--c)}
.cap button.voir{display:block;width:100%;height:100%;padding:0;border:0;background:transparent;cursor:zoom-in}
.cap img{width:100%;height:100%;object-fit:cover;display:block}
.cap .retirer{position:absolute;top:3px;right:3px;width:24px;height:24px;border-radius:12px;border:0;background:rgba(0,0,0,.62);color:#fff;font-size:13px;line-height:24px;padding:0}
.joindre{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:.88rem;color:var(--m)}
.joindre label{color:var(--m);text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:4px 0}
.joindre input{display:none}
.sheet.depot{outline:3px dashed var(--i);outline-offset:-8px}
.zoom{position:fixed;inset:0;z-index:3;background:rgba(10,10,10,.9);display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out}
.zoom img{max-width:100%;max-height:100%;object-fit:contain;background:#fff}
.zoom[hidden]{display:none}
:focus-visible{outline:2px solid var(--i);outline-offset:2px}`;

  const ETATS = { ok: '✓ Enregistré', attente: '↻ En attente d\'envoi', horsligne: 'Hors ligne : envoi dès le retour du réseau', login: 'Pas connecté : ouvre une app pour te connecter', table: 'La table « idees » manque : lance supabase/orga.sql', dossier: 'Captures gardées sur l\'appareil : le dossier « idees » manque, lance supabase/orga.sql', erreur: '⚠ Envoi impossible pour l\'instant' };
  const capHtml = (c) => `<span class="cap"><button type="button" class="voir" data-act="zoom" data-id="${esc(c.id)}" aria-label="Voir la capture"><img data-cap="${esc(c.id)}" alt=""></button><button type="button" class="retirer" data-act="capRetirer" data-id="${esc(c.id)}" aria-label="Retirer la capture">✕</button></span>`;
  const joindreHtml = (n) => n >= MAXCAP ? '' : `<div class="joindre"><label>📎 Joindre une capture<input type="file" accept="image/*" multiple data-fichier></label>${fin() ? '<span>ou colle-la ici (Ctrl+V)</span>' : ''}</div>`;
  const typeDe = (x) => TYPES.find((t) => t[0] === x.type) || TYPES[1];
  const fmt = (iso) => { try { return new Date(iso).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } };
  function ligne(x) {
    const t = typeDe(x);
    return `<div class="ligne${x.fait ? ' fait' : ''}"><input type="checkbox" data-fait="${esc(x.key)}"${x.fait ? ' checked' : ''} aria-label="Fait : ${esc(x.titre)}">
      <button type="button" class="t" data-voir="${esc(x.key)}"><span>${t[1]} ${esc(x.titre)}</span><small>${fmt(x.cree)}${x.details ? ' · 📝' : ''}${(x.captures || []).length ? ' · 📷 ' + x.captures.length : ''}</small></button></div>`;
  }
  function vueListe() {
    const tout = APP === 'orga' && V.tout;
    const l = liste(tout ? null : APP), ouv = l.filter((x) => !x.fait), faites = l.filter((x) => x.fait);
    let corps;
    if (tout) {
      const ordre = ['orga', 'etabli', 'banque', 'forge', 'marche', 'mine'].concat([...new Set(ouv.map((x) => x.app))].filter((a) => !APPS[a]));
      const groupes = ordre.map((a) => [a, ouv.filter((x) => x.app === a)]).filter(([, g]) => g.length);
      corps = groupes.length ? groupes.map(([a, g]) => `<p class="app">${esc(APPS[a] || a)} · ${g.length}</p><div class="liste">${g.map(ligne).join('')}</div>`).join('') : '<p class="vide">Rien en attente, dans aucune app. 🌿</p>';
    } else corps = ouv.length ? `<div class="liste">${ouv.map(ligne).join('')}</div>` : '<p class="vide">Rien en attente. 🌿</p>';
    return `<div class="head"><h2>💡 Bugs et idées<span class="sous">${tout ? 'Toutes les apps' : esc(APPS[APP] || APP) + ' · ce qui ne marche pas, ce qui manque'}</span></h2><button type="button" class="x" data-act="fermer" aria-label="Fermer">✕</button></div>
      ${APP === 'orga' ? `<div class="seg"><button type="button" class="chip${!V.tout ? ' on' : ''}" data-act="vue" data-tout="0">Locus</button><button type="button" class="chip${V.tout ? ' on' : ''}" data-act="vue" data-tout="1">Toutes les apps</button></div>` : ''}
      ${tout ? '' : `<form class="ajout-form" data-form="ajout"><div class="chips">${TYPES.map(([k, e, n]) => `<button type="button" class="chip${V.type === k ? ' on' : ''}" data-act="type" data-k="${k}">${e} ${n}</button>`).join('')}</div>
        <div class="ajout" style="margin-top:8px"><input type="text" name="titre" id="titre" placeholder="${V.type === 'bug' ? 'Ce qui ne marche pas…' : 'Ton idée, une nouvelle fonction…'}" autocomplete="off" enterkeyhint="done" aria-label="Titre"><button class="plus" type="submit" aria-label="Ajouter">+</button></div>
        <div class="caps" style="margin-top:8px">${V.attente.map(capHtml).join('')}</div>${joindreHtml(V.attente.length)}
        <details style="margin-top:4px"><summary>+ Détails</summary><textarea name="details" rows="3" placeholder="Détails (facultatif)"></textarea></details></form>`}
      ${corps}
      <div class="pied"><span class="etat">${esc(ETATS[etat] || '')}</span><span style="display:flex;gap:14px">${ouv.length ? `<button type="button" class="lien" data-act="copier">Copier pour Claude</button>` : ''}${nbCaps(ouv) ? `<button type="button" class="lien" data-act="partager">Avec les captures (${nbCaps(ouv)})</button>` : ''}${faites.length ? `<button type="button" class="lien" data-act="faites">${V.faites ? 'Cacher' : 'Voir'} les faites (${faites.length})</button>` : ''}</span></div>
      ${V.faites && faites.length ? `<div class="liste">${faites.slice(0, 60).map(ligne).join('')}</div>` : ''}`;
  }
  function vueEdit(x) {
    return `<div class="head"><h2>${typeDe(x)[1]} ${esc(x.titre)}<span class="sous">${esc(APPS[x.app] || x.app)} · ${typeDe(x)[2]} · ${fmt(x.cree)}${x.fait ? ' · fait le ' + fmt(x.faitLe) : ''}</span></h2><button type="button" class="x" data-act="fermer" aria-label="Fermer">✕</button></div>
      <form data-form="edit" style="display:flex;flex-direction:column;gap:12px">
        <label class="champ"><span>Titre</span><input type="text" name="titre" value="${esc(x.titre)}" required></label>
        <div class="champ"><span>Type</span><div class="chips">${TYPES.map(([k, e, n]) => `<button type="button" class="chip${(x.type || 'idee') === k ? ' on' : ''}" data-act="typeEdit" data-k="${k}">${e} ${n}</button>`).join('')}</div></div>
        <label class="champ"><span>Détails</span><textarea name="details" rows="6">${esc(x.details || '')}</textarea></label>
        <div class="champ"><span>Captures</span><div class="caps">${(x.captures || []).map(capHtml).join('')}</div>${joindreHtml((x.captures || []).length)}</div>
        <div class="fin"><button type="button" class="btn danger" data-act="suppr">Supprimer</button><button type="button" class="btn" data-act="liste">‹ Liste</button><button type="submit" class="btn prim">Enregistrer</button></div>
      </form>`;
  }
  /* redessine la fenêtre en gardant ce qui est en train d'être écrit (sauf « vider », après un ajout) */
  function dessiner(vider) {
    if (!root) return;
    const sheet = root.querySelector('.sheet'); if (!sheet) return;
    const f0 = sheet.querySelector('form'), act = root.activeElement;
    const garde = f0 && !vider ? { form: f0.dataset.form, cle: V.edit && V.edit.key, titre: f0.titre ? f0.titre.value : null, details: f0.details ? f0.details.value : null,
      ouvert: !!(f0.querySelector('details') && f0.querySelector('details').open), focus: act && act.name } : null;
    const x = V.edit ? liste(null).find((y) => y.key === V.edit.key) : null;
    if (V.edit && !x) V.edit = null;
    sheet.innerHTML = V.edit ? vueEdit(Object.assign({}, x, { type: V.edit.type || x.type })) : vueListe();
    const f = sheet.querySelector('form');
    if (garde && f && f.dataset.form === garde.form && (V.edit && V.edit.key) === garde.cle) {
      if (f.titre && garde.titre != null) f.titre.value = garde.titre;
      if (f.details && garde.details != null) f.details.value = garde.details;
      const d = f.querySelector('details'); if (d && garde.ouvert) d.open = true;
      if (garde.focus && f[garde.focus]) { try { f[garde.focus].focus({ preventScroll: true }); } catch (e) {} }
    }
    remplirImages();
    if (!V.edit && root.querySelector('[data-act=partager]')) preparerEnvoi();
  }
  function capsVisibles() { const x = V.edit ? liste(null).find((y) => y.key === V.edit.key) : null; return (x ? x.captures || [] : V.attente); }
  async function remplirImages() {
    const caps = capsVisibles();
    for (const img of root.querySelectorAll('img[data-cap]')) {
      const cap = caps.find((c) => c.id === img.dataset.cap); if (!cap) continue;
      const u = await urlDe(cap); if (u && img.isConnected) img.src = u; else if (img.isConnected) img.alt = cap.path ? 'Capture (à charger)' : 'Capture';
    }
  }
  /* ajoute des images : à l'idée ouverte, ou au formulaire d'ajout */
  async function joindre(files) {
    const imgs = [...(files || [])].filter((f) => /^image\//.test(f.type)); if (!imgs.length) return false;
    const cle = V.edit && V.edit.key, deja = capsVisibles().length, place = Math.max(0, MAXCAP - deja);
    if (!place) { toast(MAXCAP + ' captures au plus par idée.'); return true; }
    toast('Préparation de la capture…');
    const caps = [];
    for (const f of imgs.slice(0, place)) {
      try { const { blob, w, h } = await preparer(f); const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); await garderLocal(id, blob); caps.push({ id, w, h }); } catch (e) {}
    }
    if (!caps.length) { toast('Image illisible.'); return true; }
    if (cle) { modifier(cle, (r) => { r.data = Object.assign({}, r.data, { captures: (r.data.captures || []).concat(caps) }); }); etat = 'attente'; sync(); }
    else V.attente = V.attente.concat(caps);
    dessiner(); toast(caps.length > 1 ? caps.length + ' captures jointes.' : 'Capture jointe.');
    return true;
  }
  function zoom(id) {
    const cap = capsVisibles().find((c) => c.id === id); if (!cap) return;
    const z = root.querySelector('.zoom'); const img = z.querySelector('img'); img.removeAttribute('src');
    urlDe(cap).then((u) => { if (u) img.src = u; }); z.hidden = false;
  }
  function ouvrir() {
    if (!host) {
      host = document.createElement('div'); host.id = 'orga-ampoule'; document.body.appendChild(host);
      root = host.attachShadow({ mode: 'open' });
      /* les touches tapées ici ne déclenchent pas les raccourcis de l'app (même ceux écoutés en « capture ») :
         on les arrête dès la fenêtre ; la saisie dans les champs se fait quand même */
      ['keydown', 'keyup', 'keypress'].forEach((ev) => addEventListener(ev, (e) => {
        if (!ouvert || !e.composedPath().includes(host)) return;
        e.stopImmediatePropagation(); if (ev === 'keydown' && e.key === 'Escape') fermer();
      }, true));
      root.addEventListener('click', clic); root.addEventListener('submit', envoi); root.addEventListener('change', coche);
      /* coller une capture (Ctrl+V), ou la glisser sur la fenêtre */
      addEventListener('paste', (e) => {
        if (!ouvert || !e.clipboardData) return;
        const fs = [...(e.clipboardData.items || [])].filter((i) => i.kind === 'file' && /^image\//.test(i.type)).map((i) => i.getAsFile()).filter(Boolean);
        if (fs.length) { e.preventDefault(); joindre(fs); }
      }, true);
      const surFichiers = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
      root.addEventListener('dragover', (e) => { if (!surFichiers(e)) return; e.preventDefault(); const s = root.querySelector('.sheet'); if (s) s.classList.add('depot'); });
      root.addEventListener('dragleave', (e) => { const s = root.querySelector('.sheet'); if (s && !s.contains(e.relatedTarget)) s.classList.remove('depot'); });
      root.addEventListener('drop', (e) => { if (!surFichiers(e)) return; e.preventDefault(); const s = root.querySelector('.sheet'); if (s) s.classList.remove('depot'); joindre(e.dataTransfer.files); });
    }
    root.innerHTML = `<style>${CSS}</style><div class="scrim" data-act="fond"><div class="sheet" role="dialog" aria-modal="true" aria-label="Bugs et idées"></div><div class="zoom" data-act="dezoom" hidden><img alt="Capture"></div></div>`;
    ouvert = true; V.edit = null; host.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    if (!etat) etat = aFaire() ? 'attente' : '';
    dessiner(); sync();
    if (matchMedia('(pointer:fine)').matches) { const n = root.getElementById('titre'); if (n) n.focus(); }
  }
  function fermer() { if (!host) return; ouvert = false; host.hidden = true; root.innerHTML = ''; urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear(); document.documentElement.style.overflow = ''; if (bouton) bouton.focus(); }
  function toast(msg) { const e = root.querySelector('.etat'); if (e) e.textContent = msg; }
  function clic(e) {
    const el = e.target.closest('[data-act],[data-voir]'); if (!el) return;
    if (el.dataset.voir) { V.edit = { key: el.dataset.voir }; dessiner(); return; }
    const a = el.dataset.act;
    if (a === 'fond') { if (e.target === el) fermer(); return; }
    if (a === 'dezoom') { el.hidden = true; return; }
    if (a === 'zoom') { zoom(el.dataset.id); return; }
    if (a === 'capRetirer') {
      const id = el.dataset.id;
      if (V.edit) { const S = load(); const r = S.rows[V.edit.key]; if (r && r.data) { oublierCaptures(S, (r.data.captures || []).filter((c) => c.id === id)); r.data = Object.assign({}, r.data, { captures: (r.data.captures || []).filter((c) => c.id !== id) }); S.dirty.add(V.edit.key); save(S); etat = 'attente'; sync(); } }
      else { V.attente = V.attente.filter((c) => c.id !== id); oublierLocal(id); }
      dessiner(); return;
    }
    if (a === 'fermer') fermer();
    else if (a === 'type') { V.type = el.dataset.k; dessiner(true); }
    else if (a === 'vue') { V.tout = el.dataset.tout === '1'; dessiner(); }
    else if (a === 'faites') { V.faites = !V.faites; dessiner(); }
    else if (a === 'liste') { V.edit = null; dessiner(); }
    else if (a === 'typeEdit') { V.edit.type = el.dataset.k; dessiner(); }
    else if (a === 'suppr') { if (!confirmer(el)) return; const S = load(); const r = S.rows[V.edit.key]; if (r) { oublierCaptures(S, r.data && r.data.captures); r.deleted = true; S.dirty.add(V.edit.key); save(S); } V.edit = null; dessiner(); sync(); }
    else if (a === 'copier') copier();
    else if (a === 'partager') partager();
  }
  /* pas de fenêtre du navigateur : on demande de toucher une deuxième fois */
  function confirmer(el) { if (el.dataset.sur) return true; el.dataset.sur = '1'; el.textContent = 'Toucher encore pour supprimer'; setTimeout(() => { if (el.isConnected) { delete el.dataset.sur; el.textContent = 'Supprimer'; } }, 3000); return false; }
  function envoi(e) {
    e.preventDefault(); const f = e.target;
    if (f.dataset.form === 'ajout') {
      const titre = String(f.titre.value || '').trim(); if (!titre) { f.titre.focus(); return; }
      const caps = V.attente.map(({ id, w, h }) => ({ id, w, h })); V.attente = [];
      modifier(nouvelleCle(), (r) => { r.app = APP; r.data = Object.assign({ titre, type: V.type, details: String((f.details && f.details.value) || '').trim(), cree: new Date().toISOString() }, caps.length ? { captures: caps } : {}); });
      etat = 'attente'; dessiner(true); toast(V.type === 'bug' ? 'Bug noté. Merci !' : 'Idée notée. Merci !');
      const n = root.getElementById('titre'); if (n) n.focus(); sync();
    } else if (f.dataset.form === 'edit') {
      const titre = String(f.titre.value || '').trim(); if (!titre) return;
      modifier(V.edit.key, (r) => { r.data = Object.assign({}, r.data, { titre, type: V.edit.type || r.data.type, details: String(f.details.value || '').trim() }); });
      V.edit = null; etat = 'attente'; dessiner(); toast('Enregistré.'); sync();
    }
  }
  function coche(e) {
    if (e.target.dataset && e.target.dataset.fichier != null) { const fs = [...e.target.files]; e.target.value = ''; joindre(fs); return; }
    const k = e.target.dataset && e.target.dataset.fait; if (!k) return;
    const fait = e.target.checked;
    modifier(k, (r) => { r.data = Object.assign({}, r.data, fait ? { fait: true, faitLe: new Date().toISOString() } : { fait: false, faitLe: '' }); });
    etat = 'attente'; setTimeout(() => { if (ouvert && !V.edit) dessiner(); }, 300); sync();
  }
  const nbCaps = (l) => l.reduce((n, x) => n + (x.captures || []).length, 0);
  const ouvertes = () => { const tout = APP === 'orga' && V.tout; return { tout, ouv: liste(tout ? null : APP).filter((x) => !x.fait) }; };
  /* le texte pour Claude ; « noms » : idée → noms des images jointes, quand on les envoie avec */
  function texteClaude(ouv, tout, noms) {
    const cap = (x) => (noms && noms[x.key] ? ` (📷 ${noms[x.key].join(', ')})` : (x.captures || []).length ? ` (📷 ${x.captures.length} capture${x.captures.length > 1 ? 's' : ''} dans l'app)` : '');
    const bloc = (titre, l) => `${titre} — bugs et idées (${l.length})\n` + l.map((x) => `- ${typeDe(x)[1]} ${x.titre}${x.details ? ' : ' + x.details.replace(/\s*\n\s*/g, ' / ') : ''}${cap(x)}`).join('\n');
    return tout ? Object.keys(APPS).map((a) => [a, ouv.filter((x) => x.app === a)]).filter(([, l]) => l.length).map(([a, l]) => bloc(APPS[a], l)).join('\n\n') : bloc(APPS[APP] || APP, ouv);
  }
  function copierTexte(txt, fini) {
    return new Promise((ok) => {
      const f = () => { if (fini) fini(); ok(true); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(f, () => copieSecours(txt, f)); else copieSecours(txt, f);
    });
  }
  function copier() { const { tout, ouv } = ouvertes(); copierTexte(texteClaude(ouv, tout), () => toast('Copié : colle-le dans la conversation de l\'app.')); }
  /* Images numérotées, nommées d'après l'idée : préparées d'avance pour que le partage parte dès qu'on touche */
  const slug = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'capture';
  let prepa = null;
  async function preparerEnvoi() {
    const { tout, ouv } = ouvertes();
    const sig = JSON.stringify(ouv.map((x) => [x.key, x.titre, x.details, (x.captures || []).map((c) => c.id)]));
    if (prepa && prepa.sig === sig) return prepa.p;
    const p = (async () => {
      const files = [], noms = {}; let i = 0;
      for (const x of ouv) for (const cap of x.captures || []) {
        const b = await blobDe(cap); if (!b) continue;
        i++; const nom = `${i}-${slug(x.titre)}.${b.type === 'image/webp' ? 'webp' : b.type === 'image/png' ? 'png' : 'jpg'}`;
        files.push(new File([b], nom, { type: b.type })); (noms[x.key] = noms[x.key] || []).push(nom);
      }
      return { files, txt: texteClaude(ouv, tout, noms) };
    })();
    prepa = { sig, p }; return p;
  }
  async function partager() {
    const { files, txt } = await preparerEnvoi();
    if (!files.length) { copierTexte(txt, () => toast('Captures pas encore disponibles (réseau ?) : texte seul copié.')); return; }
    const s = files.length > 1 ? 's' : '';
    if (navigator.canShare && navigator.share && navigator.canShare({ files })) {
      copierTexte(txt);
      try { await navigator.share({ title: 'Bugs et idées', text: txt, files }); toast('Envoyé. Le texte est aussi copié, au cas où.'); return; }
      catch (e) {
        if (e && e.name === 'AbortError') { toast('Partage annulé.'); return; }
        if (e && e.name === 'NotAllowedError') { toast('Prêt : touche encore « Avec les captures ».'); return; }
      }
    }
    /* ordinateur : le texte est copié et les images téléchargées, à glisser dans la conversation */
    await copierTexte(txt);
    files.forEach((f, k) => setTimeout(() => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; root.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, k * 350));
    toast(`Texte copié et ${files.length} capture${s} téléchargée${s} : colle le texte dans la conversation, puis glisse les images.`);
  }
  function copieSecours(txt, fini) { const t = document.createElement('textarea'); t.value = txt; t.style.cssText = 'position:fixed;opacity:0'; root.appendChild(t); t.select(); try { document.execCommand('copy'); fini(); } catch (e) {} t.remove(); }

  /* ---------- le bouton 💡 ---------- */
  function placer() {
    bouton = document.querySelector('[data-ampoule]');
    if (!bouton) {
      const ref = D.avant ? document.querySelector(D.avant) : D.apres ? document.querySelector(D.apres) : null;
      bouton = document.createElement('button'); bouton.type = 'button'; bouton.className = D.classe || ''; bouton.textContent = '💡';
      if (D.taille) bouton.style.fontSize = D.taille;
      if (ref && D.avant) ref.before(bouton); else if (ref) ref.after(bouton);
      else { bouton.style.cssText += ';position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:50;width:44px;height:44px;border-radius:22px;border:1px solid #ccc;background:#fff;font-size:20px'; document.body.appendChild(bouton); }
    }
    bouton.setAttribute('aria-label', 'Bugs et idées'); bouton.title = 'Bugs et idées';
    bouton.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); ouvrir(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', placer); else placer();
  window.OrgaAmpoule = { ouvrir, sync };
})();
