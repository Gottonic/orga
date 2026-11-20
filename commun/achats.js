/* Locus — les achats d'un projet (étape 10, 18.11.2026, choix de Nicolas : « une liste d'achats » dans la fiche du projet).
   Chaque achat est un article du Marché (table `marche_rows`, ligne `a:<id>`) avec trois champs en plus :
     projet     id du projet de l'Établi
     projetNom, projetE   nom et émoji du projet (le Marché les affiche sans lire les projets)
   Coché dans la fiche = acheté (comme cocher au Marché) ; décoché = de nouveau sur la liste.
   Le Marché range l'article dans son rayon (deviné) à sa prochaine ouverture et filtre par projet.
   Usage : const AB = Achats.base(sb, uid) ; AB.tirer() ; AB.liste(pid) ; AB.ajouter(p, nom) ; AB.basculer(id) ; AB.supprimer(id) */
(function () {
  'use strict';
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function base(sb, user) {
    const LS = 'locus-achats-' + user;
    let st = { prev: {}, dirty: [] };
    try { const c = JSON.parse(localStorage.getItem(LS) || 'null'); if (c && c.prev) st = Object.assign(st, c); } catch (e) {}
    const garder = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) {} };
    let envoi = false, minut = null;
    async function tirer() {
      if (!sb || !navigator.onLine) return false;
      try {
        const { data, error } = await sb.from('marche_rows').select('key,data,deleted').like('key', 'a:%').not('data->>projet', 'is', null);
        if (error) throw error;
        let ch = false; const vus = new Set();
        (data || []).forEach((r) => { vus.add(r.key); if (st.dirty.includes(r.key)) return;
          if (r.deleted || !r.data) { if (st.prev[r.key]) { delete st.prev[r.key]; ch = true; } return; }
          const v = JSON.stringify(r.data); if (JSON.stringify(st.prev[r.key]) !== v) { st.prev[r.key] = r.data; ch = true; } });
        Object.keys(st.prev).forEach((k) => { if (!vus.has(k) && !st.dirty.includes(k)) { delete st.prev[k]; ch = true; } });
        garder(); return ch;
      } catch (e) { return false; }
    }
    async function pousser() {
      if (envoi || !st.dirty.length || !sb || !navigator.onLine) return; envoi = true;
      const keys = st.dirty.slice(0, 50);
      /* la table du Marché demande le genre de chaque ligne (kind) */
      const rows = keys.map((k) => (st.prev[k] ? { user_id: user, key: k, kind: 'article', data: st.prev[k], deleted: false } : { user_id: user, key: k, kind: 'article', data: null, deleted: true }));
      try { const { error } = await sb.from('marche_rows').upsert(rows, { onConflict: 'user_id,key' }); if (error) throw error; st.dirty = st.dirty.filter((k) => !keys.includes(k)); garder(); }
      catch (e) { clearTimeout(minut); minut = setTimeout(pousser, 15000); }
      envoi = false; if (st.dirty.length) { clearTimeout(minut); minut = setTimeout(pousser, 300); }
    }
    function ecrire(k, a) { if (a) st.prev[k] = a; else delete st.prev[k]; if (!st.dirty.includes(k)) st.dirty.push(k); garder(); clearTimeout(minut); minut = setTimeout(pousser, 400); }
    if (st.dirty.length) setTimeout(pousser, 800); /* achats écrits avant, pas encore partis */
    const liste = (pid) => Object.values(st.prev).filter((a) => a && a.projet === pid).sort((a, b) => (a.liste === b.liste ? String(a.cree).localeCompare(String(b.cree)) : a.liste ? -1 : 1));
    function ajouter(p, nom) {
      nom = String(nom || '').trim().replace(/\s+/g, ' '); if (!nom) return null;
      const now = new Date().toISOString();
      const a = Object.assign({ id: uid(), nom, qte: '', note: '', ou: [], basique: false, rythme: 0, achats: [], cree: now, cat: '', liste: true, ajoute: now, auto: false, panier: null },
        p ? { projet: p.id, projetNom: p.name || '', projetE: p.emoji || '' } : {}); /* sans projet : un achat ordinaire du Marché */
      ecrire('a:' + a.id, a); return a;
    }
    function basculer(id) {
      const a = st.prev['a:' + id]; if (!a) return; const b = Object.assign({}, a), t = today();
      if (b.liste) { b.liste = false; b.panier = null; b.auto = false; b.achats = [...new Set([...(b.achats || []), t])].sort().slice(-24); b.depuis = t; b.pris = { le: new Date().toISOString(), ajout: true, depuis: null, auto: false }; }
      else { b.liste = true; b.ajoute = new Date().toISOString(); b.achats = (b.achats || []).filter((d) => d !== t); delete b.pris; }
      ecrire('a:' + id, b);
    }
    function supprimer(id) { if (st.prev['a:' + id]) ecrire('a:' + id, null); }
    return { tirer, pousser, liste, ajouter, basculer, supprimer };
  }
  window.Achats = { base };
})();
