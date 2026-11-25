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
    village: { style: 'village', menu: 'detail', palette: 'lieux', fond: 'sombre', semaine: 'heures',
      modules: { etabli: 1, bibliotheque: 1, banque: 1, marche: 1, forge: 1, mine: 1, semaine: 1 }, etapes: TOUTES.slice() },
    neutre: { style: 'neutre', menu: 'epure', palette: 'doux', fond: 'clair', semaine: 'heures',
      modules: { etabli: 0, bibliotheque: 1, banque: 1, marche: 0, forge: 0, mine: 0, semaine: 1 }, etapes: ['report', 'vide', 'deuxmin', 'projets', 'taches'] },
  };
  /* palettes (25.11) : pour chaque module, [fond, texte sur le fond, accent, texte sur l'accent] ; « lieux » = commun/lieux.css.
     Le reste des couleurs (en-tête, cartes, filets, textes) est tiré de ces quatre : theme(). Les cartes restent claires. */
  const PALETTES = {
    lieux: { nom: 'Lieux', c: null },
    doux: { nom: 'Doux', cartes: 'teinte', c: { etabli: ['#F1E2C6', '#3B2F1B', '#9A6A1A', '#FFFFFF'], bibliotheque: ['#F2DADA', '#3F2020', '#A8434F', '#FFFFFF'], banque: ['#D5E8DC', '#1A3326', '#2F7A52', '#FFFFFF'], marche: ['#E2EED3', '#26341A', '#4F8A2E', '#FFFFFF'], forge: ['#E4DEF1', '#28223A', '#6A55A8', '#FFFFFF'], mine: ['#DCE6F1', '#1E2C40', '#3768A8', '#FFFFFF'] } },
    contraste: { nom: 'Contraste', cartes: 'blanc', c: { etabli: ['#F2B233', '#1A1200', '#1A1200', '#F2B233'], bibliotheque: ['#C8273A', '#FFFFFF', '#C8273A', '#FFFFFF'], banque: ['#0F7A4A', '#FFFFFF', '#0F7A4A', '#FFFFFF'], marche: ['#2E9E3A', '#FFFFFF', '#1F7A2A', '#FFFFFF'], forge: ['#1A1A1A', '#FFFFFF', '#1A1A1A', '#FFFFFF'], mine: ['#2F55D4', '#FFFFFF', '#2F55D4', '#FFFFFF'] } },
    sobre: { nom: 'Sobre', cartes: 'teinte', c: { etabli: ['#E6E8EC', '#1E2128', '#3A4250', '#FFFFFF'], bibliotheque: ['#D9DDE3', '#1E2128', '#3A4250', '#FFFFFF'], banque: ['#CBD1DA', '#1E2128', '#3A4250', '#FFFFFF'], marche: ['#BEC6D1', '#1E2128', '#3A4250', '#FFFFFF'], forge: ['#B1BAC7', '#1E2128', '#3A4250', '#FFFFFF'], mine: ['#A5AFBE', '#1E2128', '#3A4250', '#FFFFFF'] } },
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => '#' + hex(a).map((x, i) => Math.round(x + (hex(b)[i] - x) * t).toString(16).padStart(2, '0')).join('');
  /* toutes les couleurs d'un module (les jetons de commun/lieux.css) pour la palette du profil ; null = celles du lieu */
  function theme(p, id) {
    const pa = PALETTES[(p && p.palette) || 'lieux']; if (!pa || !pa.c || !pa.c[id]) return null;
    const [page, on, acc, onAcc] = pa.c[id], blanc = pa.cartes === 'blanc';
    return { 'color-scheme': 'light', '--page': page, '--on-page': on, '--on-page-2': mix(on, page, 0.35), '--head': mix(page, on, 0.08), '--on-head': on,
      '--surface': blanc ? '#FFFFFF' : mix(page, '#FFFFFF', 0.8), '--surface-2': blanc ? '#F1F1F1' : mix(page, '#FFFFFF', 0.55), '--line': blanc ? '#D6D6D6' : mix(page, '#000000', 0.13),
      '--ink': '#1E1E22', '--ink-2': '#3C3C44', '--ink-3': '#5E5E68', '--accent': acc, '--on-acc': onAcc,
      '--accent-soft': mix(acc, '#FFFFFF', 0.85), '--accent-ink': mix(acc, '#000000', 0.25), '--good': '#2E7D4F', '--bad': '#B3261E', '--warn': '#8A5A00' };
  }
  const regles = (t) => Object.entries(t).map(([k, v]) => k + ':' + v).join(';');
  /* CSS des tuiles de l'accueil (sel = '.apps') ou d'une app entière (sel vide) */
  function css(p, sel) {
    const pa = PALETTES[(p && p.palette) || 'lieux']; if (!pa || !pa.c) return '';
    return Object.keys(pa.c).map((id) => `${sel ? sel + ' ' : ''}[data-lieu="${id}"]{${regles(theme(p, id))}}`).join('\n');
  }
  /* le fond de l'accueil de Locus en clair (25.11 : en Neutre, demande de Nicolas) ; « sombre » = le lilas de commun/lieux.css */
  const LOCUS_CLAIR = { 'color-scheme': 'light', '--page': '#F4F2EC', '--on-page': '#23212A', '--on-page-2': '#6E6977', '--head': '#EAE6DD', '--on-head': '#23212A',
    '--surface': '#FFFFFF', '--surface-2': '#EFECE5', '--line': '#DCD7CC', '--ink': '#23212A', '--ink-2': '#4A4652', '--ink-3': '#6E6977',
    '--accent': '#7B6BB5', '--on-acc': '#FFFFFF', '--accent-soft': '#ECE8F6', '--accent-ink': '#5B4C95', '--good': '#2E7D4F', '--bad': '#B3261E', '--warn': '#8A5A00' };
  const cssFond = (p) => (complet(p).fond === 'clair' ? `[data-lieu="locus"]{${regles(LOCUS_CLAIR)}}` : '');
  const couleurs = (p, id) => { const t = theme(p, id); return t ? [t['--page'], t['--on-page']] : null; };
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
  /* garde aussi le CSS de la palette, que commun/cadre.js pose dans chaque app sans charger ce fichier */
  function garder(uid, p) { try { localStorage.setItem(cle(uid), JSON.stringify(p)); localStorage.setItem('locus-theme-' + uid, css(complet(p), '') + '\n' + cssFond(p)); } catch (e) {} }
  /* un nouveau style remet les modules, le menu, la palette et les étapes de ce style ; les noms personnels restent */
  function nouveauStyle(p, style) { const s = copie(STYLES[style] || STYLES.village); return Object.assign(s, { noms: (p && p.noms) || {} }); }
  const actif = (p, id) => !p || !p.modules || p.modules[id] !== 0 && p.modules[id] !== false;
  const nomDefaut = (p, id) => { const m = MODULES.find((x) => x[0] === id); return m ? ((p && p.style) === 'neutre' ? m[2] : m[1]) : id; };
  const nom = (p, id) => (p && p.noms && p.noms[id] && String(p.noms[id]).trim()) || nomDefaut(p, id);
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
  window.LocusProfil = { MODULES, ETAPES, STYLES, PALETTES, theme, cssFond, lire, existe, garder, complet, nouveauStyle, actif, nom, nomDefaut, couleurs, css, tirer, enregistrer, uidLocal };
})();
