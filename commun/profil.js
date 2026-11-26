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
    ['humeur', 'Bilan : ta semaine passée'], ['journal', 'Bilan : le journal et les objectifs'], ['sport', 'Bilan : la Forge'], ['boites', 'Admin : vider les boîtes'],
    ['banque', 'Admin : le point de la Banque'], ['report', 'Les tâches pas faites'], ['vide', 'Vider la tête'],
    ['deuxmin', 'Les tâches de 2 minutes'], ['agenda', 'L’agenda (Proton)'], ['projets', 'Placer les projets'],
    ['forge', 'Placer les entraînements'], ['taches', 'Placer les tâches'], ['claude', 'Le texte pour Claude'],
  ];
  const TOUTES = ETAPES.map((e) => e[0]);
  /* [étape, placée après, ajoutée le] */
  const NOUVELLES = [['sport', 'journal', '2026-11-26T19:30:00Z']];
  /* palette et fond par défaut de chaque style : commun/couleurs.js (chargé avant, dans le <head>) */
  const DC = (window.LocusCouleurs && LocusCouleurs.DEFAUT) || { village: { palette: 'lieux', fond: 'sombre' }, neutre: { palette: 'doux', fond: 'clair' } };
  const STYLES = {
    village: { style: 'village', menu: 'detail', palette: DC.village.palette, fond: DC.village.fond, semaine: 'heures',
      modules: { etabli: 1, bibliotheque: 1, banque: 1, marche: 1, forge: 1, mine: 1, semaine: 1 }, etapes: TOUTES.slice() },
    neutre: { style: 'neutre', menu: 'epure', palette: DC.neutre.palette, fond: DC.neutre.fond, semaine: 'heures',
      modules: { etabli: 0, bibliotheque: 1, banque: 1, marche: 0, forge: 0, mine: 0, semaine: 1 }, etapes: ['report', 'vide', 'deuxmin', 'projets', 'taches'] },
  };
  const cle = (uid) => 'locus-profil-' + (uid || '');
  const copie = (o) => JSON.parse(JSON.stringify(o));
  /* le profil complet : celui enregistré, complété par les valeurs de son style */
  function complet(p) {
    const base = copie(STYLES[(p && p.style) === 'neutre' ? 'neutre' : 'village']);
    if (!p) return base;
    const et = Array.isArray(p.etapes) ? p.etapes.slice() : base.etapes;
    /* une étape ajoutée après l'enregistrement du profil apparaît en Village (date de l'ajout) ; décochée ensuite, elle le reste */
    NOUVELLES.forEach(([k, apres, le]) => { if (base.style === 'village' && Array.isArray(p.etapes) && !et.includes(k) && String(p.le || '') < le) { const i = et.indexOf(apres); et.splice(i < 0 ? et.length : i + 1, 0, k); } });
    return Object.assign(base, p, { modules: Object.assign(base.modules, p.modules || {}), noms: Object.assign({}, p.noms || {}), etapes: et });
  }
  function brut(uid) { try { return JSON.parse(localStorage.getItem(cle(uid)) || 'null'); } catch (e) { return null; } }
  function uidLocal() { try { const s = JSON.parse(localStorage.getItem('orga-auth') || 'null'); return (s && (s.user || (s.currentSession && s.currentSession.user)) || {}).id || ''; } catch (e) { return ''; } }
  const lire = (uid) => complet(brut(uid || uidLocal()));
  const existe = (uid) => !!brut(uid || uidLocal());
  /* gardé sur l'appareil ; les couleurs suivent tout de suite (commun/couleurs.js ; les autres pages par l'évènement « storage ») */
  function garder(uid, p) { try { localStorage.setItem(cle(uid), JSON.stringify(p)); localStorage.removeItem('locus-theme-' + uid); } catch (e) {} if (window.LocusCouleurs) LocusCouleurs.poser(p); }
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
      else if (loc && loc.le && (!data || !data.data || String(loc.le) > String(data.data.le || ''))) enregistrer(sb, uid, loc, true);
    } catch (e) {}
    return lire(uid);
  }
  /* garderLe : renvoyer tel quel un profil déjà daté (rattrapage hors ligne), sans le rajeunir */
  async function enregistrer(sb, uid, p, garderLe) {
    const q = Object.assign({}, p, garderLe && p.le ? {} : { le: new Date().toISOString() }); garder(uid, q);
    if (!sb || !uid) return false;
    try { const { error } = await sb.from('biblio_rows').upsert({ user_id: uid, key: 's:profil', data: q, deleted: false }, { onConflict: 'user_id,key' }); if (error) throw error; return true; }
    catch (e) { return false; }
  }
  window.LocusProfil = { MODULES, ETAPES, STYLES, lire, existe, garder, complet, nouveauStyle, actif, nom, nomDefaut, tirer, enregistrer, uidLocal };
})();
