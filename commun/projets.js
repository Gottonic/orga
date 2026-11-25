/* Locus — la fiche projet commune (étapes 1, 1b et 2 du plan, 14.11.2026).
   Deux niveaux aux rôles nets (étape 1b) :
     domaine  il range : nom, émoji, couleur, tâches, notes ; ni perso/pro, ni état, ni temps.
              Lignes `d:<id>` de la table `rows`. Le domaine « autres » (Autres projets) est automatique.
     projet   il prend du temps, de 4 h à ∞ : perso ou pro (sur le projet lui-même, sans héritage),
              état, priorité, taille, planning. Lignes `p:<id>` ; `parent` = id de son domaine.
   Les tâches (projets et domaines) sont en arbre depuis le 25.11 (voir plus bas : n, étapes) ;
   avant, elles pouvaient avoir des titres de section : { t, s: true }.
   Avant l'étape 1b, un projet pouvait en contenir d'autres ; `nature` héritait alors du parent.
   Ce module donne les règles communes, et `Projets.base` permet aux autres apps (la Mine) de lire et
   d'écrire projets et domaines.

   Champs d'un projet (en plus de ceux du planning de l'Établi : weeks, days, size, dur, imp, due…) :
     parent  id de son domaine (facultatif : sans domaine = Autres projets)
     nature  'perso' | 'pro' (vide = perso ; avant l'étape 1b, celle du projet parent)
     later   true = Idée (pas encore décidé)
     prevu   'AAAA-MM-JJ' : Prévu, commence à cette date (devient En cours tout seul ce jour-là,
             ou dès qu'il est placé au planning avant)
     closed  'AAAA-MM-JJ' : Archivé ce jour-là
     fin     { type: 'termine' | 'abandonne', raison } quand il est archivé
     touche  'AAAA-MM-JJ' : dernière fois que le projet a bougé (pour les projets qui dorment)
     size    'perm' = ∞ (sans durée ni fin) ; 'mini' = ancien mini projet (n'existe plus depuis l'étape 1b,
             sauf archivé) */
(function () {
  'use strict';
  const ETATS = { idee: 'Idée', prevu: 'Prévu', encours: 'En cours', archive: 'Archivé' };
  const FINS = { termine: 'Terminé', abandonne: 'Abandonné' };
  const DORT_JOURS = 122; /* environ 4 mois */
  const AUTRES = 'autres'; /* domaine automatique « Autres projets » */

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (s) => { const a = String(s).split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); };
  /* lundi d'une semaine ISO « 2026-W46 » */
  function lundi(k) {
    const [y, w] = String(k).split('-W').map(Number);
    const j4 = new Date(y, 0, 4), m = new Date(j4);
    m.setDate(j4.getDate() - ((j4.getDay() + 6) % 7) + (w - 1) * 7);
    return iso(m);
  }
  const ajoute = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const jours = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);

  /* dates de travail placées au planning (jours, et lundi→vendredi des semaines) */
  function places(p) {
    const out = (p.days || []).slice();
    (p.weeks || []).forEach((k) => { const m = lundi(k); for (let i = 0; i < 5; i++) out.push(ajoute(m, i)); });
    return out.sort();
  }
  const estInfini = (p) => !!p && p.size === 'perm';
  const estDomaine = (x) => !!x && x.kind === 'domaine';
  const estSection = (t) => !!t && t.s === true; /* ancien titre de section (avant l'arbre, 25.11) */

  /* Les tâches en arbre (étape 12b, 25.11.2026). p.tasks reste une liste plate, dans l'ordre de lecture ;
     chaque élément peut porter n = son niveau (0 en haut, absent = 0).
       étape   un élément suivi d'un élément plus profond (ses tâches sont les suivants plus profonds) ;
               vidée, elle redevient une tâche (le champ e du premier jour n'est plus utilisé, ranger() l'efface)
       d       enregistré aussi sur les étapes, recalculé : faite quand toutes ses tâches le sont ;
               cocher une étape coche tout ce qu'elle contient (cocher()).
     Les anciens lecteurs voient tous les éléments, dans l'ordre, avec t et d. */
  const niveau = (x) => (x && x.n > 0 ? Math.floor(x.n) : 0);
  const estEtape = (L, i) => !!L && !!L[i] && niveau(L[i + 1]) > niveau(L[i]);
  /* fin (exclue) de la branche qui commence en i */
  function finBranche(L, i) { const n = niveau(L[i]); let j = i + 1; while (j < L.length && niveau(L[j]) > n) j++; return j; }
  const aSections = (L) => (L || []).some(estSection);
  /* anciens titres de section → étapes de niveau 0, leurs tâches au niveau 1 (même ordre, mêmes positions) */
  function depuisSections(L) {
    let dans = false;
    return (L || []).map((x, i) => {
      if (estSection(x)) { dans = true; return { t: x.t, d: false }; }
      const y = Object.assign({}, x); delete y.s; if (dans) y.n = niveau(x) + 1; else if (!y.n) delete y.n; return y;
    });
  }
  /* niveaux possibles (pas de saut de plus d'un niveau), puis d des étapes recalculé ; modifie L */
  function ranger(L) {
    let prec = -1;
    L.forEach((x) => { let n = niveau(x); if (n > prec + 1) n = prec + 1; if (n > 0) x.n = n; else delete x.n; delete x.e; prec = n; });
    for (let i = L.length - 1; i >= 0; i--) {
      const n = niveau(L[i]); if (!(niveau(L[i + 1]) > n)) continue;
      let tout = true; for (let j = i + 1; j < L.length && niveau(L[j]) > n; j++) if (niveau(L[j]) === n + 1 && !L[j].d) { tout = false; break; }
      L[i].d = tout;
    }
    return L;
  }
  /* les branches faites descendent à la fin de leur groupe de sœurs ; renvoie une nouvelle liste */
  function trierTaches(L0) {
    const L = ranger(aSections(L0) ? depuisSections(L0) : (L0 || []).slice()), out = [];
    (function groupe(a, b) {
      const br = []; let i = a; while (i < b) { const j = finBranche(L, i); br.push([i, j]); i = j; }
      const mettre = ([i, j]) => { out.push(L[i]); groupe(i + 1, j); };
      br.filter(([i]) => !L[i].d).forEach(mettre); br.filter(([i]) => L[i].d).forEach(mettre);
    })(0, L.length);
    return out;
  }
  /* cocher ou décocher un élément et tout ce qu'il contient, puis recalculer les étapes ; modifie L */
  function cocher(L, i, v) { if (!L || !L[i]) return L; const j = finBranche(L, i); for (let k = i; k < j; k++) L[k].d = !!v; return ranger(L); }
  /* les tâches seules (sans les étapes ni les anciens titres de section) */
  const tachesSeules = (L) => (L || []).filter((x, i) => !estSection(x) && !estEtape(L, i));
  /* « Étape n°1 » : la prochaine chose à faire d'un projet (ou d'une liste de tâches) = la première tâche pas faite,
     en descendant dans l'arbre et en sautant les branches faites. Renvoie { i, t, x, chemin: [noms des étapes] } ou null.
     */
  function etapeUne(p) {
    const L0 = Array.isArray(p) ? p : (p && p.tasks) || [], L = aSections(L0) ? depuisSections(L0) : L0, pile = [];
    for (let i = 0; i < L.length; i++) {
      const x = L[i], n = niveau(x); pile.length = Math.min(pile.length, n);
      if (x.d) { i = finBranche(L, i) - 1; continue; }
      if (niveau(L[i + 1]) > n) { pile[n] = x.t; continue; }
      return { i, t: x.t, x: L0[i], chemin: pile.slice(0, n) };
    }
    return null;
  }
  const estMini = (p) => !!p && p.size === 'mini';

  /* état commun : idee | prevu | encours | archive */
  function etat(p, aujourdhui) {
    if (!p) return null;
    if (p.closed) return 'archive';
    if (p.later) return 'idee';
    if (p.prevu && p.prevu > aujourdhui && !places(p).some((d) => d <= aujourdhui)) return 'prevu';
    return 'encours';
  }

  /* get : fonction id → projet (les domaines n'y sont pas : un domaine n'est ni perso ni pro) */
  const parentDe = (p, get) => (p && p.parent ? get(p.parent) || null : null);
  function nature(p, get) {
    if (!p) return 'perso';
    if (p.nature === 'pro' || p.nature === 'perso') return p.nature;
    const par = get ? parentDe(p, get) : null; /* ancien modèle (avant l'étape 1b) */
    if (par && !estDomaine(par) && (par.nature === 'pro' || par.nature === 'perso')) return par.nature;
    return 'perso';
  }
  const enfants = (id, liste) => liste.filter((x) => x.parent === id);
  /* le projet pro le plus haut de sa branche (activité de la Mine, catégorie de la Banque) */
  function racinePro(p, get) {
    if (!p) return null;
    const par = parentDe(p, get);
    if (par && nature(par, get) === 'pro') return par;
    return nature(p, get) === 'pro' ? p : null;
  }
  /* peut-on ranger p dans cand ? Seulement dans un domaine ouvert (étape 1b) */
  function parentPossible(cand, p) {
    return !!cand && !!p && cand.id !== p.id && estDomaine(cand) && !cand.closed;
  }

  /* dernière activité connue : champ touche, sinon planning passé, sinon date de création (id « p<horodatage> ») */
  function derniereActivite(p, aujourdhui) {
    let d = p.touche || null;
    const passe = places(p).filter((x) => x <= aujourdhui);
    if (passe.length && (!d || passe[passe.length - 1] > d)) d = passe[passe.length - 1];
    if (!d) { const m = String(p.id || '').match(/(\d{12,13})/); if (m) d = iso(new Date(Number(m[1]))); }
    return d;
  }
  /* un projet En cours qui n'a pas bougé depuis ~4 mois et n'a rien de prévu plus tard */
  function dort(p, aujourdhui) {
    if (etat(p, aujourdhui) !== 'encours' || estInfini(p)) return false;
    if (places(p).some((d) => d > aujourdhui)) return false;
    const d = derniereActivite(p, aujourdhui);
    return !!d && jours(d, aujourdhui) >= DORT_JOURS;
  }
  const depuis = (p, aujourdhui) => { const d = derniereActivite(p, aujourdhui); return d ? jours(d, aujourdhui) : null; };

  /* Domaine neuf */
  function nouveauDomaine(o) {
    return Object.assign({ id: 'd' + Date.now() + String(Math.floor(Math.random() * 10)), kind: 'domaine', name: '', emoji: '📁', color: '#5E6B7A', tasks: [] }, o || {});
  }
  const autres = () => ({ id: AUTRES, kind: 'domaine', auto: true, name: 'Autres projets', emoji: '📦', color: '#B8B4AE', tasks: [] });

  /* Projet neuf, avec tous les champs que l'Établi attend */
  function nouveau(o) {
    return Object.assign({ id: 'p' + Date.now() + String(Math.floor(Math.random() * 10)), emoji: '', color: '#C68A2E', name: '', size: 'proj', dur: 5, imp: 2, due: null,
      tags: [], weeks: [], days: [], why: '', next: '', folder: null, tasks: [], nature: 'perso', touche: iso(new Date()) }, o || {});
  }

  /* Lire et écrire les projets (et les domaines) depuis une autre app que l'Établi (la Mine…) : même table
     `rows`, lignes `p:<id>` et `d:<id>`, copie locale `locus-projets-<utilisateur>`, envoi dès que le réseau le permet.
     L'Établi reçoit ces changements à sa prochaine synchro. */
  function base(sb, uid) {
    const LS = 'locus-projets-' + uid;
    let st = { prev: {}, dirty: [], last: null };
    try { const c = JSON.parse(localStorage.getItem(LS) || 'null'); if (c && c.prev) st = Object.assign(st, c); } catch (e) {}
    const ecoute = []; let envoi = false, minuterie = null, erreur = '';
    const garder = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) {} };
    const lire = (v) => { try { return v ? JSON.parse(v) : null; } catch (e) { return null; } };
    const liste = () => Object.keys(st.prev).filter((k) => k.startsWith('p:')).map((k) => lire(st.prev[k])).filter(Boolean);
    const get = (id) => (id ? lire(st.prev['p:' + id]) : null);
    const domaines = () => Object.keys(st.prev).filter((k) => k.startsWith('d:')).map((k) => lire(st.prev[k])).filter(Boolean);
    const domaine = (id) => (id ? lire(st.prev['d:' + id]) : null);
    const prevenir = () => ecoute.forEach((f) => { try { f(); } catch (e) {} });
    async function tirer(tout) {
      if (!sb || !navigator.onLine) return false;
      try {
        const depuisLe = tout ? null : st.last; let max = st.last, ch = false;
        for (const motif of ['p:%', 'd:%']) {
          let de = 0;
          for (;;) {
            let q = sb.from('rows').select('key,data,deleted,updated_at').like('key', motif).order('updated_at', { ascending: true }).range(de, de + 999);
            if (depuisLe) q = q.gte('updated_at', depuisLe);
            const { data, error } = await q; if (error) throw error;
            (data || []).forEach((r) => {
              if (!max || r.updated_at > max) max = r.updated_at;
              if (st.dirty.includes(r.key)) return;
              if (r.deleted || r.data == null) { if (r.key in st.prev) { delete st.prev[r.key]; ch = true; } }
              else { const v = JSON.stringify(r.data); if (st.prev[r.key] !== v) { st.prev[r.key] = v; ch = true; } }
            });
            if (!data || data.length < 1000) break; de += 1000;
          }
        }
        st.last = max; erreur = ''; garder(); if (ch) prevenir(); return true;
      } catch (e) { erreur = (e && e.message) || String(e); return false; }
    }
    async function pousser() {
      if (envoi || !st.dirty.length || !sb || !navigator.onLine) return;
      envoi = true; const keys = st.dirty.slice(0, 100), sent = {};
      const rows = keys.map((k) => { sent[k] = st.prev[k]; return k in st.prev ? { user_id: uid, key: k, data: JSON.parse(st.prev[k]), deleted: false } : { user_id: uid, key: k, data: null, deleted: true }; });
      try {
        const { error } = await sb.from('rows').upsert(rows, { onConflict: 'user_id,key' }); if (error) throw error;
        st.dirty = st.dirty.filter((k) => !(keys.includes(k) && st.prev[k] === sent[k])); erreur = ''; garder();
      } catch (e) { erreur = (e && e.message) || String(e); clearTimeout(minuterie); minuterie = setTimeout(pousser, 15000); envoi = false; return; }
      envoi = false; if (st.dirty.length) { clearTimeout(minuterie); minuterie = setTimeout(pousser, 300); }
    }
    function ecrire(p) {
      if (!p || !p.id) return; const k = (estDomaine(p) ? 'd:' : 'p:') + p.id;
      st.prev[k] = JSON.stringify(p); if (!st.dirty.includes(k)) st.dirty.push(k);
      garder(); prevenir(); clearTimeout(minuterie); minuterie = setTimeout(pousser, 600);
    }
    return { liste, get, domaines, domaine, tirer, pousser, ecrire, surChangement: (f) => ecoute.push(f), erreur: () => erreur, enAttente: () => st.dirty.length, pret: () => !!st.last || Object.keys(st.prev).length > 0 };
  }

  window.Projets = { ETATS, FINS, DORT_JOURS, AUTRES, etat, nature, parentDe, enfants, racinePro, parentPossible, estInfini, estMini, estDomaine, estSection, trierTaches, tachesSeules, niveau, estEtape, finBranche, aSections, depuisSections, ranger, cocher, etapeUne, places, derniereActivite, dort, depuis, lundi, nouveau, nouveauDomaine, autres, base };
})();
