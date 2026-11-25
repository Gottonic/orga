/* Locus — les couleurs (25.11, refait après les retours de Nicolas : clignotement, chiffres illisibles).
   UNE seule étape : ce fichier est chargé dans le <head> de chaque page, après les feuilles de style, sans « defer ».
   Il lit le profil gardé sur l'appareil (« locus-profil-<uid> », écrit par commun/profil.js) et pose tout de suite
   les couleurs de la palette choisie, avant le premier affichage : plus d'ancienne couleur qui clignote.

   Comment ça marche :
   - commun/lieux.css donne les couleurs « Lieux » (Village), faites à la main, et sert quand rien n'est choisi.
   - Une palette donne, pour chaque app, trois couleurs seulement : [fond de la page, fond des cartes, accent].
     jetons() en tire tous les jetons de lieux.css (--page, --ink, --accent-ink, --good…), en vérifiant le contraste :
     un texte n'est jamais sous 4,5:1 sur son fond (7:1 pour le texte principal), clair ou sombre.
   - Les apps n'écrivent plus de couleur d'interface en dur : elles utilisent ces jetons, ou les mélanges communs
     de lieux.css (--creux, --line-2, --good-soft…). Les couleurs de données (catégories, projets, activités) restent.
   - Le fond de l'accueil (sombre = lilas de lieux.css, clair = crème) est un choix à part, valable avec toutes les palettes.
   Pour ajouter une palette : une entrée dans PALETTES, rien d'autre. L'accent doit se voir sur le fond de la page ET
   sur les cartes (contraste d'au moins 3:1 avec les deux) : les apps s'en servent sur les deux. */
(function () {
  'use strict';
  const APPS = ['etabli', 'bibliotheque', 'banque', 'marche', 'forge', 'mine'];
  /* [fond de la page, fond des cartes, accent] par app */
  const PALETTES = {
    lieux: { nom: 'Lieux', d: 'Une ambiance par app (Village)', c: null },
    doux: { nom: 'Doux', d: 'Pastels clairs', c: {
      etabli: ['#F1E2C6', '#FFFBF3', '#9A6A1A'], bibliotheque: ['#F2DADA', '#FFF8F7', '#A8434F'], banque: ['#D5E8DC', '#F7FCF9', '#2F7A52'],
      marche: ['#E2EED3', '#FBFDF7', '#4F8A2E'], forge: ['#E4DEF1', '#FBFAFE', '#6A55A8'], mine: ['#DCE6F1', '#F8FBFE', '#3768A8'] } },
    contraste: { nom: 'Contraste', d: 'Couleurs vives, cartes blanches', c: {
      etabli: ['#F2B233', '#FFFFFF', '#1A1200'], bibliotheque: ['#C8273A', '#FFFFFF', '#1C0508'], banque: ['#0F7A4A', '#FFFFFF', '#03140C'],
      marche: ['#2E9E3A', '#FFFFFF', '#0E3A14'], forge: ['#E8662E', '#FFFFFF', '#1A1A1A'], mine: ['#2F55D4', '#FFFFFF', '#050A1F'] } },
    sobre: { nom: 'Sobre', d: 'Gris calmes, un seul accent', c: {
      etabli: ['#E6E8EC', '#FFFFFF', '#3A4250'], bibliotheque: ['#DEE1E6', '#FFFFFF', '#3A4250'], banque: ['#D6DBE2', '#FFFFFF', '#3A4250'],
      marche: ['#CED4DC', '#FFFFFF', '#3A4250'], forge: ['#C6CDD6', '#FFFFFF', '#3A4250'], mine: ['#BEC6D0', '#FFFFFF', '#3A4250'] } },
    nuit: { nom: 'Nuit', d: 'Tout en sombre, doux pour les yeux', c: {
      etabli: ['#231E17', '#2F281F', '#E2B657'], bibliotheque: ['#26181B', '#342226', '#E59AA5'], banque: ['#16231F', '#20322C', '#7FC59A'],
      marche: ['#1B2416', '#26311F', '#9CCB72'], forge: ['#1A1714', '#26211C', '#8DBA88'], mine: ['#171D26', '#222A35', '#8DB4F0'] } },
  };
  /* le fond de l'accueil ; « sombre » = commun/lieux.css */
  const FONDS = { sombre: { nom: 'Sombre', d: 'Le lilas profond de Locus', c: null }, clair: { nom: 'Clair', d: 'Un fond crème, lumineux', c: ['#F4F2EC', '#FFFFFF', '#7B6BB5'] } };
  /* ce que prend un style quand la personne n'a rien choisi (commun/profil.js s'en sert aussi) */
  const DEFAUT = { village: { palette: 'lieux', fond: 'sombre' }, neutre: { palette: 'doux', fond: 'clair' } };

  /* ---------- calcul des couleurs ---------- */
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hex = (a) => '#' + a.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
  const lum = (h) => { const v = rgb(h).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const clair = (h) => contraste(h, '#000000') >= contraste(h, '#FFFFFF');
  const extreme = (fond) => (clair(fond) ? '#000000' : '#FFFFFF');
  /* la couleur c, poussée vers le noir (fond clair) ou le blanc (fond sombre) juste assez pour être lisible sur fond */
  function lisible(c, fond, min) {
    for (let t = 0; t <= 1.0001; t += 0.04) { const x = mix(c, extreme(fond), t); if (contraste(x, fond) >= min) return x; }
    return extreme(fond);
  }
  /* tous les jetons de commun/lieux.css à partir de [page, carte, accent] */
  function jetons(g) {
    const [page, carte, acc] = g;
    const onPage = lisible(mix(page, extreme(page), 0.82), page, 7);
    const head = mix(page, '#000000', clair(page) ? 0.06 : 0.2);
    const ink = lisible(mix(carte, extreme(carte), 0.86), carte, 10);
    const blanc = contraste('#FFFFFF', acc), noir = lisible(mix(acc, '#000000', 0.8), acc, 4.5);
    return {
      'color-scheme': clair(carte) ? 'light' : 'dark',
      '--page': page, '--on-page': onPage, '--on-page-2': lisible(mix(onPage, page, 0.35), page, 4.5),
      '--head': head, '--on-head': lisible(onPage, head, 7),
      '--surface': carte, '--surface-2': mix(carte, ink, 0.06), '--surface-3': clair(carte) ? mix(carte, '#FFFFFF', 0.65) : mix(carte, '#FFFFFF', 0.07), '--line': mix(carte, ink, 0.16),
      '--ink': ink, '--ink-2': lisible(mix(ink, carte, 0.22), carte, 7), '--ink-3': lisible(mix(ink, carte, 0.4), carte, 4.5),
      '--accent': acc, '--on-acc': blanc >= 4.5 || blanc >= contraste(noir, acc) ? '#FFFFFF' : noir,
      '--accent-soft': mix(acc, carte, 0.84), '--accent-ink': lisible(acc, carte, 4.5),
      '--good': lisible('#3FA66A', carte, 4.5), '--bad': lisible('#E5484D', carte, 4.5), '--warn': lisible('#D99A1E', carte, 4.5),
    };
  }
  const regles = (t) => Object.entries(t).map(([k, v]) => k + ':' + v).join(';');

  /* ---------- le profil (lu ici directement : ce fichier passe avant tous les autres) ---------- */
  function uid() { try { const s = JSON.parse(localStorage.getItem('orga-auth') || 'null'); return (s && (s.user || (s.currentSession && s.currentSession.user)) || {}).id || ''; } catch (e) { return ''; } }
  function choix(p) {
    const d = DEFAUT[(p && p.style) === 'neutre' ? 'neutre' : 'village'];
    return { palette: PALETTES[p && p.palette] ? p.palette : d.palette, fond: FONDS[p && p.fond] ? p.fond : d.fond };
  }
  function profil() { try { return JSON.parse(localStorage.getItem('locus-profil-' + uid()) || 'null'); } catch (e) { return null; } }
  /* les jetons d'une app (ou de 'locus') pour un choix ; null = ceux de commun/lieux.css */
  function de(id, ch) {
    if (id === 'locus') { const f = FONDS[ch.fond]; return f && f.c ? jetons(f.c) : null; }
    const pa = PALETTES[ch.palette]; return pa && pa.c && pa.c[id] ? jetons(pa.c[id]) : null;
  }
  function css(ch) {
    return ['locus'].concat(APPS).map((id) => { const t = de(id, ch); return t ? `[data-lieu="${id}"]{${regles(t)}}` : ''; }).filter(Boolean).join('\n');
  }
  /* pose les couleurs du profil sur la page ; à rappeler quand le profil change */
  function poser(p) {
    const ch = choix(p === undefined ? profil() : p);
    let st = document.getElementById('locus-couleurs');
    if (!st) { st = document.createElement('style'); st.id = 'locus-couleurs'; (document.head || document.documentElement).appendChild(st); }
    const c = css(ch); if (st.textContent !== c) st.textContent = c;
    /* la barre du téléphone : l'en-tête de l'app. Vivaldi : on change le contenu de la balise, jamais la balise elle-même. */
    const lieu = document.documentElement.getAttribute('data-lieu'), m = document.querySelector('meta[name="theme-color"]');
    if (lieu && m) {
      if (!m.dataset.lieux) m.dataset.lieux = m.content;
      const t = de(lieu, ch); const v = t ? t['--head'] : m.dataset.lieux; if (m.content !== v) m.content = v;
    }
    return ch;
  }
  poser();
  /* un réglage changé ailleurs (Réglages, autre onglet, fenêtre de l'accueil) */
  addEventListener('storage', (e) => { if (!e.key || /^locus-profil-|^orga-auth$/.test(e.key)) poser(); });
  window.LocusCouleurs = { APPS, PALETTES, FONDS, DEFAUT, jetons, choix, de, poser, contraste, mix };
})();
