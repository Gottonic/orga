/* ORGA — cadre commun : la barre d'état du téléphone prend toujours la couleur de l'en-tête de l'app.
   Le navigateur gardait parfois l'ancienne couleur d'une app (celle d'avant un changement) : on remplace la balise
   « theme-color » par une neuve, de la couleur réelle de l'en-tête, à l'ouverture et à chaque retour sur l'app.
   À inclure en bas de chaque page : <script src="../commun/cadre.js"></script> */
(function () {
  'use strict';
  function appliquer() {
    const h = document.querySelector('header.oh'); if (!h) return;
    const c = getComputedStyle(h).backgroundColor; if (!c || c === 'rgba(0, 0, 0, 0)') return;
    /* la nouvelle balise d'abord, puis on enlève les anciennes : sans balise, même un instant, Android reprend la couleur
       de l'icône de l'app (dorée pour la Bibliothèque, par exemple) et la garde parfois */
    const anciennes = [...document.querySelectorAll('meta[name="theme-color"]')];
    if (anciennes.length === 1 && anciennes[0].content === c) return;
    const m = document.createElement('meta'); m.name = 'theme-color'; m.content = c; document.head.appendChild(m);
    anciennes.forEach((x) => x.remove());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', appliquer); else appliquer();
  addEventListener('pageshow', appliquer);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(appliquer, 50); });
})();
