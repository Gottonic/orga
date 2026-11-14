/* Locus — cadre commun : la barre d'état du téléphone prend la couleur de l'en-tête de l'app.
   La couleur est d'abord écrite en dur dans chaque page (<meta name="theme-color">, celle de --head du lieu) :
   Vivaldi sur Android ne lit cette balise qu'au chargement et ignore toute modification ; si on la remplace, il croit
   qu'il n'y en a pas et prend une couleur au hasard dans la page (elle change alors avec les onglets).
   Ici, on ne touche à la balise que si elle manque ou ne correspond pas à l'en-tête (oubli dans une page) : on corrige
   alors son contenu sans l'enlever. À inclure en bas de chaque page : <script src="../commun/cadre.js"></script> */
(function () {
  'use strict';
  const rgb = (v) => { const d = document.createElement('i'); d.style.color = v; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
  function appliquer() {
    const h = document.querySelector('header.oh'); if (!h || !document.body) return;
    const c = getComputedStyle(h).backgroundColor; if (!c || c === 'rgba(0, 0, 0, 0)') return;
    const m = document.querySelector('meta[name="theme-color"]');
    if (!m) { const n = document.createElement('meta'); n.name = 'theme-color'; n.content = c; document.head.appendChild(n); return; }
    if (rgb(m.content) !== c) { m.content = c; if (window.console) console.warn('theme-color de la page à corriger :', c); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', appliquer); else appliquer();
})();
