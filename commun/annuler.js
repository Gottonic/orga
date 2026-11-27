/* Locus — Annuler / refaire, commun à toutes les apps (étape 11 du plan, 27.11.2026 ; d'abord pour l'Établi).
   L'app dit, à chaque enregistrement, l'état d'avant des lignes qui changent (noter) ; le module garde des « pas ».
   Un pas = tout ce qui change pendant un même geste : un nouveau pas commence à chaque toucher / clic, ou après une pause.
   Le bouton ↶ de l'en-tête (commun/cadre.js) envoie « locus:annuler » ; le module répond par « locus:annulable » {n, refaire}.
   Ctrl+Z annule, Ctrl+Maj+Z ou Ctrl+Y refait (pas pendant une saisie : le champ garde son propre Ctrl+Z).

   Usage :
     const U = LocusAnnuler.creer({
       filtre:   (cle) => bool,              lignes suivies (ex. /^[pd]:/)
       lire:     (cle) => valeur | null,     valeur actuelle d'une ligne (n'importe quel format que remettre comprend)
       remettre: (Map cle → valeur | null, refaire) => void   remettre ces valeurs (null = la ligne n'existait pas)
       message:  (texte) => void             facultatif (toast)
     });
     U.noter(cle, avant)   avant d'écrire une ligne suivie ; U.couper() force un nouveau pas ;
     U.pause(true/false)   ne rien noter (reprises, synchro) ; U.n() nombre de pas. */
(function () {
  'use strict';
  function creer(o) {
    const H = { pile: [], refaire: [], tx: null, dernier: 0, coupe: true, rejeu: false, pause: 0 };
    const MAX = o.max || 100, GROUPE = o.groupe || 1500;
    const dire = () => document.dispatchEvent(new CustomEvent('locus:annulable', { detail: { n: H.pile.length, refaire: H.refaire.length } }));
    function noter(cle, avant) {
      if (H.rejeu || H.pause > 0 || (o.filtre && !o.filtre(cle))) return;
      const t = Date.now();
      if (!H.tx || H.coupe || t - H.dernier > GROUPE) { H.tx = { av: new Map() }; H.pile.push(H.tx); if (H.pile.length > MAX) H.pile.shift(); H.coupe = false; }
      H.refaire = []; if (!H.tx.av.has(cle)) H.tx.av.set(cle, avant == null ? null : avant); H.dernier = t; dire();
    }
    const couper = () => { H.coupe = true; };
    function annuler(refaire) {
      couper(); const src = refaire ? H.refaire : H.pile, tx = src.pop();
      if (!tx) { if (o.message) o.message(refaire ? 'Rien à refaire' : 'Rien à annuler'); dire(); return false; }
      const inv = { av: new Map() }; tx.av.forEach((v, k) => { const x = o.lire(k); inv.av.set(k, x == null ? null : x); });
      H.rejeu = true; try { o.remettre(tx.av, !!refaire); } finally { H.rejeu = false; }
      (refaire ? H.pile : H.refaire).push(inv); H.tx = null; dire(); return true;
    }
    document.addEventListener('locus:annuler', (e) => annuler(!!(e.detail && e.detail.refaire)));
    document.addEventListener('pointerdown', (e) => { if (!(e.target && e.target.closest && e.target.closest('[data-annuler]'))) couper(); }, true);
    if (o.clavier !== false) document.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return; const k = String(e.key || '').toLowerCase(); if (k !== 'z' && k !== 'y') return;
      const t = e.target || {}, saisie = t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes(t.type));
      if (saisie) return; e.preventDefault(); e.stopPropagation(); annuler(k === 'y' || e.shiftKey);
    }, true);
    return { noter, couper, annuler, n: () => H.pile.length, pause: (v) => { H.pause = Math.max(0, H.pause + (v ? 1 : -1)); }, dire };
  }
  window.LocusAnnuler = { creer };
})();
