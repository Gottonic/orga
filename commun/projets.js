/* Locus — la fiche projet commune (étape 1 du plan, 14.11.2026).
   Tout est un projet, de 4 h à ∞. Un projet peut en contenir d'autres, sur deux niveaux.
   Chaque projet est perso ou pro (un sous-projet suit son parent, sauf s'il dit autre chose).
   Les projets vivent dans la table de l'Établi (`rows`, lignes `p:<id>`) ; ce module ne lit ni n'écrit
   la base : il donne les règles communes, pour l'Établi aujourd'hui et pour la Mine, la Banque
   et la Bibliothèque ensuite.

   Champs d'un projet (en plus de ceux du planning de l'Établi : weeks, days, size, dur, imp, due…) :
     parent  id du projet qui le contient (facultatif ; un parent n'a jamais lui-même de parent)
     nature  'perso' | 'pro' ; vide = celle du parent, ou perso au premier niveau
     later   true = Idée (pas encore décidé)
     prevu   'AAAA-MM-JJ' : Prévu, commence à cette date (devient En cours tout seul ce jour-là,
             ou dès qu'il est placé au planning avant)
     closed  'AAAA-MM-JJ' : Archivé ce jour-là
     fin     { type: 'termine' | 'abandonne', raison } quand il est archivé
     touche  'AAAA-MM-JJ' : dernière fois que le projet a bougé (pour les projets qui dorment)
     size    'perm' = ∞ (sans durée ni fin) ; 'mini' = moins d'un jour */
(function () {
  'use strict';
  const ETATS = { idee: 'Idée', prevu: 'Prévu', encours: 'En cours', archive: 'Archivé' };
  const FINS = { termine: 'Terminé', abandonne: 'Abandonné' };
  const DORT_JOURS = 122; /* environ 4 mois */

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
  const estMini = (p) => !!p && p.size === 'mini';

  /* état commun : idee | prevu | encours | archive */
  function etat(p, aujourdhui) {
    if (!p) return null;
    if (p.closed) return 'archive';
    if (p.later) return 'idee';
    if (p.prevu && p.prevu > aujourdhui && !places(p).some((d) => d <= aujourdhui)) return 'prevu';
    return 'encours';
  }

  /* get : fonction id → projet */
  const parentDe = (p, get) => (p && p.parent ? get(p.parent) || null : null);
  function nature(p, get) {
    if (!p) return 'perso';
    if (p.nature === 'pro' || p.nature === 'perso') return p.nature;
    const par = parentDe(p, get);
    if (par && (par.nature === 'pro' || par.nature === 'perso')) return par.nature;
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
  /* peut-on ranger p sous cand ? (deux niveaux au plus) */
  function parentPossible(cand, p, liste) {
    if (!cand || !p || cand.id === p.id) return false;
    if (cand.parent || cand.closed || estMini(cand)) return false;
    if (enfants(p.id, liste).length) return false;
    return true;
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

  window.Projets = { ETATS, FINS, DORT_JOURS, etat, nature, parentDe, enfants, racinePro, parentPossible, estInfini, estMini, places, derniereActivite, dort, depuis, lundi };
})();
