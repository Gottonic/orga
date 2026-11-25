/* Locus — « Mon Locus » : le profil de chaque personne (25.11, cahier des charges « Locus pour Chloé »).
   Un style d'un coup — Village (Nicolas : chaque module est un lieu, menu détaillé) ou Neutre (Chloé : noms simples,
   menu épuré) —, puis le détail : modules affichés, niveau de détail du menu, noms, palette, étapes de la semaine.
   Gardé dans la ligne « s:profil » de biblio_rows (comme s:routine) et copié sur l'appareil (« locus-profil-<uid> »)
   pour que l'accueil s'affiche tout de suite. Sans profil : Village, c'est-à-dire Locus tel qu'il était.
   Usage : const p = LocusProfil.lire(uid) ; LocusProfil.actif(p,'banque') ; LocusProfil.nom(p,'banque') ;
           LocusProfil.tirer(sb,uid) ; LocusProfil.enregistrer(sb,uid,p) */
(function () {
  'use strict';
  /* id, nom Village, nom Neutre, ce que c'est */
  const MODULES = [
    ['etabli', 'L’Établi', 'Projets', 'Projets et petites tâches'],
    ['bibliotheque', 'La Bibliothèque', 'Notes', 'Notes, journal et vide-tête'],
    ['banque', 'La Banque', 'Banque', 'Comptes et dépenses'],
    ['marche', 'Le Marché', 'Courses', 'Liste de courses et envies'],
    ['forge', 'La Forge', 'Sport', 'Programme et séances d’entraînement'],
    ['mine', 'La Mine', 'Factures et heures', 'Travail indépendant : mandats, heures, factures'],
    ['semaine', 'Démarrer la semaine', 'Ma semaine', 'Organiser la semaine (routine)'],
  ];
  /* étapes de « Ma semaine » / de la routine du lundi, dans l'ordre (index.html : CLES) */
  const ETAPES = [
    ['humeur', 'Bilan : ta semaine passée'], ['journal', 'Bilan : le journal et les objectifs'], ['boites', 'Admin : vider les boîtes'],
    ['banque', 'Admin : le point de la Banque'], ['report', 'Les tâches pas faites'], ['vide', 'Vider la tête'],
    ['deuxmin', 'Les tâches de 2 minutes'], ['agenda', 'L’agenda (Proton)'], ['projets', 'Placer les projets'],
    ['forge', 'Placer les entraînements'], ['taches', 'Placer les tâches'], ['claude', 'Le texte pour Claude'],
  ];
  const TOUTES = ETAPES.map((e) => e[0]);
  const STYLES = {
    village: { style: 'village', menu: 'detail', palette: 'lieux', semaine: 'heures',
      modules: { etabli: 1, bibliotheque: 1, banque: 1, marche: 1, forge: 1, mine: 1, semaine: 1 }, etapes: TOUTES.slice() },
    neutre: { style: 'neutre', menu: 'epure', palette: 'doux', semaine: 'heures',
      modules: { etabli: 0, bibliotheque: 1, banque: 1, marche: 0, forge: 0, mine: 0, semaine: 1 }, etapes: ['report', 'vide', 'deuxmin', 'projets', 'taches'] },
  };
  /* couleurs des tuiles de l'accueil : [fond, texte] ; « lieux » = les couleurs de chaque lieu (commun/lieux.css) */
  const PALETTES = {
    lieux: { nom: 'Lieux', c: null },
    doux: { nom: 'Doux', c: { etabli: ['#F1E2C6', '#4A3B22'], bibliotheque: ['#F2DADA', '#4C2626'], banque: ['#D5E8DC', '#1F3A2B'], marche: ['#E2EED3', '#2C3B1E'], forge: ['#E4DEF1', '#2E2742'], mine: ['#DCE6F1', '#22324A'] } },
    contraste: { nom: 'Contraste', c: { etabli: ['#F2B233', '#1A1200'], bibliotheque: ['#C8273A', '#FFFFFF'], banque: ['#0F7A4A', '#FFFFFF'], marche: ['#2E9E3A', '#FFFFFF'], forge: ['#1A1A1A', '#FFFFFF'], mine: ['#2F55D4', '#FFFFFF'] } },
    sobre: { nom: 'Sobre', c: { etabli: ['#E6E8EC', '#1E2128'], bibliotheque: ['#D9DDE3', '#1E2128'], banque: ['#CBD1DA', '#1E2128'], marche: ['#BEC6D1', '#1E2128'], forge: ['#B1BAC7', '#1E2128'], mine: ['#A5AFBE', '#1E2128'] } },
  };
  const cle = (uid) => 'locus-profil-' + (uid || '');
  const copie = (o) => JSON.parse(JSON.stringify(o));
  /* le profil complet : celui enregistré, complété par les valeurs de son style */
  function complet(p) {
    const base = copie(STYLES[(p && p.style) === 'neutre' ? 'neutre' : 'village']);
    if (!p) return base;
    return Object.assign(base, p, { modules: Object.assign(base.modules, p.modules || {}), noms: Object.assign({}, p.noms || {}), etapes: Array.isArray(p.etapes) ? p.etapes.slice() : base.etapes });
  }
  function brut(uid) { try { return JSON.parse(localStorage.getItem(cle(uid)) || 'null'); } catch (e) { return null; } }
  function uidLocal() { try { const s = JSON.parse(localStorage.getItem('orga-auth') || 'null'); return (s && (s.user || (s.currentSession && s.currentSession.user)) || {}).id || ''; } catch (e) { return ''; } }
  const lire = (uid) => complet(brut(uid || uidLocal()));
  const existe = (uid) => !!brut(uid || uidLocal());
  function garder(uid, p) { try { localStorage.setItem(cle(uid), JSON.stringify(p)); } catch (e) {} }
  /* un nouveau style remet les modules, le menu, la palette et les étapes de ce style ; les noms personnels restent */
  function nouveauStyle(p, style) { const s = copie(STYLES[style] || STYLES.village); return Object.assign(s, { noms: (p && p.noms) || {} }); }
  const actif = (p, id) => !p || !p.modules || p.modules[id] !== 0 && p.modules[id] !== false;
  const nomDefaut = (p, id) => { const m = MODULES.find((x) => x[0] === id); return m ? ((p && p.style) === 'neutre' ? m[2] : m[1]) : id; };
  const nom = (p, id) => (p && p.noms && p.noms[id] && String(p.noms[id]).trim()) || nomDefaut(p, id);
  const couleurs = (p, id) => { const pa = PALETTES[(p && p.palette) || 'lieux']; return pa && pa.c ? pa.c[id] || null : null; };
  /* CSS des tuiles de l'accueil pour la palette choisie (rien pour « Lieux ») */
  function css(p, sel) {
    const pa = PALETTES[(p && p.palette) || 'lieux']; if (!pa || !pa.c) return '';
    return Object.entries(pa.c).map(([id, [f, t]]) => `${sel || ''} [data-lieu="${id}"]{--page:${f};--on-page:${t}}`).join('\n');
  }
  async function tirer(sb, uid) {
    if (!sb || !uid || !navigator.onLine) return lire(uid);
    try {
      const { data, error } = await sb.from('biblio_rows').select('data,deleted').eq('key', 's:profil').maybeSingle(); if (error) throw error;
      const loc = brut(uid);
      /* le plus récent gagne : un réglage fait hors ligne sur cet appareil n'est pas écrasé, il repart vers Supabase */
      if (data && !data.deleted && data.data && !(loc && loc.le && String(loc.le) > String(data.data.le || ''))) garder(uid, data.data);
      else if (loc && loc.le && (!data || !data.data || String(loc.le) > String(data.data.le || ''))) enregistrer(sb, uid, loc);
    } catch (e) {}
    return lire(uid);
  }
  async function enregistrer(sb, uid, p) {
    const q = Object.assign({}, p, { le: new Date().toISOString() }); garder(uid, q);
    if (!sb || !uid) return false;
    try { const { error } = await sb.from('biblio_rows').upsert({ user_id: uid, key: 's:profil', data: q, deleted: false }, { onConflict: 'user_id,key' }); if (error) throw error; return true; }
    catch (e) { return false; }
  }
  window.LocusProfil = { MODULES, ETAPES, STYLES, PALETTES, lire, existe, garder, complet, nouveauStyle, actif, nom, nomDefaut, couleurs, css, tirer, enregistrer, uidLocal };
})();
