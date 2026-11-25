/* Locus — cadre commun : la barre d'état du téléphone prend la couleur de l'en-tête de l'app ; le bouton ↶ Annuler de l'en-tête.
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
  /* Bouton ↶ Annuler, à gauche de l'ampoule, dans toutes les apps (16.11, demande de Nicolas).
     Le bouton envoie l'évènement « locus:annuler » ; l'app qui sait annuler y répond et dit, par « locus:annulable »
     ({detail:{n}}), combien de pas peuvent être annulés. Tant qu'une app ne l'a jamais dit, le bouton reste grisé. */
  function annuler() {
    const amp = document.querySelector('header.oh [data-ampoule]'); if (!amp || document.querySelector('header.oh [data-annuler]')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'oh-b'; b.dataset.annuler = ''; b.disabled = true;
    b.setAttribute('aria-label', 'Annuler'); b.title = 'Annuler : pas encore dans cette app';
    b.innerHTML = '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4L3 8l4 4M3 8h9a5 5 0 0 1 0 10H8"/></svg>';
    b.addEventListener('pointerdown', (e) => e.preventDefault()); /* garder le curseur là où il était */
    b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('locus:annuler', { detail: {} })));
    document.addEventListener('locus:annulable', (e) => { const n = (e.detail && e.detail.n) || 0; b.disabled = !n; b.title = n ? 'Annuler (Ctrl+Z)' : 'Rien à annuler'; });
    amp.before(b);
  }
  /* Au premier plan sur l'accueil (18.11, demande de Nicolas) : l'accueil de Locus ouvre l'app dans un cadre par-dessus lui
     (?dans=accueil). Seule la feuille de l'app (#scrim) se voit, sur l'accueil assombri ; quand elle se ferme, le cadre dit
     « fermer » et l'accueil reprend la main. Les messages (toasts) de l'app sont montrés par l'accueil.
     Avec &plein=1 (la Forge), toute l'app se voit, et c'est elle qui dit quand fermer. */
  function premierPlan() {
    const q = new URLSearchParams(location.search); if (q.get('dans') !== 'accueil' || window.parent === window) return;
    const dire = (o) => { try { parent.postMessage(Object.assign({ locus: 1 }, o), location.origin); } catch (e) {} };
    window.LocusDans = { dire };
    /* fenêtre gardée prête en arrière-plan (&attente=1) : l'accueil envoie « ouvrir » au moment du toucher */
    addEventListener('message', (e) => { const d = e.data; if (e.origin !== location.origin || e.source !== parent || !d || d.locus !== 'ouvrir') return; document.dispatchEvent(new CustomEvent('locus:ouvrir', { detail: d })); });
    const html = document.documentElement; html.classList.add('dans-acc');
    if (!q.get('plein')) {
      const st = document.createElement('style');
      st.textContent = 'html.dans-acc,html.dans-acc body{background:transparent!important}html.dans-acc body::before{display:none!important}' +
        'html.dans-acc body>*:not(#scrim):not(#toast):not(.toast):not(#login):not(script){display:none!important}';
      document.head.appendChild(st);
    }
    const sc = document.getElementById('scrim'); let vu = false, t = null;
    if (sc && !q.get('plein')) {
      const voir = () => { if (!sc.hidden) { vu = true; clearTimeout(t); dire({ etat: 'pret' }); } else if (vu) { clearTimeout(t); t = setTimeout(() => { if (sc.hidden) dire({ etat: 'fermer' }); }, 350); } };
      new MutationObserver(voir).observe(sc, { attributes: true, attributeFilter: ['hidden'] }); voir();
    }
    const lg = document.getElementById('login');
    if (lg) { const v = () => { if (!lg.hidden) dire({ etat: 'pret' }); }; new MutationObserver(v).observe(lg, { attributes: true, attributeFilter: ['hidden'] }); v(); }
    const to = document.getElementById('toast') || document.querySelector('.toast');
    if (to) { let der = ''; new MutationObserver(() => { if (to.hidden) { der = ''; return; } const s = to.querySelector('span'), x = ((s || to).textContent || '').trim(); if (x && x !== der) { der = x; dire({ toast: x }); } }).observe(to, { attributes: true, childList: true, subtree: true, characterData: true }); }
  }
  premierPlan();
  /* Une sélection de texte commencée dans une feuille et relâchée sur le fond ne ferme plus la feuille (18.11) :
     le clic n'atteint le fond (#scrim) que si le doigt s'y était posé. */
  let posé = null;
  addEventListener('pointerdown', (e) => { posé = e.target; }, true);
  addEventListener('click', (e) => { const sc = e.target; if (sc && sc.id === 'scrim' && posé && posé !== sc) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  /* Loupe de la recherche commune dans chaque app (18.11) : seulement les éléments de cette app (commun/chercher.js) */
  const ICI = (document.currentScript && document.currentScript.src) || '';
  function chercher() {
    const h = document.querySelector('header.oh'); if (!h || h.querySelector('[data-chercher]') || /[?&]dans=/.test(location.search)) return;
    const apps = ['etabli', 'banque', 'forge', 'marche', 'mine', 'bibliotheque'];
    const app = apps.find((a) => document.documentElement.dataset.lieu === a) || apps.find((a) => location.pathname.includes('/' + a + '/')); if (!app) return;
    const avant = h.querySelector('[data-annuler]') || h.querySelector('[data-ampoule]'); if (!avant) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'oh-b'; b.dataset.chercher = ''; b.setAttribute('aria-label', 'Chercher dans cette app');
    b.innerHTML = '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M12 12l5.5 5.5"/></svg>';
    b.addEventListener('click', () => {
      const go = () => window.LocusChercher && LocusChercher.ouvrir({ app });
      if (window.LocusChercher) return go();
      const s = document.createElement('script'); s.src = ICI.replace(/cadre\.js(\?.*)?$/, 'chercher.js'); s.onload = go; document.head.appendChild(s);
    });
    avant.before(b);
  }
  /* « Mon Locus » (25.11, commun/profil.js) : une app coupée dans le profil renvoie à l'accueil ; le nom choisi
     (ou le nom du style Neutre) remplace celui du lieu dans l'en-tête, l'écran de connexion et le titre de l'onglet. */
  const VILLAGE = { etabli: 'L’Établi', bibliotheque: 'La Bibliothèque', banque: 'La Banque', marche: 'Le Marché', forge: 'La Forge', mine: 'La Mine' };
  const NEUTRE = { etabli: 'Projets', bibliotheque: 'Notes', banque: 'Banque', marche: 'Courses', forge: 'Sport', mine: 'Factures et heures' };
  function profil() {
    try { const a = JSON.parse(localStorage.getItem('orga-auth') || 'null'), uid = a && a.user && a.user.id; if (!uid) return null;
      return JSON.parse(localStorage.getItem('locus-profil-' + uid) || 'null'); } catch (e) { return null; }
  }
  function monLocus() {
    const app = Object.keys(VILLAGE).find((a) => document.documentElement.dataset.lieu === a) || Object.keys(VILLAGE).find((a) => location.pathname.includes('/' + a + '/'));
    const p = profil(); if (!app || !p) return;
    if (p.modules && (p.modules[app] === 0 || p.modules[app] === false) && !/[?&]dans=/.test(location.search)) { location.replace(ICI ? new URL('../', ICI).href : '../'); return; }
    const nom = (p.noms && p.noms[app] && String(p.noms[app]).trim()) || (p.style === 'neutre' ? NEUTRE[app] : '');
    if (!nom || nom === VILLAGE[app]) return;
    document.querySelectorAll('h1').forEach((h) => { if (h.textContent.trim() === VILLAGE[app]) h.textContent = nom; });
    if (document.title.indexOf(VILLAGE[app]) >= 0) document.title = document.title.replace(VILLAGE[app], nom);
  }
  function tout() { monLocus(); appliquer(); annuler(); chercher(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tout); else tout();
})();
