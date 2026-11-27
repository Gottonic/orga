/* Locus — le Calendrier (27.11.2026 ; cahier « Locus pour Chloé », ordre de construction point 4, logique commune point 6).
   Un seul calendrier, trois vues de la même chose : la semaine « simple » (matin / après-midi), la semaine en heures, le mois.
   Tout élément a un jour, et en option un moment (matin / après-midi) OU une heure précise (qui gagne).

   Ce module ne déménage rien : chaque chose reste où elle vit, il la lit et l'écrit là.
     Proton      fonction « calendriers » (lecture seule)                     src 'x'
     projets     p.days, p.weeks (table rows, par Projets.base) ; créneaux       src 'p'
                 h:<semaine>.p['<projet>|<date>'] = [{h:'HH:MM', min, m?}]
                 m = 'matin' | 'aprem' (27.11) : posé sur une demi-journée, sans heure précise. Un ancien créneau
                 08:00 ou 13:30 de 4 h (Établi, 25.11) compte aussi comme une demi-journée.
     séances     carnet logs/<semaine>.sessions[id].day (0…6), lues dans locus/semaines ; heure h.f[id] = 'HH:MM'   src 'f'
     tâches      biblio_rows n:<id> de la racine « taches » : n.jour ; heure h.t[id] = 'HH:MM'                     src 't'
     événements  table locus_evenements (supabase/calendrier.sql)                                                  src 'e'
     échéances   p.due des projets, due des tâches des projets et des domaines (27.11), en lecture : une échéance
                 n'est pas un placement (elle se change dans l'Établi)                                             src 'd'
   Le moment d'une séance ou d'une tâche (sans heure) : h:<semaine>.m = {'f:<id>':'matin', 't:<id>':'aprem'}
   (à part, pour que les anciens lecteurs de h.f / h.t, qui attendent 'HH:MM', ne cassent pas). Choisir un moment efface
   l'heure, et l'inverse.
   Les écritures dans h:<semaine> relisent la ligne avant d'écrire (comme l'Établi, hEdit) : un autre appareil n'est pas écrasé.

   Utilisation :
     const C = Calendrier.creer({ sb, uid, PB, url: SB_URL, cle: SB_KEY, toast });
     const V = C.monter(document.getElementById('cal'), { vue: 'simple', semaine: '2026-W48', placer: 'tout', ouvrir(el){…}, vide(q){…} });
     C.surChangement(() => V.dessiner()); await C.charger(de, a);
   Plus tard (garder la place) : modèles UMA (colonnes modele, modele_role, decalage_min) et rappels (colonne rappels). */
(function () {
  'use strict';
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = (s) => { const a = String(s).split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); };
  const plusJ = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const ecart = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  function wkKey(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dn = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - dn + 3); const y = t.getUTCFullYear(); const f = new Date(Date.UTC(y, 0, 4)); const w = 1 + Math.round(((t - f) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7); return y + '-W' + pad(w); }
  const wkDe = (s) => wkKey(parse(s));
  const lundi = (k) => window.Projets.lundi(k);
  const wkNum = (k) => Number(String(k).split('-W')[1]);
  const jIdx = (s) => (parse(s).getDay() + 6) % 7;
  const auj = () => iso(new Date());
  const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const H0 = 7, H1 = 22, PLAGE = H1 - H0, DEMI = 750; /* 12:30 : la limite matin / après-midi (comme le Planning de l'Établi) */
  const MOMENT_H = { matin: '08:00', aprem: '13:30' }, MOMENT_L = { matin: 'matin', aprem: 'après-midi' };
  const DUREE = { p: 240, f: 60, t: 60, e: 60, x: 60 }, DEFAUT = { p: '08:00', f: '18:00', t: '13:00', e: '09:00', x: '09:00' };
  /* les 5 types de Chloé (cahier des charges, 22.11) ; couleurs de données par type */
  const TYPES = [['activite', 'Activité', '#9BD08F'], ['job', 'Job', '#D6B15E'], ['rdv', 'Rendez-vous', '#8EC9EE'], ['projet', 'Projet', '#C3B6DF'], ['tache', 'Tâche', '#E7A6C8']];
  const TYPE_N = Object.fromEntries(TYPES.map((t) => [t[0], t[1]])), TYPE_C = Object.fromEntries(TYPES.map((t) => [t[0], t[2]]));
  const COUL_CAL = ['#8EC9EE', '#E8826F', '#9BD08F', '#F2C230', '#C3B6DF', '#E7A6C8', '#D6B15E'];
  const COUL_FORGE = '#8DBA88';
  const enMin = (s) => { const m = /^(\d\d):(\d\d)/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
  const hhmm = (x) => pad(Math.floor(x / 60)) + ':' + pad(x % 60);
  const hCourt = (s) => (s ? String(+s.slice(0, 2)) + ':' + s.slice(3, 5) : '');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const copie = (o) => JSON.parse(JSON.stringify(o || {}));
  const msg = (e) => (e && e.message) || String(e);
  const nouvelId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(16) + Math.random().toString(16).slice(2) + '0000-0000-0000-0000').replace(/-/g, '').slice(0, 32);
  const momentDe = (debut) => (enMin(debut) < DEMI ? 'matin' : 'aprem');
  const fmtMin = (m) => (m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + pad(m % 60) : '') : m + ' min');
  function semainesEntre(d0, d1) { const out = []; for (let d = iso(parse(lundi(wkDe(d0)))); d <= d1; d = plusJ(d, 7)) out.push(wkDe(d)); return out; }
  function normL(v) { if (Array.isArray(v)) return v.filter((x) => x && x.h).map((x) => Object.assign({}, x)); if (typeof v === 'string') return [{ h: v, min: 240 }]; return []; }
  /* un créneau de projet → { moment, debut, min } */
  function lireCreneau(c) {
    if (typeof c === 'string') c = { h: c, min: 240 }; if (!c || !c.h) return null; const min = c.min || 240;
    if (c.m === 'matin' || c.m === 'aprem') return { moment: c.m, debut: null, min };
    if (min === 240 && (c.h === '08:00' || c.h === '13:30')) return { moment: c.h === '08:00' ? 'matin' : 'aprem', debut: null, min };
    return { moment: null, debut: c.h, min };
  }
  function ecrireCreneau(q, min) { if (q.debut) return { h: q.debut, min: min || 240 }; if (q.moment) return { h: MOMENT_H[q.moment], min: 240, m: q.moment }; return null; }
  /* l'heure ou le moment d'une séance / tâche dans h:<semaine> */
  function setQ(h, g, id, q) {
    h[g] = h[g] || {}; h.m = h.m || {};
    if (q && q.debut) h[g][id] = q.debut; else delete h[g][id];
    if (q && !q.debut && q.moment) h.m[g + ':' + id] = q.moment; else delete h.m[g + ':' + id];
  }
  const clair = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); if (!m) return false; const n = parseInt(m[1], 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150; };

  /* ================================ les données ================================ */
  function creer(o) {
    const sb = o.sb, uid = o.uid, PB = o.PB, toast = o.toast || (() => {});
    const LS = 'locus-cal-' + uid, ATT = 'locus-cal-attente-' + uid;
    let S = { H: {}, T: {}, F: null, L: {}, EV: {}, PX: { ev: [], cals: [], de: '', a: '', le: '', err: '', erreurs: [] } };
    let evAbsent = false, erreur = '', pxEn = false;
    try { const c = JSON.parse(localStorage.getItem(LS) || 'null'); if (c) S = Object.assign(S, c); } catch (e) {}
    const ecoute = []; const prevenir = () => ecoute.forEach((f) => { try { f(); } catch (e) {} });
    function garder() {
      try { const ks = Object.keys(S.H).sort().slice(-16), H = {}; ks.forEach((k) => { H[k] = S.H[k]; }); localStorage.setItem(LS, JSON.stringify(Object.assign({}, S, { H }))); } catch (e) {}
    }
    const enLigne = () => !!sb && navigator.onLine !== false;
    const attente = () => { try { return JSON.parse(localStorage.getItem(ATT) || '[]'); } catch (e) { return []; } };
    const setAttente = (L) => { try { localStorage.setItem(ATT, JSON.stringify(L)); } catch (e) {} };
    const enAttente = (N) => attente().includes(N);

    function forge() { let loc = null; try { loc = JSON.parse(localStorage.getItem('locus-forge') || 'null'); } catch (e) {} if (loc && (!S.F || String(loc.le) > String(S.F.le))) return loc; return S.F; }
    /* les séances publiées par la Forge (locus/semaines), avec le jour lu dans le carnet de la semaine (logs/<semaine>) :
       c'est lui qui fait foi, et il est à jour même si la Forge n'a pas été rouverte depuis un placement */
    const seances = (N) => { const f = forge(), L = (f && f.semaines && f.semaines[N]) || [], lg = S.L && S.L[N];
      if (!lg) return L;
      return L.map((s) => { const c = lg[s.id]; if (!c) return s; const y = Object.assign({}, s); if (typeof c.day === 'number') y.day = c.day; else delete y.day; if (c.done) y.done = true; return y; }); };
    const H = (N) => S.H[N] || {};
    const creneaux = (N, pid, d) => { const v = (H(N).p || {})[pid + '|' + d]; return v == null ? null : normL(v); };

    /* ---------- lecture ---------- */
    async function charger(d0, d1, force) {
      if (!enLigne()) { prevenir(); return; }
      const ks = semainesEntre(d0, d1), t = [];
      t.push(sb.from('biblio_rows').select('key,data,deleted').in('key', ks.map((k) => 'h:' + k)).then(({ data, error }) => {
        if (error) throw error; ks.forEach((k) => { if (enAttente(k)) return; const r = (data || []).find((x) => x.key === 'h:' + k); S.H[k] = r && !r.deleted && r.data ? r.data : {}; }); }));
      t.push(sb.from('biblio_rows').select('key,data').like('key', 'n:%').eq('deleted', false).eq('data->>p', 'taches').then(({ data, error }) => {
        if (error) throw error; const T = {}; (data || []).forEach((r) => { if (r.data && r.data.id && !r.data.a) T[r.data.id] = r.data; }); S.T = T; }));
      t.push(sb.from('carnet').select('data,deleted').eq('key', 'locus/semaines').maybeSingle().then(({ data, error }) => { if (!error && data && !data.deleted && data.data) S.F = data.data; }));
      t.push(sb.from('carnet').select('key,data,deleted').in('key', ks.map((k) => 'logs/' + k)).then(({ data, error }) => {
        if (error) return; S.L = S.L || {}; ks.forEach((k) => { const r = (data || []).find((x) => x.key === 'logs/' + k); S.L[k] = r && !r.deleted && r.data ? r.data.sessions || {} : {}; }); }));
      t.push(chargerEv(d0, d1));
      if (PB && PB.tirer) t.push(PB.tirer());
      try { await Promise.all(t); erreur = ''; } catch (e) { erreur = msg(e); }
      garder(); prevenir(); vider();
      chargerProton(d0, d1, force);
    }
    const norm = (r) => Object.assign({}, r, { debut: r.debut ? String(r.debut).slice(0, 5) : null, options: r.options || {} });
    async function chargerEv(d0, d1) {
      const de = plusJ(d0, -62);
      const { data, error } = await sb.from('locus_evenements').select('*').eq('deleted', false).gte('jour', de).lte('jour', d1);
      if (error) { if (/locus_evenements|schema cache|does not exist|relation/i.test(error.message || '')) { evAbsent = true; return; } throw error; }
      evAbsent = false;
      Object.keys(S.EV).forEach((id) => { const r = S.EV[id]; if (r.jour >= de && r.jour <= d1) delete S.EV[id]; });
      (data || []).forEach((r) => { S.EV[r.id] = norm(r); });
    }
    async function chargerProton(d0, d1, force) {
      if (!enLigne() || pxEn) return;
      const P0 = S.PX || {};
      if (!force && P0.de && P0.de <= d0 && P0.a >= d1 && !P0.err && Date.now() - Date.parse(P0.le || 0) < 5 * 60000) return;
      if (ecart(d0, d1) > 119) d1 = plusJ(d0, 119);
      pxEn = true; prevenir();
      const P = { ev: P0.ev || [], cals: P0.cals || [], de: d0, a: d1, le: new Date().toISOString(), err: '', erreurs: [] };
      try {
        const { data, error } = await sb.from('locus_calendriers').select('id,nom,couleur').order('cree');
        if (error) throw new Error(/locus_calendriers|schema cache|does not exist/i.test(error.message || '') ? 'Lance d’abord supabase/calendriers.sql dans Supabase' : error.message);
        P.cals = data || [];
        if (P.cals.length) {
          const ses = (await sb.auth.getSession()).data.session; if (!ses) throw new Error('pas connecté');
          const r = await fetch(o.url + '/functions/v1/calendriers?de=' + d0 + '&a=' + d1, { headers: { Authorization: 'Bearer ' + ses.access_token, apikey: o.cle } });
          if (r.status === 404) throw new Error('Crée d’abord la fonction « calendriers » dans Supabase');
          const j = await r.json().catch(() => ({ erreur: 'réponse illisible (' + r.status + ')' }));
          if (!r.ok || j.erreur) throw new Error(j.erreur || 'erreur ' + r.status);
          P.ev = j.ev || []; P.erreurs = j.erreurs || [];
        } else P.ev = [];
      } catch (e) { P.err = msg(e); P.de = P0.de || ''; P.a = P0.a || ''; P.le = P0.le || ''; }
      S.PX = P; pxEn = false; garder(); prevenir();
    }
    const coulCal = (id) => { const L = (S.PX && S.PX.cals) || [], i = L.findIndex((c) => c.id === id), c = i >= 0 ? L[i] : null; return (c && c.couleur) || COUL_CAL[Math.max(0, i) % COUL_CAL.length]; };

    /* ---------- les éléments ---------- */
    let nK = 0;
    function el(x) { x.k = 'k' + (++nK); x.mobile = x.src !== 'x' && x.src !== 'd'; return x; }
    /* tous les éléments entre deux dates (incluses) ; ceux « toute la semaine » ont sem = '<semaine>' et pas de jour */
    function elements(d0, d1) {
      const out = [], ks = semainesEntre(d0, d1), dans = (d) => d >= d0 && d <= d1;
      const P_ = PB ? PB.liste().filter((p) => !p.closed) : [];
      P_.forEach((p) => {
        const titre = ((p.emoji || '') + ' ' + (p.name || '')).trim(), coul = p.color || null;
        (p.days || []).filter(dans).forEach((d) => {
          const L = creneaux(wkDe(d), p.id, d);
          if (!L || !L.length) { out.push(el({ src: 'p', id: p.id, jour: d, idx: -1, titre, coul, moment: null, debut: null, min: DUREE.p })); return; }
          L.forEach((c, idx) => { const q = lireCreneau(c); if (q) out.push(el({ src: 'p', id: p.id, jour: d, idx, titre, coul, moment: q.moment, debut: q.debut, min: q.min })); });
        });
        (p.weeks || []).filter((k) => ks.includes(k)).forEach((k) => out.push(el({ src: 'p', id: p.id, sem: k, titre, coul, min: DUREE.p })));
      });
      /* échéances : projets et tâches datées (champ due), pas les projets en idée, pas les tâches faites */
      if (PB) {
        P_.filter((p) => p.due && !p.later && dans(String(p.due).slice(0, 10))).forEach((p) => out.push(el({ src: 'd', id: p.id, jour: String(p.due).slice(0, 10), titre: ((p.emoji || '') + ' ' + p.name).trim(), coul: p.color || null, ech: 'projet' })));
        const taches = (h, dom) => { const L = h.tasks || []; L.forEach((x, i) => { if (!x || !x.due || x.d || window.Projets.estSection(x) || window.Projets.estEtape(L, i)) return; const d = String(x.due).slice(0, 10); if (!dans(d)) return;
          out.push(el({ src: 'd', id: h.id, dom, jour: d, titre: x.t || '', coul: h.color || null, ech: 'tache', de: ((h.emoji || '') + ' ' + (h.name || '')).trim() })); }); };
        P_.filter((p) => !p.later).forEach((p) => taches(p, false));
        (PB.domaines ? PB.domaines() : []).filter((d) => d && !d.closed).forEach((d) => taches(d, true));
      }
      ks.forEach((N) => {
        const m = lundi(N), Hm = H(N).m || {}, Hf = H(N).f || {};
        seances(N).forEach((s) => {
          if (typeof s.day !== 'number') return; const d = plusJ(m, s.day); if (!dans(d)) return;
          const debut = typeof Hf[s.id] === 'string' ? Hf[s.id] : null;
          out.push(el({ src: 'f', id: s.id, semaine: N, jour: d, titre: s.t || 'Séance', coul: COUL_FORGE, min: s.min || 60, debut, moment: debut ? null : Hm['f:' + s.id] || null, fait: !!s.done }));
        });
      });
      Object.values(S.T).forEach((n) => {
        if (!n.jour || n.m2 || !dans(n.jour)) return; const h = H(wkDe(n.jour)), debut = typeof (h.t || {})[n.id] === 'string' ? h.t[n.id] : null;
        out.push(el({ src: 't', id: n.id, jour: n.jour, titre: n.t || '', min: DUREE.t, debut, moment: debut ? null : (h.m || {})['t:' + n.id] || null, fait: !!n.x, imp: !!n.imp }));
      });
      Object.values(S.EV).forEach((r) => {
        if (r.deleted) return; const f = r.jusqu_au || r.jour, multi = f > r.jour;
        for (let d = r.jour; d <= f; d = plusJ(d, 1)) {
          if (!dans(d)) continue;
          out.push(el({ src: 'e', id: r.id, jour: d, titre: r.titre || TYPE_N[r.type] || 'Événement', type: r.type, coul: r.couleur || TYPE_C[r.type] || null,
            moment: multi ? null : r.debut ? null : r.moment || null, debut: multi ? null : r.debut || null, min: r.duree_min || DUREE.e, row: r, multi, lieu: r.lieu, options: r.options || {} }));
        }
      });
      (S.PX.ev || []).forEach((e) => {
        const s0 = String(e.debut).slice(0, 10), f0 = String(e.fin || e.debut).slice(0, 10), coul = coulCal(e.cal);
        if (e.journee) { for (let d = s0; d < f0 || d === s0; d = plusJ(d, 1)) { if (dans(d)) out.push(el({ src: 'x', id: 'x', jour: d, titre: e.titre || '(sans titre)', coul, lieu: e.lieu, ev: e, min: 0 })); if (d >= f0) break; } return; }
        for (let d = s0; d <= f0; d = plusJ(d, 1)) {
          if (!dans(d)) continue;
          if (d !== s0 && d === f0 && String(e.fin).slice(11, 16) === '00:00') continue;
          if (d === s0) { const a = enMin(String(e.debut).slice(11, 16)) || 0, b = f0 === d ? enMin(String(e.fin).slice(11, 16)) : 1440;
            out.push(el({ src: 'x', id: 'x', jour: d, titre: e.titre || '(sans titre)', coul, lieu: e.lieu, ev: e, debut: hhmm(a), min: Math.max(15, (b == null ? a + 60 : b) - a) })); }
          else out.push(el({ src: 'x', id: 'x', jour: d, titre: e.titre || '(sans titre)', coul, lieu: e.lieu, ev: e, suite: true, min: 0 }));
        }
      });
      return out;
    }
    /* ce qui reste à placer une semaine (comme la routine du lundi) */
    function aPlacer(N) {
      const m = lundi(N), f = plusJ(m, 6);
      const P_ = PB ? PB.liste().filter((p) => !p.closed && !p.later && p.size !== 'perm') : [];
      const enSem = (p) => (p.weeks || []).includes(N) || (p.days || []).some((d) => d >= m && d <= f);
      const tri = (a, b) => (b.imp || 0) - (a.imp || 0) || String(a.name).localeCompare(String(b.name), 'fr');
      const pe = (p) => el({ src: 'p', id: p.id, tray: true, titre: ((p.emoji || '') + ' ' + (p.name || '')).trim(), coul: p.color || null, min: DUREE.p });
      const FS = seances(N).filter((s) => typeof s.day !== 'number' && !s.done);
      const fe = (s) => el({ src: 'f', id: s.id, tray: true, semaine: N, titre: s.t || 'Séance', coul: COUL_FORGE, min: s.min || 60 });
      const TT = Object.values(S.T).filter((n) => !n.m2 && !n.x && !(n.remis && n.remis < N) && (!n.jour || n.jour < m));
      return { projets: P_.filter(enSem).sort(tri).map(pe), autres: P_.filter((p) => !enSem(p)).sort(tri).map(pe),
        seances: FS.filter((s) => !s.opt).map(fe), facultatives: FS.filter((s) => s.opt).map(fe),
        taches: TT.map((n) => el({ src: 't', id: n.id, tray: true, titre: n.t || '', min: DUREE.t, imp: !!n.imp })), forge: !!forge() };
    }
    const elProjet = (id) => { const p = PB && PB.get(id); return p ? el({ src: 'p', id, tray: true, titre: ((p.emoji || '') + ' ' + p.name).trim(), coul: p.color || null, min: DUREE.p }) : null; };

    /* ---------- écritures ---------- */
    const hFile = {};
    function hEdit(N, fn) { const p = (hFile[N] || Promise.resolve()).then(() => hEdit1(N, fn)); hFile[N] = p.catch(() => {}); return p; }
    async function hEdit1(N, fn) {
      let cur = S.H[N] || {};
      if (enLigne() && !enAttente(N)) { try { const { data, error } = await sb.from('biblio_rows').select('data,deleted').eq('key', 'h:' + N).maybeSingle(); if (!error) cur = data && !data.deleted && data.data ? data.data : {}; } catch (e) {} }
      const nv = copie(cur); fn(nv); ['p', 'f', 't', 'm'].forEach((g) => { if (nv[g] && !Object.keys(nv[g]).length) delete nv[g]; });
      S.H[N] = nv; garder(); await envoyerH(N);
    }
    async function envoyerH(N) {
      try { if (!enLigne()) throw new Error('hors ligne'); const { error } = await sb.from('biblio_rows').upsert({ user_id: uid, key: 'h:' + N, data: S.H[N] || {}, deleted: false }, { onConflict: 'user_id,key' }); if (error) throw error; setAttente(attente().filter((x) => x !== N)); }
      catch (e) { if (!enAttente(N)) setAttente(attente().concat([N])); }
    }
    async function vider() { for (const N of attente()) await envoyerH(N); }
    /* lire la ligne fraîche, la modifier, la renvoyer (table au format key / data) */
    async function modifLigne(table, key, fn) {
      if (!enLigne()) throw new Error('pas de réseau');
      const { data, error } = await sb.from(table).select('data,deleted').eq('key', key).maybeSingle(); if (error) throw error;
      if (table === 'biblio_rows' && !(data && !data.deleted && data.data)) throw new Error('introuvable');
      const nv = copie(data && !data.deleted && data.data ? data.data : {}); fn(nv);
      const r = await sb.from(table).upsert({ user_id: uid, key, data: nv, deleted: false }, { onConflict: 'user_id,key' }); if (r.error) throw r.error;
      return nv;
    }
    const refus = (t) => { toast(t); return false; };
    /* poser un élément. c = { jour, moment?, debut? } ; { sem: '<semaine>' } (projets) ; { jour, garder: true } (garde son moment / heure) */
    async function poser(x, c) {
      const q = c.sem ? null : c.garder ? { moment: x.moment || null, debut: x.debut || null } : { moment: c.debut ? null : c.moment || null, debut: c.debut || null };
      try {
        if (x.src === 'p') await poserP(x, c, q);
        else if (c.sem) return refus(x.src === 'f' ? 'Une séance va sur un jour' : 'Va sur un jour, pas sur toute la semaine');
        else if (x.src === 'f') { if (!(await poserF(x, c, q))) return false; }
        else if (x.src === 't') await poserT(x, c, q);
        else if (x.src === 'e') await poserE(x, c, q);
        else return refus('Ce rendez-vous vient de Proton : il se change là-bas');
      } catch (e) { toast('Pas enregistré : ' + msg(e)); prevenir(); return false; }
      prevenir(); return true;
    }
    async function oterCreneau(p, d, idx) {
      let reste = 0;
      await hEdit(wkDe(d), (h) => { h.p = h.p || {}; const k = p.id + '|' + d; let L = normL(h.p[k]); if (idx >= 0 && L[idx]) L.splice(idx, 1); else L = []; reste = L.length; if (reste) h.p[k] = L; else delete h.p[k]; });
      if (!reste) p.days = (p.days || []).filter((x) => x !== d);
    }
    async function poserP(x, c, q) {
      const p = PB.get(x.id); if (!p) throw new Error('projet introuvable');
      p.days = (p.days || []).slice(); p.weeks = (p.weeks || []).slice();
      /* la dernière décision gagne (Nicolas, 23.11) : toute la semaine OU des jours de cette semaine */
      if (c.sem) {
        const N = c.sem, m = lundi(N), L = [0, 1, 2, 3, 4, 5, 6].map((j) => plusJ(m, j)).filter((d) => p.days.includes(d));
        if (x.jour && !x.tray && !x.sem && !L.includes(x.jour)) await oterCreneau(p, x.jour, x.idx);
        if (x.sem && x.sem !== N) p.weeks = p.weeks.filter((w) => w !== x.sem);
        p.days = p.days.filter((d) => !L.includes(d)); if (!p.weeks.includes(N)) p.weeks = p.weeks.concat([N]).sort();
        delete p.later; p.touche = auj(); PB.ecrire(p);
        if (L.length) await hEdit(N, (h) => { if (h.p) L.forEach((d) => delete h.p[p.id + '|' + d]); });
        toast(L.length ? 'Toute la semaine : jours enlevés' : 'Toute la semaine'); return;
      }
      const d = c.jour, N = wkDe(d);
      if (x.sem) p.weeks = p.weeks.filter((w) => w !== x.sem);
      p.weeks = p.weeks.filter((w) => w !== N);
      if (x.jour && !x.tray && !x.sem) await oterCreneau(p, x.jour, x.idx);
      const cr = ecrireCreneau(q, x.min);
      if (!p.days.includes(d)) p.days = p.days.concat([d]).sort();
      delete p.later; p.touche = auj(); PB.ecrire(p);
      if (cr) await hEdit(N, (h) => { h.p = h.p || {}; const k = p.id + '|' + d, L = normL(h.p[k]); L.push(cr); L.sort((a, b) => (a.h < b.h ? -1 : 1)); h.p[k] = L; });
    }
    function forgeLocale(N, id, j) {
      const f = forge(), s = f && f.semaines && (f.semaines[N] || []).find((y) => y.id === id); if (!s) return;
      if (j == null) delete s.day; else s.day = j; f.le = new Date().toISOString(); S.F = f;
      try { localStorage.setItem('locus-forge', JSON.stringify(f)); } catch (e) {}
    }
    async function poserF(x, c, q) {
      const N = x.semaine, d = c.jour; if (wkDe(d) !== N) return refus('Une séance reste dans sa semaine (S' + wkNum(N) + ')');
      const j = jIdx(d); forgeLocale(N, x.id, j);
      await hEdit(N, (h) => setQ(h, 'f', x.id, q));
      const lg = await modifLigne('carnet', 'logs/' + N, (log) => { log.sessions = log.sessions || {}; const cur = Object.assign({}, log.sessions[x.id] || {}); cur.day = j; log.sessions[x.id] = cur; });
      S.L = S.L || {}; S.L[N] = lg.sessions || {}; garder();
      return true;
    }
    async function poserT(x, c, q) {
      const d = c.jour, N = wkDe(d), No = x.jour ? wkDe(x.jour) : null;
      S.T[x.id] = Object.assign({}, S.T[x.id] || {}, { jour: d }); garder();
      if (No && No !== N) await hEdit(No, (h) => setQ(h, 't', x.id, null));
      await hEdit(N, (h) => setQ(h, 't', x.id, q));
      S.T[x.id] = await modifLigne('biblio_rows', 'n:' + x.id, (n) => { n.jour = d; });
    }
    async function poserE(x, c, q) {
      const r = Object.assign({}, S.EV[x.id]); if (!r.id) throw new Error('événement introuvable');
      const sh = ecart(x.jour || r.jour, c.jour); r.jour = plusJ(r.jour, sh); if (r.jusqu_au) r.jusqu_au = plusJ(r.jusqu_au, sh);
      if (!x.multi) { r.debut = q.debut || null; r.moment = q.debut ? null : q.moment || null; }
      await ecrireEv(r);
    }
    /* enlever un élément de son jour (ou de sa semaine) ; les événements se suppriment depuis leur fiche */
    async function oter(x) {
      try {
        if (x.src === 'p') { const p = PB.get(x.id); if (!p) return false; if (x.sem) p.weeks = (p.weeks || []).filter((w) => w !== x.sem); else await oterCreneau(p, x.jour, x.idx); p.touche = auj(); PB.ecrire(p); }
        else if (x.src === 'f') { const N = x.semaine; forgeLocale(N, x.id, null); await hEdit(N, (h) => setQ(h, 'f', x.id, null)); const lg = await modifLigne('carnet', 'logs/' + N, (log) => { log.sessions = log.sessions || {}; const cur = Object.assign({}, log.sessions[x.id] || {}); delete cur.day; log.sessions[x.id] = cur; }); S.L = S.L || {}; S.L[N] = lg.sessions || {}; garder(); }
        else if (x.src === 't') { const n = Object.assign({}, S.T[x.id] || {}); delete n.jour; S.T[x.id] = n; if (x.jour) await hEdit(wkDe(x.jour), (h) => setQ(h, 't', x.id, null)); S.T[x.id] = await modifLigne('biblio_rows', 'n:' + x.id, (y) => { delete y.jour; }); }
        else return refus(x.src === 'e' ? 'Pour supprimer un événement, ouvre-le' : 'Ce rendez-vous vient de Proton : il se change là-bas');
      } catch (e) { toast('Pas enregistré : ' + msg(e)); prevenir(); return false; }
      prevenir(); return true;
    }
    /* changer l'heure et la durée (bords d'un bloc dans la vue en heures) : projets et événements */
    async function regler(x, debut, min) {
      try {
        if (x.src === 'p') await hEdit(wkDe(x.jour), (h) => { h.p = h.p || {}; const k = x.id + '|' + x.jour, L = normL(h.p[k]); const c = { h: debut, min }; if (x.idx >= 0 && L[x.idx]) L[x.idx] = c; else L.push(c); L.sort((a, b) => (a.h < b.h ? -1 : 1)); h.p[k] = L; });
        else if (x.src === 'e') { const r = Object.assign({}, S.EV[x.id]); r.debut = debut; r.moment = null; r.duree_min = min; await ecrireEv(r); }
        else return false;
      } catch (e) { toast('Pas enregistré : ' + msg(e)); }
      prevenir(); return true;
    }
    async function ecrireEv(r) {
      if (evAbsent) throw new Error('lance d’abord supabase/calendrier.sql dans Supabase');
      const row = { id: r.id || nouvelId(), jour: r.jour, jusqu_au: r.jusqu_au && r.jusqu_au > r.jour ? r.jusqu_au : null, moment: r.debut ? null : r.moment || null, debut: r.debut || null,
        duree_min: r.duree_min || null, type: r.type || 'rdv', titre: r.titre || '', lieu: r.lieu || null, note: r.note || null, couleur: r.couleur || null,
        options: r.options || {}, lien: r.lien || null, deleted: !!r.deleted };
      if (row.deleted) delete S.EV[row.id]; else S.EV[row.id] = norm(row); garder(); prevenir();
      if (!enLigne()) throw new Error('pas de réseau');
      const { data, error } = await sb.from('locus_evenements').upsert(Object.assign({ user_id: uid }, row), { onConflict: 'user_id,id' }).select().maybeSingle();
      if (error) { if (/locus_evenements|schema cache|does not exist|relation/i.test(error.message || '')) { evAbsent = true; throw new Error('lance d’abord supabase/calendrier.sql dans Supabase'); } throw error; }
      if (data && !data.deleted) S.EV[data.id] = norm(data); garder(); return row.id;
    }
    async function enregistrerEv(r) { try { const id = await ecrireEv(r); prevenir(); return id; } catch (e) { toast('Pas enregistré : ' + msg(e)); prevenir(); return null; } }
    async function supprimerEv(id) { const r = S.EV[id]; if (!r) return false; try { await ecrireEv(Object.assign({}, r, { deleted: true })); } catch (e) { toast('Pas supprimé : ' + msg(e)); return false; } prevenir(); return true; }
    /* une tâche nouvelle (racine « taches » de la Bibliothèque), placée sur un jour */
    async function nouvelleTache(t, jour, q) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7), n = { id, p: 'taches', o: Date.now() / 1e6, t, cree: auj(), jour };
      try {
        if (!enLigne()) throw new Error('pas de réseau');
        const r = await sb.from('biblio_rows').upsert({ user_id: uid, key: 'n:' + id, data: n, deleted: false }, { onConflict: 'user_id,key' }); if (r.error) throw r.error;
        S.T[id] = n; if (q && (q.debut || q.moment)) await hEdit(wkDe(jour), (h) => setQ(h, 't', id, q));
      } catch (e) { toast('Tâche pas enregistrée : ' + msg(e)); }
      garder(); prevenir(); return id;
    }
    async function cocherTache(id, v) {
      try { S.T[id] = await modifLigne('biblio_rows', 'n:' + id, (n) => { if (v) { n.x = true; n.xLe = auj(); } else { delete n.x; delete n.xLe; } }); }
      catch (e) { toast('Pas enregistré : ' + msg(e)); } garder(); prevenir();
    }

    return {
      charger, chargerProton: (d0, d1) => chargerProton(d0, d1, true), elements, aPlacer, elProjet, poser, oter, regler, enregistrerEv, supprimerEv, nouvelleTache, cocherTache, vider,
      surChangement: (f) => ecoute.push(f), prevenir, ev: (id) => S.EV[id] || null, tache: (id) => S.T[id] || null, coulCal,
      etat: () => ({ erreur, evAbsent, proton: S.PX, protonEnCours: pxEn, attente: attente().length, forge: !!forge() }),
    };
  }
  /* l'objet de données, plus monter(root, opts) qui affiche le calendrier dans un élément de la page */
  function creerAvecApi(o) { const c = creer(o); c.monter = (root, opts) => monter(c, root, opts); return c; }

  /* ================================ l'affichage ================================ */
  let STYLE = false;
  function styles() {
    if (STYLE) return; STYLE = true; const s = document.createElement('style'); s.id = 'cal-styles';
    /* pas de couleur d'interface en dur : les jetons de commun/lieux.css (Règles › Couleurs) ; --c = couleur de données */
    s.textContent = `
.cal{display:flex;flex-direction:column;gap:12px;color:var(--on-page)}
.cal-boite{background:var(--surface);color:var(--ink);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:8px}
.cal-ey{font:600 10.5px/1.2 var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}
.cal-note{font-size:12.5px;color:var(--ink-3);margin:0}
.cal-chips{display:flex;flex-wrap:wrap;gap:6px}
.cal summary{cursor:pointer}
.cal-el{--c:var(--ink-3);display:flex;align-items:baseline;gap:5px;max-width:100%;min-width:0;border:0;border-radius:7px;padding:3px 7px;font:500 12.5px/1.3 var(--f-body);color:var(--ink);background:color-mix(in srgb,var(--c) 24%,var(--surface));box-shadow:inset 3px 0 0 var(--c);text-align:left;cursor:pointer;overflow:hidden}
.cal-chips .cal-el{display:inline-flex}
.cal-el .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.cal-el .h{font:600 10.5px/1.3 var(--f-mono);flex:none}
.cal-el .m{font-size:10.5px;color:var(--ink-3);flex:none}
.cal-el.x{background:var(--surface-2)}
.cal-el.d{background:var(--surface);box-shadow:inset 0 0 0 1.5px var(--c)}
.cal-el.pale{opacity:.5}
.cal-el.fait .t{text-decoration:line-through;opacity:.6}
.cal-el.imp{--c:var(--bad);font-weight:700}
.cal-el.flou{outline:1.5px dashed color-mix(in srgb,var(--c) 60%,var(--ink));outline-offset:-2px}
.cal [data-cal-drag]{touch-action:none;-webkit-user-select:none;user-select:none;cursor:grab}
.cal-sem{display:flex;gap:8px;align-items:center;background:var(--surface);color:var(--ink);border-radius:12px;padding:6px 8px;min-height:38px}
.cal-sem .lab{font:600 10.5px var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);flex:none;width:70px}
.cal-sem .cal-chips{flex:1}
.cal-sem .vide,.cal-s-c .vide{font-size:12px;color:var(--ink-3)}
.cal-cible{outline:2px solid var(--accent);outline-offset:-2px;background:color-mix(in srgb,var(--accent) 16%,var(--surface))!important}
/* vue simple */
.cal-s{display:flex;flex-direction:column;gap:4px}
.cal-s-tete,.cal-s-j{display:grid;grid-template-columns:42px minmax(0,1fr) minmax(0,1fr);gap:4px}
.cal-s-tete span{font:600 10.5px var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--on-page);opacity:.75;padding:0 6px}
.cal-s-l{grid-row:1/3;font:600 11px/1.1 var(--f-mono);text-transform:uppercase;color:var(--on-page);opacity:.8;display:flex;flex-direction:column;align-items:center;padding-top:6px}
.cal-s-l b{font:700 17px/1.1 var(--f-display);letter-spacing:-.03em;opacity:1}
.cal-s-j.auj .cal-s-l{opacity:1}
.cal-s-j.auj .cal-s-l b{background:var(--accent);color:var(--on-acc);border-radius:8px;padding:2px 5px}
.cal-s-jour{grid-column:2/4;display:flex;flex-wrap:wrap;gap:4px;border-radius:10px;padding:3px;background:color-mix(in srgb,var(--surface) 55%,transparent)}
.cal-s-jour.vide{display:none}
.cal.glisse .cal-s-l{outline:1.5px dashed color-mix(in srgb,var(--on-page) 45%,transparent);outline-offset:-2px;border-radius:10px}
.cal-s-c{background:var(--surface);border-radius:10px;padding:4px;min-height:46px;display:flex;flex-direction:column;gap:3px;min-width:0}
.cal-s-j.we .cal-s-c{background:color-mix(in srgb,var(--surface) 70%,var(--page))}
/* vue en heures */
.cal-h{background:var(--surface);color:var(--ink);border-radius:16px;padding:8px 10px}
.cal-h-r{display:flex;align-items:stretch;gap:6px;padding:5px 0;border-top:1px solid var(--line)}
.cal-h-r:first-child{border-top:0}
.cal-h-l{width:40px;flex:none;font:600 11px/1.1 var(--f-mono);text-transform:uppercase;color:var(--ink-3);padding-top:3px}
.cal-h-l b{display:block;font:700 14px/1.1 var(--f-display);color:var(--ink)}
.cal-h-r.auj .cal-h-l{color:var(--ink)}
.cal-h-r.auj .cal-h-l b{color:var(--accent-ink)}
.cal-p{position:relative;flex:1;min-width:0;border-radius:6px;background-image:linear-gradient(to right,var(--line) 1px,transparent 1px);background-size:calc(100% / ${PLAGE / 2}) 100%}
.cal-p .cal-el{position:absolute;height:20px;padding:0 4px;font-size:10.5px;line-height:20px;border-radius:5px;align-items:center}
.cal-p .cal-el.etroit{overflow:visible}
.cal-p .cal-el.etroit .t{overflow:visible;color:var(--ink);text-shadow:0 0 3px var(--surface),0 0 3px var(--surface)}
.cal-p .jl{position:absolute;left:0;right:0;top:0;height:15px;display:flex;gap:3px;overflow:hidden}
.cal-p .jl .cal-el{position:static;height:15px;line-height:15px;font-size:10px;flex:0 1 auto}
.cal-p .maint{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--bad);border-radius:1px;z-index:2;pointer-events:none}
.cal-p .marge{position:absolute;height:20px;border-radius:4px;pointer-events:none;background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--c) 40%,transparent) 0 3px,transparent 3px 6px)}
.cal-p .poignee{position:absolute;top:0;bottom:0;width:11px;touch-action:none;cursor:ew-resize;z-index:1}
.cal-p .poignee.g{left:-3px}.cal-p .poignee.d{right:-3px}
.cal-p .poignee::after{content:"";position:absolute;top:5px;bottom:5px;width:2px;border-radius:1px;background:currentColor;opacity:.5;left:4px}
.cal-h-t{display:flex;gap:6px}
.cal-h-t .cal-p{background:none;height:14px}
.cal-h-t span{position:absolute;transform:translateX(-50%);font:10px var(--f-mono);color:var(--ink-3)}
/* vue mois */
.cal-m{display:grid;grid-template-columns:30px repeat(7,minmax(0,1fr));gap:3px}
.cal-m-t{font:600 10.5px var(--f-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--on-page);opacity:.75;text-align:center}
.cal-m-s{border:0;background:none;color:var(--on-page);font:600 10.5px var(--f-mono);opacity:.8;cursor:pointer;padding:4px 0;align-self:start}
.cal-m-j{background:var(--surface);color:var(--ink);border-radius:8px;min-height:74px;padding:3px;display:flex;flex-direction:column;gap:2px;min-width:0;cursor:pointer}
.cal-m-j.hors{opacity:.45}
.cal-m-j.we{background:color-mix(in srgb,var(--surface) 70%,var(--page))}
.cal-m-j .n{font:600 11px var(--f-mono);color:var(--ink-3);padding:0 2px}
.cal-m-j.auj .n{color:var(--on-acc);background:var(--accent);border-radius:5px;align-self:flex-start;padding:0 4px}
.cal-m-j .cal-el{font-size:10.5px;padding:1px 4px;border-radius:4px}
.cal-m-j .plus{font-size:10.5px;color:var(--ink-3);padding:0 3px}
#cal-fantome{position:fixed;left:0;top:0;z-index:90;pointer-events:none;min-height:22px;border-radius:6px;font:600 11.5px/22px var(--f-body);padding:0 8px;white-space:nowrap;background:var(--surface);color:var(--ink);box-shadow:0 4px 14px color-mix(in srgb,var(--ink) 35%,transparent),inset 3px 0 0 var(--c,var(--accent));opacity:.95}
#cal-fantome small{position:absolute;left:0;top:-18px;font:600 10.5px/15px var(--f-mono);background:var(--ink);color:var(--on-ink);padding:0 5px;border-radius:4px}
@media (max-width:420px){.cal-s-tete,.cal-s-j{grid-template-columns:34px minmax(0,1fr) minmax(0,1fr)}.cal-el{font-size:12px}.cal-m{grid-template-columns:22px repeat(7,minmax(0,1fr))}.cal-m-j{min-height:62px}}`;
    document.head.appendChild(s);
  }

  /* un élément affiché ; zone = 's' (vue simple), 'h' (vue en heures, positionné), 'm' (mois), 'c' (puce) */
  function puce(V, x, zone, style) {
    V.map.set(x.k, x);
    const cl = ['cal-el', x.src === 'x' ? 'x' : x.src === 'd' ? 'd' : '', x.fait ? 'fait' : '', x.imp ? 'imp' : '', x.pale ? 'pale' : '', zone === 'h' && x.flou ? 'flou' : '', style && style.etroit ? 'etroit' : ''].filter(Boolean).join(' ');
    const h = x.debut && zone !== 'h' ? `<span class="h">${hCourt(x.debut)}</span>` : '';
    const mo = !x.debut && x.moment && zone === 'm' ? `<span class="m">${x.moment === 'matin' ? 'mat.' : 'ap.-m.'}</span>` : '';
    const pre = x.src === 't' ? (x.fait ? '☑ ' : x.imp ? '★ ' : '☐ ') : x.src === 'd' ? '⏰ ' : '';
    const dec = x.src === 'e' && x.options && x.options.declare ? ' · déclaré' : '';
    const tip = [x.titre, x.debut ? hCourt(x.debut) + (x.min ? '–' + hCourt(hhmm(Math.min(1440, enMin(x.debut) + x.min))) : '') : x.moment ? MOMENT_L[x.moment] : '', x.lieu || ''].filter(Boolean).join(' · ');
    const pos = style && style.pos ? ` style="--c:${esc(x.coul || 'var(--ink-3)')};${style.pos}"` : ` style="--c:${esc(x.coul || 'var(--ink-3)')}"`;
    const bords = style && style.bords ? '<i class="poignee g" data-cal-bord="g"></i><i class="poignee d" data-cal-bord="d"></i>' : '';
    return `<button type="button" class="${cl}" data-cal-k="${x.k}"${x.mobile ? ' data-cal-drag' : ''}${style && style.ab ? ` data-a="${style.ab[0]}" data-b="${style.ab[1]}"` : ''} title="${esc(tip)}"${pos}>${bords}${h}${mo}<span class="t">${esc(pre + x.titre + dec)}</span></button>`;
  }
  const ordre = (x) => (x.debut ? enMin(x.debut) : x.moment ? enMin(MOMENT_H[x.moment]) - 1 : -1);
  const parOrdre = (a, b) => ordre(a) - ordre(b) || String(a.titre).localeCompare(String(b.titre), 'fr');

  function monter(C, root, opts) {
    styles();
    const V = { o: Object.assign({ vue: 'simple' }, opts || {}), map: new Map(), ouvert: {} };
    root.classList.add('cal');
    function regler(o) { Object.assign(V.o, o || {}); dessiner(); }
    function semaine() { return V.o.semaine || wkKey(new Date()); }
    function dessiner() {
      if (GL && GL.on) return; /* pas pendant un glisser */
      V.map.clear(); const o = V.o; let h = '';
      if (o.vue === 'mois') h = vMois();
      else { if (o.placer) h += vTray(); h += vSem(); h += o.vue === 'heures' ? vHeures() : vSimple(); }
      const y = V.o.defile ? V.o.defile.scrollTop : null;
      root.innerHTML = h;
      if (y != null) V.o.defile.scrollTop = y;
    }
    const pa = (x) => !V.o.placer || V.o.placer === 'tout' || V.o.placer === x.src || x.src === 'x' || x.src === 'e' || x.src === 'd';
    /* ce que la routine ne place pas à cette étape reste visible, un peu pâle, mais immobile */
    const vu = (x) => { if (!pa(x)) { x.mobile = false; x.pale = true; } return x; };
    function vTray() {
      const N = semaine(), A = C.aPlacer(N), pl = V.o.placer, ok = (s) => pl === 'tout' || pl === s;
      const ch = (L) => L.map((x) => puce(V, x, 'c')).join('');
      const det = (id, t, L) => (L.length ? `<details data-cal-det="${id}"${V.ouvert[id] ? ' open' : ''}><summary class="cal-note">${t} (${L.length})</summary><div class="cal-chips" style="margin-top:6px">${ch(L)}</div></details>` : '');
      let h = '';
      if (ok('p')) h += `<span class="cal-ey">Projets</span><div class="cal-chips">${ch(A.projets) || '<span class="cal-note">aucun prévu cette semaine</span>'}</div>` + det('autres', 'Autres projets', A.autres);
      if (ok('f')) h += `<span class="cal-ey">Séances</span><div class="cal-chips">${ch(A.seances) || `<span class="cal-note">${A.forge ? 'toutes placées' : 'elles apparaîtront après la prochaine ouverture de la Forge'}</span>`}</div>` + det('fac', 'Séances facultatives', A.facultatives);
      if (ok('t')) h += `<span class="cal-ey">Tâches</span><div class="cal-chips">${ch(A.taches) || '<span class="cal-note">toutes placées</span>'}</div>`;
      const n = A.projets.length + A.seances.length + A.taches.length;
      return V.o.trayReplie ? `<details class="cal-boite" data-cal-det="tray"${V.ouvert.tray ? ' open' : ''}><summary class="cal-ey">À placer${n ? ' · ' + n : ''}</summary>${h}</details>` : `<div class="cal-boite"><span class="cal-ey">À placer</span>${h}</div>`;
    }
    function vSem() {
      const N = semaine(), m = lundi(N), L = C.elements(m, plusJ(m, 6)).filter((x) => x.sem === N).map(vu);
      return `<div class="cal-sem" data-cal-depot data-sem="${N}"><span class="lab">Semaine</span><div class="cal-chips">${L.map((x) => puce(V, x, 'c')).join('') || '<span class="vide">glisse ici un projet pour toute la semaine</span>'}</div></div>`;
    }
    function vSimple() {
      const N = semaine(), m = lundi(N), E = C.elements(m, plusJ(m, 6)).filter((x) => !x.sem).map(vu), A = auj();
      let h = '<div class="cal-s"><div class="cal-s-tete"><span></span><span>matin</span><span>après-midi</span></div>';
      for (let i = 0; i < 7; i++) {
        const d = plusJ(m, i), L = E.filter((x) => x.jour === d).sort(parOrdre);
        const jour = L.filter((x) => !x.debut && !x.moment), mat = L.filter((x) => (x.debut ? momentDe(x.debut) : x.moment) === 'matin'), apm = L.filter((x) => (x.debut ? momentDe(x.debut) : x.moment) === 'aprem');
        /* le jour lui-même (à gauche) reçoit ce qui va sur toute la journée : rien ne bouge dans la page pendant un glisser */
        h += `<div class="cal-s-j${d === A ? ' auj' : ''}${i > 4 ? ' we' : ''}"><div class="cal-s-l" data-cal-depot data-jour="${d}" data-moment="" title="Toute la journée">${JOURS[i]}<b>${parse(d).getDate()}</b></div>`
          + `<div class="cal-s-jour${jour.length ? '' : ' vide'}" data-cal-depot data-jour="${d}" data-moment="">${jour.map((x) => puce(V, x, 's')).join('')}</div>`
          + `<div class="cal-s-c" data-cal-depot data-jour="${d}" data-moment="matin">${mat.map((x) => puce(V, x, 's')).join('')}</div>`
          + `<div class="cal-s-c" data-cal-depot data-jour="${d}" data-moment="aprem">${apm.map((x) => puce(V, x, 's')).join('')}</div></div>`;
      }
      return h + '</div>';
    }
    const pc = (x) => ((Math.min(Math.max(x / 60, H0), H1) - H0) / PLAGE * 100).toFixed(2);
    function vHeures() {
      const N = semaine(), m = lundi(N), E = C.elements(m, plusJ(m, 6)).filter((x) => !x.sem).map(vu), A = auj();
      let h = '<div class="cal-h"><div class="cal-h-t"><span class="cal-h-l"></span><div class="cal-p">';
      for (let t = H0; t <= H1; t += 2) h += `<span style="left:${pc(t * 60)}%">${t}</span>`;
      h += '</div></div>';
      const larg = Math.max(200, (root.clientWidth || 360) - 70);
      for (let i = 0; i < 7; i++) {
        const d = plusJ(m, i), L = E.filter((x) => x.jour === d);
        const band = L.filter((x) => (x.src === 'x' || x.src === 'e' || x.src === 'd') && !x.debut && !x.moment);
        const blocs = L.filter((x) => !band.includes(x)).map((x) => { const a = x.debut ? enMin(x.debut) : enMin(x.moment ? MOMENT_H[x.moment] : DEFAUT[x.src]); x.flou = !x.debut; return { x, a, b: a + (x.min || 60) }; });
        blocs.sort((p, q) => p.a - q.a || q.b - p.b); const fins = []; blocs.forEach((b) => { let l = fins.findIndex((f) => f <= b.a); if (l < 0) { l = fins.length; fins.push(0); } fins[l] = b.b; b.l = l; });
        const top0 = band.length ? 17 : 0, haut = top0 + Math.max(band.length ? 0 : 1, fins.length) * 22 + 4;
        let p = `<div class="cal-p" data-cal-depot data-piste data-jour="${d}" style="height:${haut}px">`;
        if (d === A) { const n = new Date(), mn = n.getHours() * 60 + n.getMinutes(); if (mn >= H0 * 60 && mn <= H1 * 60) p += `<i class="maint" style="left:${pc(mn)}%"></i>`; }
        if (band.length) p += `<div class="jl">${band.map((x) => puce(V, x, 's')).join('')}</div>`;
        blocs.forEach((b, j) => {
          const x = b.x, g = +pc(b.a), w = Math.max(2.5, +pc(b.b) - g), top = top0 + 2 + b.l * 22;
          const suiv = blocs.slice(j + 1).find((y) => y.l === b.l), place = ((suiv ? +pc(suiv.a) : 100) - g) / 100 * larg;
          const etroit = w / 100 * larg < x.titre.length * 5.6 + 10 && place > w / 100 * larg;
          const o2 = x.options || {}, av = (o2.prepa_min || 0) + (o2.trajet_min || 0), ap = o2.trajet_min || 0;
          if (x.debut && av) p += `<i class="marge" style="--c:${esc(x.coul || 'var(--ink-3)')};left:${pc(b.a - av)}%;width:${(+pc(b.a) - +pc(b.a - av)).toFixed(2)}%;top:${top}px" title="préparation et trajet"></i>`;
          if (x.debut && ap) p += `<i class="marge" style="--c:${esc(x.coul || 'var(--ink-3)')};left:${pc(b.b)}%;width:${(+pc(b.b + ap) - +pc(b.b)).toFixed(2)}%;top:${top}px" title="trajet"></i>`;
          /* étirer : un créneau de projet ou un événement (à une heure ou une demi-journée ; il prend alors une heure précise) */
          const bords = x.mobile && (x.debut || x.moment) && ((x.src === 'p' && x.idx >= 0) || (x.src === 'e' && !x.multi));
          p += puce(V, x, 'h', { pos: `left:${g}%;width:${w}%;top:${top}px`, etroit, ab: [b.a, b.b], bords });
        });
        p += '</div>';
        h += `<div class="cal-h-r${d === A ? ' auj' : ''}"><div class="cal-h-l">${JOURS[i]}<b>${parse(d).getDate()}</b></div>${p}</div>`;
      }
      return h + '</div>';
    }
    function vMois() {
      const mo = V.o.mois || auj().slice(0, 7), [y, mm] = mo.split('-').map(Number), d1 = iso(new Date(y, mm - 1, 1)), dn = iso(new Date(y, mm, 0));
      const g0 = lundi(wkDe(d1)), g1 = plusJ(lundi(wkDe(dn)), 6), E = C.elements(g0, g1).filter((x) => !x.sem), A = auj();
      let h = '<div class="cal-m"><span></span>' + JOURS.map((j) => `<span class="cal-m-t">${j}</span>`).join('');
      for (let d = g0; d <= g1; d = plusJ(d, 1)) {
        const i = jIdx(d); if (i === 0) h += `<button type="button" class="cal-m-s" data-cal-semaine="${wkDe(d)}" title="Ouvrir la semaine">S${wkNum(wkDe(d))}</button>`;
        const L = E.filter((x) => x.jour === d).sort(parOrdre), max = 4;
        h += `<div class="cal-m-j${d.slice(0, 7) !== mo ? ' hors' : ''}${d === A ? ' auj' : ''}${i > 4 ? ' we' : ''}" data-cal-depot data-mois data-jour="${d}"><span class="n">${parse(d).getDate()}</span>${L.slice(0, L.length > max ? max - 1 : max).map((x) => puce(V, x, 'm')).join('')}${L.length > max ? `<span class="plus">+${L.length - max + 1}</span>` : ''}</div>`;
      }
      return h + '</div>';
    }

    /* ---------- glisser-déposer (moteur de la routine du lundi, 23.11, élargi aux trois vues) ----------
       Un appui qui bouge de plus de 6 px soulève l'élément ; on le lâche sur une demi-journée, la ligne « journée », une heure
       (vue en heures, arrondie à la demi-heure), un jour du mois (il garde son moment ou son heure) ou « Semaine » (projets).
       Lâché hors du calendrier, un projet, une séance ou une tâche est enlevé de son jour. Les bords d'un bloc s'étirent. */
    let GL = null, AVALE = false;
    const pxParMin = (row) => { const p = row || root.querySelector('.cal-p[data-piste]'); return p ? p.getBoundingClientRect().width / (PLAGE * 60) : 0.3; };
    function cibleSous(x, y) { const t = document.elementFromPoint(x, y), r = t && t.closest && t.closest('[data-cal-depot]'); return r && root.contains(r) ? r : null; }
    function minuteSous(row, x, decal) { const r = row.getBoundingClientRect(); let mn = H0 * 60 + (x - r.left) / r.width * PLAGE * 60 - (decal || 0); mn = Math.round(mn / 30) * 30; return Math.min(Math.max(mn, H0 * 60), H1 * 60 - 30); }
    function fin() { if (!GL) return; if (GL.fant) GL.fant.remove(); if (GL.row) GL.row.classList.remove('cal-cible'); if (GL.src) GL.src.style.opacity = ''; cancelAnimationFrame(GL.raf); root.classList.remove('glisse'); GL = null; }
    function decrire(row, mn) {
      if (!row) return GL.x0 != null && !GL.el.tray && GL.el.src !== 'e' && GL.el.src !== 'x' ? 'enlever' : '…';
      if (row.dataset.sem) return 'toute la semaine';
      const j = JOURS[jIdx(row.dataset.jour)] + ' ' + parse(row.dataset.jour).getDate();
      if (row.dataset.piste != null) return j + ' ' + hhmm(mn) + '–' + hhmm(Math.min(mn + GL.dur, 1440));
      if (row.dataset.mois != null) return j;
      return j + ' ' + (row.dataset.moment ? MOMENT_L[row.dataset.moment] : 'journée');
    }
    function bouger() {
      const g = GL; if (!g || !g.on) return; const row = cibleSous(g.x, g.y);
      if (row !== g.row) { if (g.row) g.row.classList.remove('cal-cible'); if (row) row.classList.add('cal-cible'); g.row = row; }
      const pm = pxParMin(row && row.dataset.piste != null ? row : null), mn = row && row.dataset.piste != null ? minuteSous(row, g.x, g.decal) : null;
      let left = g.x - 20, top = g.y - 34, w = '';
      if (mn != null) { const r = row.getBoundingClientRect(); left = r.left + (mn - H0 * 60) * pm; top = r.top + 2; w = Math.max(46, g.dur * pm) + 'px'; }
      g.fant.style.width = w; g.fant.style.transform = `translate(${Math.round(left)}px,${Math.round(top)}px)`;
      g.fant.querySelector('small').textContent = decrire(row, mn); g.min = mn;
    }
    function defiler() {
      if (!GL || !GL.on) return; const z = 56, sc = V.o.defile || document.scrollingElement;
      const r = sc === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : sc.getBoundingClientRect();
      const v = GL.y < r.top + z ? -Math.ceil((r.top + z - GL.y) / 6) : GL.y > r.bottom - z ? Math.ceil((GL.y - (r.bottom - z)) / 6) : 0;
      if (v) { sc.scrollTop += v; bouger(); } GL.raf = requestAnimationFrame(defiler);
    }
    function redim() {
      const g = GL, dm = Math.round((g.x - g.x0) / g.pm / 30) * 30;
      if (g.bord === 'g') g.a = Math.min(Math.max(g.a0 + dm, H0 * 60), g.b0 - 30); else g.b = Math.max(Math.min(g.b0 + dm, H1 * 60), g.a0 + 30);
      g.src.style.left = pc(g.a) + '%'; g.src.style.width = Math.max(2.5, +pc(g.b) - +pc(g.a)).toFixed(2) + '%';
      const r = g.src.getBoundingClientRect(), k = g.b - g.a;
      g.fant.style.transform = `translate(${Math.round(Math.min(Math.max(4, g.bord === 'g' ? r.left : r.right - 60), (window.innerWidth || 372) - 130))}px,${Math.round(r.top)}px)`;
      g.fant.querySelector('small').textContent = hhmm(g.a) + '–' + hhmm(g.b) + ' · ' + fmtMin(k);
    }
    function fantome(lab, coul) { const f = document.createElement('div'); f.id = 'cal-fantome'; if (coul) f.style.setProperty('--c', coul); f.innerHTML = '<small></small>' + esc(lab); document.body.appendChild(f); return f; }
    function bas(e) {
      const s = e.target.closest('[data-cal-drag]'); if (!s || !root.contains(s) || (e.button && e.button !== 0)) return;
      const x = V.map.get(s.dataset.calK); if (!x || !x.mobile) return;
      const bord = e.target.closest('[data-cal-bord]');
      if (bord) { e.preventDefault(); GL = { bord: bord.dataset.calBord, src: s, el: x, x0: e.clientX, x: e.clientX, y: e.clientY, a0: +s.dataset.a, b0: +s.dataset.b, on: true, pm: pxParMin(s.closest('.cal-p')) };
        GL.a = GL.a0; GL.b = GL.b0; GL.fant = fantome('', x.coul); GL.fant.style.padding = '0'; GL.fant.style.boxShadow = 'none'; GL.fant.style.background = 'none'; redim(); return; }
      let decal = 0; if (s.dataset.a != null) { const r = s.getBoundingClientRect(); decal = Math.round((e.clientX - r.left) / pxParMin(s.closest('.cal-p'))); }
      GL = { src: s, el: x, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, on: false, decal, dur: x.min || 60 };
    }
    function bouge(e) {
      if (!GL) return; GL.x = e.clientX; GL.y = e.clientY;
      if (GL.bord) { e.preventDefault(); redim(); return; }
      if (!GL.on) { if (Math.hypot(GL.x - GL.x0, GL.y - GL.y0) < 6) return; GL.on = true; root.classList.add('glisse'); GL.fant = fantome(GL.el.titre, GL.el.coul); GL.src.style.opacity = '.35'; GL.raf = requestAnimationFrame(defiler); }
      e.preventDefault(); bouger();
    }
    async function haut() {
      if (!GL) return; const g = GL;
      if (!g.on) { fin(); return; }
      AVALE = true; setTimeout(() => { AVALE = false; }, 80);
      if (g.bord) { fin(); if (g.a === g.a0 && g.b === g.b0) { dessiner(); return; } await C.regler(g.el, hhmm(g.a), g.b - g.a); dessiner(); return; }
      bouger(); const row = g.row, mn = g.min, x = g.el; fin();
      if (!row) { if (!x.tray) await C.oter(x); dessiner(); return; }
      if (row.dataset.sem) await C.poser(x, { sem: row.dataset.sem });
      else if (row.dataset.piste != null) await C.poser(x, { jour: row.dataset.jour, debut: hhmm(mn) });
      else if (row.dataset.mois != null) await C.poser(x, { jour: row.dataset.jour, garder: true });
      else { const mo = row.dataset.moment || null; /* même demi-journée : l'heure précise reste, seul le jour change */
        await C.poser(x, x.debut && mo && momentDe(x.debut) === mo ? { jour: row.dataset.jour, debut: x.debut } : { jour: row.dataset.jour, moment: mo }); }
      dessiner();
    }
    function clic(e) {
      if (AVALE) { e.stopPropagation(); e.preventDefault(); return; }
      const t = e.target.closest('[data-cal-k]'); if (t && root.contains(t)) { const x = V.map.get(t.dataset.calK); if (x && V.o.ouvrir) V.o.ouvrir(x); return; }
      const s = e.target.closest('[data-cal-semaine]'); if (s && V.o.semaineChoisie) { V.o.semaineChoisie(s.dataset.calSemaine); return; }
      const r = e.target.closest('[data-cal-depot]'); if (!r || !root.contains(r) || !V.o.vide || r.dataset.sem) return;
      if (e.target.closest('summary,details')) return;
      if (r.dataset.mois != null) { V.o.vide({ jour: r.dataset.jour, mois: true }); return; }
      if (r.dataset.piste != null) { const mn = minuteSous(r, e.clientX, 0); V.o.vide({ jour: r.dataset.jour, debut: hhmm(Math.floor(mn / 60) * 60) }); return; }
      V.o.vide({ jour: r.dataset.jour, moment: r.dataset.moment || null });
    }
    const tog = (e) => { const d = e.target.closest && e.target.closest('[data-cal-det]'); if (d) V.ouvert[d.dataset.calDet] = d.open; };
    root.addEventListener('pointerdown', bas);
    window.addEventListener('pointermove', bouge, { passive: false });
    window.addEventListener('pointerup', haut);
    window.addEventListener('pointercancel', fin);
    root.addEventListener('click', clic, true);
    root.addEventListener('toggle', tog, true);
    dessiner();
    return { dessiner, regler, opts: V.o, detruire() { root.removeEventListener('pointerdown', bas); window.removeEventListener('pointermove', bouge); window.removeEventListener('pointerup', haut); window.removeEventListener('pointercancel', fin); root.removeEventListener('click', clic, true); root.removeEventListener('toggle', tog, true); } };
  }

  window.Calendrier = { creer: creerAvecApi, TYPES, TYPE_N, TYPE_C, MOMENT_H, MOMENT_L, JOURS, MOIS, MOIS_L, wkKey, wkNum, plusJ, parse, iso, jIdx, enMin, hhmm, hCourt, momentDe, fmtMin, clair, esc };
})();
