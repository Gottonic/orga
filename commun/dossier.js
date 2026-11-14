/* Locus — les dossiers de projet sur l'ordinateur (étape 3 du plan, 14.11.2026).
   Les fichiers vivent sur l'ordinateur, dans le dossier « Locus » choisi une fois (File System Access, navigateurs
   Chromium sur ordinateur, app installée + « Autoriser à chaque visite »). Supabase garde une fiche par fichier
   (table `fichiers`, lignes `f:<id>`), lisible partout, et le transit des fichiers envoyés depuis le téléphone
   (dossier de stockage `transit`), effacé dès que l'ordinateur les a rangés.

   Rangement :  Projets/<domaine>/<projet>/…   À trier/   Archives/<année>/<projet>/
   Une fiche : { id, chemin (dossier, depuis la racine), nom, taille, modif (ms), type, projet, etat: 'ici' | 'transit',
                 transit (chemin dans le stockage), vers (dossier où le déplacer), le } */
(function () {
  'use strict';
  const TRANSIT = 'transit', TABLE = 'fichiers', A_TRIER = 'À trier', MAX = 50 * 1024 * 1024;

  /* ---------- la poignée du dossier, gardée dans IndexedDB (la même que le test des Réglages) ---------- */
  const IDB = { db: null,
    ouvrir() { return this.db || (this.db = new Promise((ok, ko) => { const r = indexedDB.open('orga-dossier', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); })); },
    async lire(k) { const db = await this.ouvrir(); return new Promise((ok, ko) => { const q = db.transaction('h').objectStore('h').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error); }); },
    async ecrire(k, v) { const db = await this.ouvrir(); return new Promise((ok, ko) => { const t = db.transaction('h', 'readwrite'); t.objectStore('h').put(v, k); t.oncomplete = () => ok(); t.onerror = () => ko(t.error); }); } };
  let RACINE = null, FORCE = false;
  const possible = () => 'showDirectoryPicker' in window || FORCE;
  async function racine() { if (RACINE) return RACINE; try { RACINE = (await IDB.lire('racine')) || null; } catch (e) { RACINE = null; } return RACINE; }
  /* 'non' (navigateur sans accès aux dossiers, téléphone) | 'absent' (pas encore choisi) | 'prompt' (un clic pour redonner l'accès) | 'granted' */
  async function etat() {
    if (!possible()) return 'non'; const r = await racine(); if (!r) return 'absent'; if (FORCE) return 'granted';
    try { return await r.queryPermission({ mode: 'readwrite' }); } catch (e) { return 'prompt'; } }
  async function autoriser() { const r = await racine(); if (!r) return 'absent'; try { return await r.requestPermission({ mode: 'readwrite' }); } catch (e) { return 'denied'; } }
  async function choisir() { const h = await window.showDirectoryPicker({ id: 'orga', mode: 'readwrite', startIn: 'documents' }); RACINE = h; await IDB.ecrire('racine', h); await IDB.ecrire('infos', { choisi: new Date().toISOString(), n: 0 }); return h; }
  function utiliser(h) { RACINE = h; FORCE = true; } /* tests : un dossier déjà ouvert */

  /* ---------- chemins ---------- */
  const propre = (s) => String(s || '').replace(/[\/\\:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').replace(/^[.\s-]+|[.\s]+$/g, '').slice(0, 80) || 'Sans nom';
  const morceaux = (c) => String(c || '').split('/').filter(Boolean);
  function cheminProjet(p, dom) { return ['Projets', propre(dom ? dom.name : 'Autres projets'), propre(p.name)].join('/'); }
  function cheminArchive(chemin, annee) { const m = morceaux(chemin); return ['Archives', String(annee), m[m.length - 1] || 'Sans nom'].join('/'); }
  function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
  const idDe = (chemin, nom) => 'f' + hash(chemin + '/' + nom);

  /* ---------- le dossier sur l'ordinateur ---------- */
  async function dossier(chemin, creer) { let d = await racine(); for (const m of morceaux(chemin)) d = await d.getDirectoryHandle(m, { create: !!creer }); return d; }
  async function existe(chemin) { try { await dossier(chemin, false); return true; } catch (e) { return false; } }
  async function lister(chemin, prof) {
    const out = []; let d; try { d = await dossier(chemin, false); } catch (e) { return null; }
    for await (const [nom, h] of d.entries()) {
      if (nom.startsWith('.') || nom.endsWith('.crswap')) continue;
      if (h.kind === 'directory') { if ((prof || 0) < 3) { const s = await lister(chemin + '/' + nom, (prof || 0) + 1); if (s) out.push(...s); } }
      else { try { const f = await h.getFile(); out.push({ chemin, nom, taille: f.size, modif: f.lastModified, type: f.type || '' }); } catch (e) {} } }
    return out; }
  async function nomLibre(d, nom) {
    const m = nom.match(/^(.*?)(\.[^.]*)?$/), base = m[1], ext = m[2] || ''; let n = nom, i = 2;
    for (;;) { try { await d.getFileHandle(n, { create: false }); n = base + ' (' + (i++) + ')' + ext; } catch (e) { return n; } } }
  async function ecrire(chemin, nom, blob, remplacer) {
    const d = await dossier(chemin, true), n = remplacer ? propre(nom) : await nomLibre(d, propre(nom));
    const fh = await d.getFileHandle(n, { create: true }), w = await fh.createWritable(); await w.write(blob); await w.close();
    const f = await fh.getFile(); return { nom: n, taille: f.size, modif: f.lastModified, type: f.type || blob.type || '' }; }
  async function lire(chemin, nom) { const d = await dossier(chemin, false); return (await d.getFileHandle(nom)).getFile(); }
  async function effacer(chemin, nom) { const d = await dossier(chemin, false); await d.removeEntry(nom); }
  /* déplacer un dossier entier (copie puis effacement : marche partout) */
  async function deplacerDossier(de, vers) {
    const src = await dossier(de, false), dst = await dossier(vers, true);
    async function copie(a, b) { for await (const [nom, h] of a.entries()) {
      if (h.kind === 'directory') await copie(h, await b.getDirectoryHandle(nom, { create: true }));
      else { const f = await h.getFile(), w = await (await b.getFileHandle(nom, { create: true })).createWritable(); await w.write(f); await w.close(); } } }
    await copie(src, dst);
    const m = morceaux(de), parent = await dossier(m.slice(0, -1).join('/'), false); await parent.removeEntry(m[m.length - 1], { recursive: true }); }

  /* ---------- les fiches (table `fichiers`), hors ligne d'abord, comme Projets.base ---------- */
  function base(sb, uid) {
    const LS = 'locus-fichiers-' + uid; let st = { prev: {}, dirty: [], last: null };
    try { const c = JSON.parse(localStorage.getItem(LS) || 'null'); if (c && c.prev) st = Object.assign(st, c); } catch (e) {}
    const ecoute = []; let envoi = false, minuterie = null, erreur = '';
    const garder = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) {} };
    const lireV = (v) => { try { return v ? JSON.parse(v) : null; } catch (e) { return null; } };
    const liste = () => Object.keys(st.prev).map((k) => lireV(st.prev[k])).filter(Boolean);
    const get = (id) => lireV(st.prev['f:' + id]);
    const prevenir = () => ecoute.forEach((f) => { try { f(); } catch (e) {} });
    async function tirer(tout) {
      if (!sb || !navigator.onLine) return false;
      try { let de = 0, max = tout ? null : st.last, ch = false; const depuis = max;
        for (;;) { let q = sb.from(TABLE).select('key,data,deleted,updated_at').order('updated_at', { ascending: true }).range(de, de + 999); if (depuis) q = q.gte('updated_at', depuis);
          const { data, error } = await q; if (error) throw error;
          (data || []).forEach((r) => { if (!max || r.updated_at > max) max = r.updated_at; if (st.dirty.includes(r.key)) return;
            if (r.deleted || r.data == null) { if (r.key in st.prev) { delete st.prev[r.key]; ch = true; } }
            else { const v = JSON.stringify(r.data); if (st.prev[r.key] !== v) { st.prev[r.key] = v; ch = true; } } });
          if (!data || data.length < 1000) break; de += 1000; }
        st.last = max; erreur = ''; garder(); if (ch) prevenir(); return true;
      } catch (e) { erreur = (e && e.message) || String(e); return false; } }
    async function pousser() {
      if (envoi || !st.dirty.length || !sb || !navigator.onLine) return; envoi = true;
      const keys = st.dirty.slice(0, 200), sent = {};
      const rows = keys.map((k) => { sent[k] = st.prev[k]; return k in st.prev ? { user_id: uid, key: k, data: JSON.parse(st.prev[k]), deleted: false } : { user_id: uid, key: k, data: null, deleted: true }; });
      try { const { error } = await sb.from(TABLE).upsert(rows, { onConflict: 'user_id,key' }); if (error) throw error;
        st.dirty = st.dirty.filter((k) => !(keys.includes(k) && st.prev[k] === sent[k])); erreur = ''; garder();
      } catch (e) { erreur = (e && e.message) || String(e); clearTimeout(minuterie); minuterie = setTimeout(pousser, 15000); envoi = false; return; }
      envoi = false; if (st.dirty.length) { clearTimeout(minuterie); minuterie = setTimeout(pousser, 300); } }
    const marquer = (k) => { if (!st.dirty.includes(k)) st.dirty.push(k); garder(); prevenir(); clearTimeout(minuterie); minuterie = setTimeout(pousser, 500); };
    function ecrireF(f) { if (!f || !f.id) return; st.prev['f:' + f.id] = JSON.stringify(f); marquer('f:' + f.id); }
    function oublier(id) { const k = 'f:' + id; if (!(k in st.prev)) return; delete st.prev[k]; marquer(k); }
    return { liste, get, tirer, pousser, ecrire: ecrireF, oublier, surChangement: (f) => ecoute.push(f), erreur: () => erreur, enAttente: () => st.dirty.length };
  }
  const dans = (fb, chemin) => fb.liste().filter((f) => f.chemin === chemin || f.chemin.startsWith(chemin + '/'));

  /* ---------- envoyer un fichier : tout de suite sur l'ordinateur, sinon par le transit ---------- */
  async function envoyer(sb, uid, fb, chemin, file, projet) {
    if (file.size > MAX) throw new Error('Fichier trop lourd (50 Mo au plus).');
    if ((await etat()) === 'granted') {
      const r = await ecrire(chemin, file.name, file);
      const f = { id: idDe(chemin, r.nom), chemin, nom: r.nom, taille: r.taille, modif: r.modif, type: r.type, projet: projet || null, etat: 'ici', le: new Date().toISOString() };
      fb.ecrire(f); return f; }
    if (!sb || !navigator.onLine) throw new Error('Hors ligne : réessaie avec du réseau.');
    const deja = new Set(dans(fb, chemin).filter((x) => x.chemin === chemin).map((x) => x.nom)); let nom = propre(file.name);
    if (deja.has(nom)) { const m = nom.match(/^(.*?)(\.[^.]*)?$/); let i = 2; while (deja.has(m[1] + ' (' + i + ')' + (m[2] || ''))) i++; nom = m[1] + ' (' + i + ')' + (m[2] || ''); }
    const id = idDe(chemin, nom), path = uid + '/' + id;
    const { error } = await sb.storage.from(TRANSIT).upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' }); if (error) throw error;
    const f = { id, chemin, nom, taille: file.size, modif: file.lastModified || Date.now(), type: file.type || '', projet: projet || null, etat: 'transit', transit: path, le: new Date().toISOString() };
    fb.ecrire(f); return f; }

  /* ---------- sur l'ordinateur : ranger le transit, faire les déplacements demandés, relire les dossiers ----------
     dossiers : liste des dossiers à relire (ceux des projets, plus « À trier »). Renvoie un petit bilan. */
  let enCours = false;
  async function synchro(sb, uid, fb, dossiers) {
    if (enCours || (await etat()) !== 'granted') return null; enCours = true; const B = { ranges: 0, deplaces: 0, vus: 0, erreurs: [] };
    try {
      for (const f of fb.liste().filter((x) => x.etat === 'transit')) {
        if (!sb || !navigator.onLine) break;
        try { const { data, error } = await sb.storage.from(TRANSIT).download(f.transit); if (error) throw error;
          const r = await ecrire(f.chemin, f.nom, data);
          if (r.taille !== data.size) throw new Error('taille différente après écriture');
          await sb.storage.from(TRANSIT).remove([f.transit]);
          const g = Object.assign({}, f, { nom: r.nom, taille: r.taille, modif: r.modif, etat: 'ici', id: idDe(f.chemin, r.nom) }); delete g.transit;
          if (g.id !== f.id) fb.oublier(f.id); fb.ecrire(g); B.ranges++;
        } catch (e) { B.erreurs.push(f.nom + ' : ' + ((e && e.message) || e)); } }
      for (const f of fb.liste().filter((x) => x.etat === 'ici' && x.vers && x.vers !== x.chemin)) {
        try { const fi = await lire(f.chemin, f.nom), r = await ecrire(f.vers, f.nom, fi); await effacer(f.chemin, f.nom);
          const g = Object.assign({}, f, { chemin: f.vers, nom: r.nom, id: idDe(f.vers, r.nom) }); delete g.vers; fb.oublier(f.id); fb.ecrire(g); B.deplaces++;
        } catch (e) { B.erreurs.push(f.nom + ' : ' + ((e && e.message) || e)); } }
      for (const ch of [...new Set(dossiers || [])]) {
        const L = await lister(ch); if (L === null) continue; const vus = new Set();
        for (const x of L) { const id = idDe(x.chemin, x.nom); vus.add(id); const old = fb.get(id);
          if (!old || old.taille !== x.taille || old.modif !== x.modif || old.etat !== 'ici') fb.ecrire(Object.assign({ projet: old ? old.projet : null }, old || {}, x, { id, etat: 'ici', le: (old && old.le) || new Date().toISOString() })); B.vus++; }
        dans(fb, ch).forEach((f) => { if (f.etat === 'ici' && !f.vers && !vus.has(f.id)) fb.oublier(f.id); }); }
    } finally { enCours = false; }
    return B; }

  window.Dossier = { A_TRIER, MAX, possible, racine, etat, autoriser, choisir, utiliser, propre, cheminProjet, cheminArchive, idDe, dossier, existe, lister, ecrire, lire, effacer, deplacerDossier, base, dans, envoyer, synchro };
})();
