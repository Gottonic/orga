/* Locus — pictos au trait (charte du 15.11.2026, voir commun/CHARTE.md).
   Grille 20×20, centrés, traits de 1,8, bouts carrés, angles vifs, le moins de traits possible.
   Ils remplacent les émojis dans l'interface ; les émojis choisis pour les projets et domaines de l'Établi restent.
   Usage : Pictos.svg('mine')  →  <svg class="ic" …>  (le style .ic est dans commun/lieux.css)
           Pictos.plaque('mine') → le picto sur sa plaque (couleur de l'accent du lieu) */
(function () {
  'use strict';
  const P = {
    /* les apps (logos) */
    locus: '<circle cx="10" cy="10" r="8"/><path d="M8.5 8.5h3v3h-3zM10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18"/>',
    etabli: '<path d="M1 4.5h18M3 4.5v11M17 4.5v11M3 10.5h14"/>',
    banque: '<path d="M3 11.5a7 7 0 0 1 14 0zM3 15.5h14"/>',
    forge: '<path d="M3 17l7-7 7 7M3 10l7-7 7 7"/>',
    marche: '<path d="M2 4h16v12H2zM2 10h16"/>',
    mine: '<path d="M1 6.5c5-5 13-5 18 0M10 3v14.5"/>',
    bibliotheque: '<path d="M2.5 2.5v15M6.5 2.5v15M10.5 2.5v15M13.5 3l4 14.5"/>',
    /* interface */
    plus: '<path d="M10 3v14M3 10h14"/>',
    reglages: '<circle cx="10" cy="10" r="3"/><path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3M4 4l2.1 2.1M13.9 13.9 16 16M16 4l-2.1 2.1M6.1 13.9 4 16"/>',
    idee: '<path d="M7 15h6M8 18h4M10 2a5 5 0 0 0-3.2 8.8V13h6.4v-2.2A5 5 0 0 0 10 2z"/>',
    retour: '<path d="M12 4l-6 6 6 6"/>',
    suivant: '<path d="M8 4l6 6-6 6"/>',
    /* éditeur, listes */
    retrait: '<path d="M3 3v14M17 10H7M11 6l-4 4 4 4"/>',
    emboiter: '<path d="M17 3v14M3 10h10M9 6l4 4-4 4"/>',
    monter: '<path d="M10 17V4M5 9l5-5 5 5"/>',
    descendre: '<path d="M10 3v13M5 11l5 5 5-5"/>',
    fait: '<path d="M3 10.5l4.5 4.5L17 5"/>',
    note: '<path d="M4 3h12v14H4zM7 7h6M7 10h6M7 13h3"/>',
    archiver: '<path d="M2 4h16v4H2zM3.5 8v9h13V8M8 11h4"/>',
    supprimer: '<path d="M4 4l12 12M16 4 4 16"/>',
    entree: '<path d="M2 11h5l1.5 3h3L13 11h5M2 11l3-8h10l3 8v6H2z"/>',
    journal: '<path d="M4 2h12v16H4zM7.5 2v16"/>',
    autres: '<path d="M10 2l8 8-8 8-8-8z"/>',
    sync: '<path d="M16 11a6 6 0 1 1-2-5.2M15 2v4h-4"/>',
    alerte: '<path d="M10 2 18.5 17h-17zM10 8v4M10 14v1"/>'
  };
  const svg = (k, cls) => P[k] ? `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 20 20" aria-hidden="true">${P[k]}</svg>` : '';
  window.Pictos = { P, svg, plaque: (k, cls) => `<span class="plaque${cls ? ' ' + cls : ''}">${svg(k)}</span>` };
})();
