"""Tests du Calendrier (calendrier/ + commun/calendrier.js), avec un faux Supabase en mémoire.

Lancer depuis la racine du dépôt :  python3 tests/calendrier_test.py   (Playwright pour Python, Chromium)
Captures dans tests/captures/. Aucune donnée réelle n'est touchée : toutes les requêtes vers Supabase sont interceptées.
"""
import json, os, re, sys, threading, time, urllib.parse, functools
from datetime import datetime
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAPT = os.path.join(RACINE, 'tests', 'captures')
SB = 'https://rzcpjsffpvuvbdtqymms.supabase.co'
U = '11111111-1111-1111-1111-111111111111'
PORT = 8765
os.makedirs(CAPT, exist_ok=True)


def donnees(avec_table=True):
    lignes = lambda d: [{'user_id': U, 'key': k, 'data': v, 'deleted': False, 'updated_at': '2026-11-25T00:00:00Z'} for k, v in d.items()]
    db = {
        'rows': lignes({
            'p:p1': {'id': 'p1', 'name': 'Grenier', 'emoji': '🏠', 'color': '#C2452D', 'days': ['2026-11-24'], 'weeks': [], 'nature': 'pro', 'tasks': []},
            'p:p2': {'id': 'p2', 'name': 'Site GDT', 'emoji': '🥕', 'color': '#3F7A4A', 'days': [], 'weeks': ['2026-W48'], 'tasks': []},
            'p:p3': {'id': 'p3', 'name': 'Cachao', 'emoji': '🍫', 'color': '#8B5A2B', 'days': [], 'weeks': [], 'tasks': [], 'due': '2026-11-29'},
            'd:d1': {'id': 'd1', 'kind': 'domaine', 'name': 'Admin', 'emoji': '🗂', 'color': '#3768A8', 'tasks': [{'t': 'Payer la facture', 'due': '2026-11-26'}, {'t': 'Fait déjà', 'due': '2026-11-26', 'd': True}]},
        }),
        'biblio_rows': lignes({
            'h:2026-W48': {'p': {'p1|2026-11-24': [{'h': '13:30', 'min': 240}]}, 't': {'t1': '10:00'}},
            'n:t1': {'id': 't1', 'p': 'taches', 'o': 1, 't': 'Appeler le garage', 'jour': '2026-11-26'},
            'n:t2': {'id': 't2', 'p': 'taches', 'o': 2, 't': 'Trier les factures'},
            'n:v1': {'id': 'v1', 'p': 'vide', 'o': 1, 't': 'Une idée'},
        }),
        'carnet': lignes({
            'locus/semaines': {'le': '2026-11-25T00:00:00Z', 'semaines': {'2026-W48': [{'id': 's1', 't': 'Bas · force', 'day': 1, 'min': 75}, {'id': 's2', 't': 'Haut · technique', 'min': 60}]}},
            'logs/2026-W48': {'sessions': {'s1': {'day': 1}}},
        }),
        'locus_calendriers': [{'user_id': U, 'id': 'c1', 'nom': 'PERSO', 'couleur': '#8EC9EE', 'cree': '2026-11-20T00:00:00Z'}],
    }
    if avec_table:
        db['locus_evenements'] = []
    else:
        db['_absentes'] = ['locus_evenements']
    return db


PROTON = {'ev': [
    {'cal': 'c1', 'titre': 'Dentiste', 'lieu': 'Marly', 'debut': '2026-11-23T09:00', 'fin': '2026-11-23T10:00', 'journee': False},
    {'cal': 'c1', 'titre': 'Vacances Lucie', 'debut': '2026-11-28', 'fin': '2026-11-30', 'journee': True},
], 'cals': [{'id': 'c1', 'nom': 'PERSO'}], 'erreurs': []}


def val(row, col):
    if '->>' in col:
        a, b = col.split('->>'); v = (row.get(a) or {}).get(b)
        return None if v is None else str(v)
    return row.get(col)


def comparer(v, op, arg):
    sv = '' if v is None else (str(v).lower() if isinstance(v, bool) else str(v))
    if op == 'eq': return sv == arg
    if op == 'neq': return sv != arg
    if op == 'gte': return v is not None and sv >= arg
    if op == 'lte': return v is not None and sv <= arg
    if op == 'gt': return v is not None and sv > arg
    if op == 'lt': return v is not None and sv < arg
    if op == 'like': return re.fullmatch(re.escape(arg).replace('%', '.*').replace('\\%', '.*'), sv) is not None
    if op == 'in': return sv in [x.strip('"') for x in arg.strip('()').split(',')]
    if op == 'is': return (v is None) if arg == 'null' else sv == arg
    return True


class FauxSupabase:
    def __init__(self, db):
        self.db = db; self.log = []

    def filtres(self, q):
        out = []
        for k, vs in q.items():
            if k in ('select', 'order', 'on_conflict', 'columns', 'limit', 'offset'): continue
            for v in vs:
                op, _, arg = v.partition('.'); out.append((k, op, arg))
        return out

    def handle(self, route):
        req = route.request; u = urllib.parse.urlparse(req.url); path = u.path
        q = urllib.parse.parse_qs(u.query, keep_blank_values=True)
        if path.startswith('/auth/'):
            return route.fulfill(status=200, json={'id': U, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'n@x.ch'})
        if path.startswith('/functions/v1/calendriers'):
            return route.fulfill(status=200, json=PROTON)
        if path.startswith('/functions/'):
            return route.fulfill(status=404, body='')
        m = re.match(r'/rest/v1/(rpc/)?([\w]+)', path)
        if not m: return route.fulfill(status=404, body='')
        if m.group(1): return route.fulfill(status=200, json=None)
        t = m.group(2)
        if t not in self.db and t not in self.db.get('_absentes', []):
            self.db[t] = []
        if t not in self.db:
            return route.fulfill(status=404, json={'code': '42P01', 'message': f'relation "public.{t}" does not exist'})
        rows = self.db[t]; meth = req.method
        if meth in ('GET', 'HEAD'):
            res = [r for r in rows if all(comparer(val(r, c), op, a) for c, op, a in self.filtres(q))]
            return route.fulfill(status=200, json=res)
        if meth == 'POST':
            body = json.loads(req.post_data or '[]'); body = body if isinstance(body, list) else [body]
            keys = (q.get('on_conflict') or ['user_id,key'])[0].split(','); out = []
            for b in body:
                b = dict(b); b.setdefault('user_id', U)
                if t == 'locus_evenements':
                    b.setdefault('options', {}); b.setdefault('deleted', False)
                    if b.get('debut') and len(b['debut']) == 5: b['debut'] += ':00'
                ex = next((r for r in rows if all(r.get(k) == b.get(k) for k in keys)), None)
                if ex: ex.update(b); out.append(ex)
                else: rows.append(b); out.append(b)
                self.log.append((t, b))
            return route.fulfill(status=201, json=out)
        if meth == 'PATCH':
            body = json.loads(req.post_data or '{}')
            for r in rows:
                if all(comparer(val(r, c), op, a) for c, op, a in self.filtres(q)): r.update(body)
            return route.fulfill(status=204, body='')
        return route.fulfill(status=405, body='')

    def ligne(self, t, key):
        r = next((r for r in self.db[t] if r.get('key') == key), None)
        return r and r['data']


def serveur():
    class Muet(SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Muet, directory=RACINE)
    s = ThreadingHTTPServer(('127.0.0.1', PORT), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


SESSION = json.dumps({'access_token': 'jeton', 'token_type': 'bearer', 'expires_in': 3600, 'expires_at': int(time.time()) + 86400 * 30,
                      'refresh_token': 'r', 'user': {'id': U, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'n@x.ch'}})

OK = []; KO = []


def verifier(nom, cond, detail=''):
    (OK if cond else KO).append(nom); print(('  ✓ ' if cond else '  ✗ ') + nom + ('' if cond else '  → ' + str(detail)))


def ouvrir(p, fs, url='calendrier/?sem=2026-W48', largeur=420):
    ctx = p.new_context(viewport={'width': largeur, 'height': 900}, service_workers='block', locale='fr-CH', timezone_id='Europe/Zurich')
    ctx.add_init_script(f"localStorage.setItem('orga-auth', {json.dumps(SESSION)});")
    page = ctx.new_page()
    page.clock.set_system_time(datetime(2026, 11, 25, 10, 0))
    erreurs = []
    page.on('pageerror', lambda e: erreurs.append(str(e)))
    page.on('console', lambda m: erreurs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    page.route(SB + '/**', fs.handle)
    page.goto(f'http://127.0.0.1:{PORT}/{url}')
    page.wait_for_selector('.cal-s, .cal-h, .cal-m')
    page.wait_for_timeout(600)
    return ctx, page, erreurs


def glisser(page, src, dst, dx=0, dy=0):
    page.wait_for_timeout(300); page.locator(src).first.wait_for(state='visible', timeout=8000)
    a = page.locator(src).first.bounding_box(); b = page.locator(dst).first.bounding_box() if isinstance(dst, str) else dst
    x0, y0 = a['x'] + min(12, a['width'] / 2), a['y'] + a['height'] / 2
    x1, y1 = (b['x'] + b['width'] / 2 + dx, b['y'] + b['height'] / 2 + dy) if isinstance(dst, str) else (b[0], b[1])
    page.mouse.move(x0, y0); page.mouse.down()
    for i in range(1, 13): page.mouse.move(x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * i / 12); page.wait_for_timeout(15)
    page.mouse.up(); page.wait_for_timeout(1300)


def puce(texte):
    return f'.cal-el:has-text("{texte}")'


def main():
    srv = serveur()
    with sync_playwright() as p:
        nav = p.chromium.launch()

        print('Vue simple : lecture')
        fs = FauxSupabase(donnees())
        ctx, page, err = ouvrir(p.chromium if False else nav, fs)
        jour = lambda d, m: f'[data-jour="{d}"][data-moment="{m}"]'
        verifier('titre « Semaine 48 »', page.inner_text('#titre') == 'Semaine 48', page.inner_text('#titre'))
        verifier('Grenier (13:30, 4 h) = mardi après-midi', page.locator(jour('2026-11-24', 'aprem') + ' ' + puce('Grenier')).count() == 1)
        verifier('Site GDT sur toute la semaine', page.locator('.cal-sem ' + puce('Site GDT')).count() == 1)
        verifier('séance s1 mardi, sans heure → journée', page.locator(jour('2026-11-24', '') + ' ' + puce('Bas · force')).count() == 1)
        verifier('tâche t1 jeudi 10:00 → matin, avec l’heure', page.locator(jour('2026-11-26', 'matin') + ' ' + puce('Appeler le garage')).inner_text().startswith('10:00'))
        verifier('Proton : Dentiste lundi matin 9:00', page.locator(jour('2026-11-23', 'matin') + ' ' + puce('Dentiste')).count() == 1)
        verifier('Proton : vacances samedi et dimanche, journée', page.locator('[data-moment=""] ' + puce('Vacances Lucie')).count() == 2)
        verifier('échéances : tâche datée d’un domaine (jeudi) et projet (dimanche), en lecture', page.locator(jour('2026-11-26', '') + ' ' + puce('Payer la facture')).count() == 1 and page.locator(jour('2026-11-29', '') + ' ' + puce('Cachao')).count() == 1 and page.locator(puce('Fait déjà')).count() == 0)
        page.click('.cal-boite summary')
        verifier('À placer : la tâche t2 et la séance s2', page.locator('.cal-boite ' + puce('Trier les factures')).count() == 1 and page.locator('.cal-boite ' + puce('Haut · technique')).count() == 1)
        page.screenshot(path=os.path.join(CAPT, 'simple-telephone.png'), full_page=True)

        print('Glisser dans la vue simple')
        glisser(page, jour('2026-11-24', 'aprem') + ' ' + puce('Grenier'), jour('2026-11-25', 'matin'))
        P1 = fs.ligne('rows', 'p:p1'); H = fs.ligne('biblio_rows', 'h:2026-W48')
        verifier('projet déplacé : jours', P1['days'] == ['2026-11-25'], P1['days'])
        verifier('projet déplacé : créneau « matin » (m)', H['p'].get('p1|2026-11-25') == [{'h': '08:00', 'min': 240, 'm': 'matin'}] and 'p1|2026-11-24' not in H['p'], H['p'])
        glisser(page, '.cal-boite ' + puce('Trier les factures'), jour('2026-11-27', 'aprem'))
        H = fs.ligne('biblio_rows', 'h:2026-W48')
        verifier('tâche placée : n.jour', fs.ligne('biblio_rows', 'n:t2').get('jour') == '2026-11-27')
        verifier('tâche placée : moment dans h.m', H.get('m', {}).get('t:t2') == 'aprem', H)
        page.click('.cal-boite summary') if not page.locator('.cal-boite[open]').count() else None
        glisser(page, '.cal-boite ' + puce('Haut · technique'), jour('2026-11-26', 'matin'))
        verifier('séance placée : logs sessions.day = 3', fs.ligne('carnet', 'logs/2026-W48')['sessions'].get('s2', {}).get('day') == 3, fs.ligne('carnet', 'logs/2026-W48'))
        verifier('séance placée : moment', fs.ligne('biblio_rows', 'h:2026-W48').get('m', {}).get('f:s2') == 'matin')
        verifier('séance : l’autre séance garde son jour', fs.ligne('carnet', 'logs/2026-W48')['sessions']['s1'].get('day') == 1)
        glisser(page, jour('2026-11-26', 'matin') + ' ' + puce('Appeler le garage'), jour('2026-11-27', 'matin'))
        verifier('même demi-journée, autre jour : l’heure reste', fs.ligne('biblio_rows', 'h:2026-W48')['t'].get('t1') == '10:00' and fs.ligne('biblio_rows', 'n:t1')['jour'] == '2026-11-27')
        n_av = len(fs.log)
        glisser(page, jour('2026-11-23', 'matin') + ' ' + puce('Dentiste'), jour('2026-11-24', 'matin'))
        verifier('Proton reste fixe', len(fs.log) == n_av and page.locator(jour('2026-11-23', 'matin') + ' ' + puce('Dentiste')).count() == 1)
        page.click('.cal-boite summary') if not page.locator('.cal-boite[open]').count() else None
        page.click('details[data-cal-det="autres"] summary')
        glisser(page, '.cal-boite ' + puce('Cachao'), '.cal-sem')
        verifier('projet posé sur « Semaine »', fs.ligne('rows', 'p:p3')['weeks'] == ['2026-W48'])
        glisser(page, '.cal-sem ' + puce('Site GDT'), jour('2026-11-23', 'aprem'))
        P2 = fs.ligne('rows', 'p:p2')
        verifier('la dernière décision gagne : semaine → jour', P2['weeks'] == [] and P2['days'] == ['2026-11-23'], P2)
        glisser(page, jour('2026-11-25', 'matin') + ' ' + puce('Grenier'), (200, 30))
        verifier('sorti du calendrier : enlevé de son jour', fs.ligne('rows', 'p:p1')['days'] == [] and 'p1|2026-11-25' not in fs.ligne('biblio_rows', 'h:2026-W48').get('p', {}))

        print('Événements')
        page.click('#fab'); page.fill('#e-titre', 'Cours parkour'); page.click('[data-type="activite"]')
        page.fill('#e-jour', '2026-11-25'); page.click('#q-mom [data-q="heure"]'); page.fill('#q-heure', '18:00'); page.select_option('#e-duree', '90')
        page.click('#e-opt summary'); page.fill('#e-trajet', '20')
        page.click('[data-r="evOk"]'); page.wait_for_timeout(1300)
        EV = fs.db['locus_evenements']
        verifier('événement enregistré', len(EV) == 1 and EV[0]['titre'] == 'Cours parkour' and EV[0]['debut'].startswith('18:00') and EV[0]['duree_min'] == 90 and EV[0]['type'] == 'activite' and EV[0]['options'] == {'trajet_min': 20}, EV)
        verifier('événement affiché mercredi après-midi', page.locator(jour('2026-11-25', 'aprem') + ' ' + puce('Cours parkour')).count() == 1)
        page.click('#fab'); page.click('[data-type="job"]'); page.fill('#e-titre', 'Remplacement'); page.fill('#e-jour', '2026-11-27'); page.click('#q-mom [data-q="matin"]')
        page.click('#e-opt summary'); page.check('#e-decl'); page.click('[data-r="evOk"]'); page.wait_for_timeout(1300)
        J = next(r for r in EV if r['titre'] == 'Remplacement')
        verifier('job du matin, déclaré', J['moment'] == 'matin' and J['debut'] is None and J['options'].get('declare') is True, J)
        verifier('job affiché « déclaré »', 'déclaré' in page.locator(jour('2026-11-27', 'matin') + ' ' + puce('Remplacement')).inner_text())
        glisser(page, jour('2026-11-25', 'aprem') + ' ' + puce('Cours parkour'), jour('2026-11-26', 'aprem'))
        C1 = next(r for r in EV if r['titre'] == 'Cours parkour')
        verifier('événement glissé : jour changé, heure gardée', C1['jour'] == '2026-11-26' and C1['debut'].startswith('18:00'), C1)
        page.click(jour('2026-11-26', 'aprem') + ' ' + puce('Cours parkour')); page.wait_for_timeout(200)
        verifier('toucher un événement ouvre sa fiche', page.input_value('#e-titre') == 'Cours parkour')
        page.click('[data-r="evSuppr"]'); page.click('[data-r="evSuppr"]'); page.wait_for_timeout(400)
        verifier('événement supprimé (deleted)', C1['deleted'] is True and page.locator(puce('Cours parkour')).count() == 0)
        page.click('#fab'); page.click('[data-type="projet"]'); page.select_option('#e-projet', 'p3'); page.fill('#e-jour', '2026-11-24'); page.click('#q-mom [data-q="aprem"]'); page.click('[data-r="evOk"]'); page.wait_for_timeout(1300)
        P3 = fs.ligne('rows', 'p:p3')
        verifier('type « projet » : place le vrai projet', '2026-11-24' in P3['days'] and P3['weeks'] == [] and fs.ligne('biblio_rows', 'h:2026-W48')['p'].get('p3|2026-11-24') == [{'h': '13:30', 'min': 240, 'm': 'aprem'}], (P3, fs.ligne('biblio_rows', 'h:2026-W48')))
        page.click('#fab'); page.click('[data-type="tache"]'); page.fill('#e-titre', 'Rappeler Noé'); page.fill('#e-jour', '2026-11-28'); page.click('#q-mom [data-q="jour"]'); page.click('[data-r="evOk"]'); page.wait_for_timeout(1300)
        T = [r['data'] for r in fs.db['biblio_rows'] if r['key'].startswith('n:') and r['data'].get('t') == 'Rappeler Noé']
        verifier('type « tâche » : vraie tâche (racine taches) avec son jour', len(T) == 1 and T[0]['p'] == 'taches' and T[0]['jour'] == '2026-11-28', T)
        page.click(jour('2026-11-24', '') + ' ' + puce('Bas · force')); page.click('#q-mom [data-q="heure"]'); page.fill('#q-heure', '18:30'); page.click('[data-r="qOk"]'); page.wait_for_timeout(1300)
        verifier('fiche d’une séance : heure précise', fs.ligne('biblio_rows', 'h:2026-W48').get('f', {}).get('s1') == '18:30')
        page.screenshot(path=os.path.join(CAPT, 'simple-apres.png'), full_page=True)
        verifier('pas d’erreur JS (vue simple)', not err, err)

        print('Vue en heures')
        page.click('[data-vue="heures"]'); page.wait_for_selector('.cal-h')
        verifier('vue gardée sur l’appareil', page.evaluate(f"localStorage.getItem('locus-cal-vue-{U}')") == 'heures')
        piste = page.locator('.cal-p[data-jour="2026-11-27"]').bounding_box()
        x15 = piste['x'] + piste['width'] * (15 - 7) / 15 + 3
        glisser(page, '.cal-p[data-jour="2026-11-27"] ' + puce('Appeler le garage'), (x15 + 0, piste['y'] + 10))
        verifier('vue en heures : heure arrondie à la demi-heure', fs.ligne('biblio_rows', 'h:2026-W48')['t'].get('t1') in ('15:00', '15:30', '14:30'), fs.ligne('biblio_rows', 'h:2026-W48')['t'])
        verifier('vue en heures : la tâche perd son moment', 't:t1' not in fs.ligne('biblio_rows', 'h:2026-W48').get('m', {}))
        b = page.locator('.cal-p[data-jour="2026-11-24"] ' + puce('Cachao') + ' .poignee.d').bounding_box()
        page.mouse.move(b['x'] + 5, b['y'] + 8); page.mouse.down()
        pw = page.locator('.cal-p[data-jour="2026-11-24"]').bounding_box()['width'] / (15 * 60)
        for i in range(1, 8): page.mouse.move(b['x'] + 5 + 60 * pw * i / 7, b['y'] + 8); page.wait_for_timeout(15)
        page.mouse.up(); page.wait_for_timeout(1300)
        verifier('étirer un projet : durée 5 h, heure précise', fs.ligne('biblio_rows', 'h:2026-W48')['p'].get('p3|2026-11-24') == [{'h': '13:30', 'min': 300}], fs.ligne('biblio_rows', 'h:2026-W48')['p'])
        page.screenshot(path=os.path.join(CAPT, 'heures-telephone.png'), full_page=True)

        print('Vue mois')
        page.click('[data-vue="mois"]'); page.wait_for_selector('.cal-m')
        verifier('titre du mois', page.inner_text('#titre') == 'Novembre 2026', page.inner_text('#titre'))
        verifier('le job est dans la case du 27', page.locator('.cal-m-j[data-jour="2026-11-27"] ' + puce('Remplacement')).count() == 1)
        glisser(page, '.cal-m-j[data-jour="2026-11-27"] ' + puce('Remplacement'), '.cal-m-j[data-jour="2026-11-20"]')
        J = next(r for r in EV if r['titre'] == 'Remplacement')
        verifier('mois : jour changé, moment gardé', J['jour'] == '2026-11-20' and J['moment'] == 'matin', J)
        page.screenshot(path=os.path.join(CAPT, 'mois-telephone.png'), full_page=True)
        page.click('.cal-m-s:has-text("S49")'); page.wait_for_selector('.cal-h')
        verifier('mois → semaine choisie, dernière vue de semaine', page.inner_text('#titre') == 'Semaine 49')
        verifier('pas d’erreur JS', not err, err)
        page.goto(f'http://127.0.0.1:{PORT}/calendrier/'); page.wait_for_selector('.cal-s, .cal-h, .cal-m')
        verifier('rechargé sans adresse : la dernière vue choisie revient (mois)', page.locator('.cal-m').count() == 1)
        ctx.close()

        print('Largeur ordinateur')
        ctx, page, err = ouvrir(nav, fs, url='calendrier/?sem=2026-W48&vue=simple', largeur=1200)
        page.wait_for_timeout(1500)
        verifier('autre appareil : la séance placée se lit dans le carnet (logs), même sans rouvrir la Forge', page.locator('[data-jour="2026-11-26"][data-moment="matin"] ' + puce('Haut · technique')).count() == 1)
        page.screenshot(path=os.path.join(CAPT, 'simple-ordi.png'), full_page=True)
        verifier('pas d’erreur JS', not err, err)
        ctx.close()

        print('Sans la table locus_evenements')
        fs2 = FauxSupabase(donnees(avec_table=False))
        ctx, page, err = ouvrir(nav, fs2)
        verifier('message : lancer calendrier.sql', 'calendrier.sql' in page.inner_text('#etat'), page.inner_text('#etat'))
        try: page.wait_for_selector('.cal-s ' + puce('Grenier'), timeout=8000)
        except Exception: pass
        verifier('le reste s’affiche', page.locator('.cal-s ' + puce('Grenier')).count() == 1, page.locator('.cal-el').all_inner_texts())
        verifier('pas d’erreur JS', not err, err)
        ctx.close()

        print('Accueil : le numéro de semaine ouvre le calendrier')
        fs4 = FauxSupabase(donnees())
        ctx = nav.new_context(viewport={'width': 420, 'height': 900}, service_workers='block', locale='fr-CH', timezone_id='Europe/Zurich')
        ctx.add_init_script(f"localStorage.setItem('orga-auth', {json.dumps(SESSION)});")
        page = ctx.new_page(); page.clock.set_system_time(datetime(2026, 11, 25, 10, 0)); page.route(SB + '/**', fs4.handle)
        err = []; page.on('pageerror', lambda e: err.append(str(e)))
        page.goto(f'http://127.0.0.1:{PORT}/'); page.wait_for_selector('#b-semaine'); page.wait_for_timeout(800)
        page.click('#b-semaine'); page.wait_for_selector('iframe.dans.actif.vu', timeout=8000)
        fr = page.frame_locator('iframe.dans.actif')
        fr.locator('.cal-s').wait_for(timeout=8000)
        verifier('le calendrier s’ouvre par-dessus l’accueil, sur la semaine en cours', fr.locator('#titre').inner_text() == 'Semaine 48')
        page.screenshot(path=os.path.join(CAPT, 'accueil-calendrier.png'))
        fr.locator('.oh-orga').click(); page.wait_for_timeout(800)
        verifier('le retour referme le calendrier', page.locator('iframe.dans.actif').count() == 0 and page.locator('#b-semaine').is_visible())
        verifier('pas d’erreur JS (accueil)', not err, err)
        ctx.close()

        print('Routine du lundi : les étapes 8 à 11 sur le calendrier')
        fs5 = FauxSupabase(donnees())
        ctx = nav.new_context(viewport={'width': 420, 'height': 900}, service_workers='block', locale='fr-CH', timezone_id='Europe/Zurich')
        ctx.add_init_script(f"localStorage.setItem('orga-auth', {json.dumps(SESSION)}); localStorage.setItem('locus-cal-vuesem-{U}', 'simple');")
        page = ctx.new_page(); page.clock.set_system_time(datetime(2026, 11, 25, 10, 0)); page.route(SB + '/**', fs5.handle)
        err = []; page.on('pageerror', lambda e: err.append(str(e)))
        page.on('console', lambda m: err.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        page.goto(f'http://127.0.0.1:{PORT}/'); page.wait_for_selector('#b-semaine'); page.wait_for_timeout(1200)
        def etape(k):
            page.evaluate(f"(()=>{{ if($plein.hidden) ouvrirRoutine(); R.etape=etapesActives().indexOf('{k}')+1; $plein.dataset.e=''; vRoutine(); }})()")
            page.wait_for_selector('#r-cal .cal-s', timeout=8000); page.wait_for_timeout(1200)
        etape('agenda')
        verifier('agenda : Proton dans le calendrier', page.locator('#r-cal ' + puce('Dentiste')).count() == 1)
        verifier('agenda : seulement Proton et rendez-vous (pas les projets)', page.locator('#r-cal ' + puce('Grenier')).count() == 0)
        verifier('agenda : calendriers lus', 'calendriers lus' in page.inner_text('#r-cals').lower())
        page.click('#r-cal [data-jour="2026-11-26"][data-moment="aprem"]'); page.fill('.cal-sheet #e-titre', 'Coiffeur'); page.click('.cal-sheet #q-mom [data-q="heure"]'); page.fill('.cal-sheet #q-heure', '16:00'); page.click('.cal-sheet [data-r="evOk"]'); page.wait_for_timeout(1200)
        verifier('agenda : toucher une case ajoute un rendez-vous', any(r['titre'] == 'Coiffeur' and r['jour'] == '2026-11-26' for r in fs5.db['locus_evenements']) and page.locator('#r-cal ' + puce('Coiffeur')).count() == 1)
        page.screenshot(path=os.path.join(CAPT, 'routine-agenda.png'), full_page=True)
        etape('projets')
        verifier('projets : Grenier à sa place', page.locator('#r-cal [data-jour="2026-11-24"][data-moment="aprem"] ' + puce('Grenier')).count() == 1)
        page.click('#r-cal details[data-cal-det="autres"] summary')
        glisser(page, '#r-cal .cal-boite ' + puce('Cachao'), '#r-cal [data-jour="2026-11-25"][data-moment="matin"]')
        verifier('projets : glisser depuis « À placer »', '2026-11-25' in fs5.ligne('rows', 'p:p3')['days'])
        verifier('projets : le compte des projets', 'cette semaine' in page.inner_text('#corps'))
        page.screenshot(path=os.path.join(CAPT, 'routine-projets.png'), full_page=True)
        etape('forge')
        glisser(page, '#r-cal .cal-boite ' + puce('Haut · technique'), '#r-cal [data-jour="2026-11-26"][data-moment="matin"]')
        verifier('entraînements : séance placée', fs5.ligne('carnet', 'logs/2026-W48')['sessions'].get('s2', {}).get('day') == 3)
        verifier('entraînements : les projets sont là, immobiles', page.locator('#r-cal ' + puce('Grenier') + '.pale').count() == 1 and page.locator('#r-cal ' + puce('Grenier') + '[data-cal-drag]').count() == 0)
        etape('taches')
        glisser(page, '#r-cal .cal-boite ' + puce('Trier les factures'), '#r-cal [data-jour="2026-11-27"][data-moment="aprem"]')
        verifier('tâches : tâche placée', fs5.ligne('biblio_rows', 'n:t2').get('jour') == '2026-11-27')
        verifier('tâches : le jour revient dans la routine (B)', page.evaluate("B['n:t2'].jour") == '2026-11-27')
        page.click('#r-cal [data-cal-vue="heures"]'); page.wait_for_selector('#r-cal .cal-h')
        verifier('choix de la vue dans la routine, gardé', page.evaluate(f"localStorage.getItem('locus-cal-vuesem-{U}')") == 'heures')
        page.evaluate("(()=>{ R.etape=etapesActives().indexOf('claude')+1; $plein.dataset.e=''; vRoutine(); })()"); page.wait_for_timeout(500)
        t = page.inner_text('#t-claude')
        verifier('texte pour Claude : planning lu dans le calendrier', all(x in t for x in ['PLANNING S48', 'lun 23 : 09:00 Dentiste (Proton)', '- toute la semaine : Site GDT', 'après-midi : Grenier', 'matin : Forge : Haut · technique', 'Rendez-vous : Coiffeur (1 h)', 'après-midi : Tâche : Trier les factures', 'échéance : Payer la facture']), t)
        verifier('pas d’erreur JS (routine)', not err, err)
        ctx.close()

        print('Établi : le Planning est le calendrier')
        fs6 = FauxSupabase(donnees())
        ctx = nav.new_context(viewport={'width': 420, 'height': 900}, service_workers='block', locale='fr-CH', timezone_id='Europe/Zurich')
        ctx.add_init_script(f"localStorage.setItem('orga-auth', {json.dumps(SESSION)}); localStorage.setItem('locus-cal-vue-{U}', 'simple');")
        page = ctx.new_page(); page.clock.set_system_time(datetime(2026, 11, 25, 10, 0)); page.route(SB + '/**', fs6.handle)
        err = []; page.on('pageerror', lambda e: err.append(str(e)))
        page.goto(f'http://127.0.0.1:{PORT}/etabli/#planning'); page.wait_for_selector('#pl-cal .cal-s', timeout=10000)
        try: page.wait_for_selector('#pl-cal [data-moment="aprem"] ' + puce('Grenier'), timeout=8000)
        except Exception: pass
        verifier('Établi : Grenier mardi après-midi, Proton lundi', page.locator('#pl-cal [data-jour="2026-11-24"][data-moment="aprem"] ' + puce('Grenier')).count() == 1 and page.locator('#pl-cal ' + puce('Dentiste')).count() == 1)
        glisser(page, '#pl-cal [data-jour="2026-11-24"][data-moment="aprem"] ' + puce('Grenier'), '#pl-cal [data-jour="2026-11-26"][data-moment="matin"]')
        page.wait_for_timeout(1500)
        verifier('Établi : projet déplacé, synchro de l’Établi', fs6.ligne('rows', 'p:p1')['days'] == ['2026-11-26'] and fs6.ligne('biblio_rows', 'h:2026-W48')['p'].get('p1|2026-11-26') == [{'h': '08:00', 'min': 240, 'm': 'matin'}], (fs6.ligne('rows', 'p:p1'), fs6.ligne('biblio_rows', 'h:2026-W48')))
        page.click('#pl-cal [data-jour="2026-11-26"][data-moment="matin"] ' + puce('Grenier')); page.wait_for_timeout(500)
        verifier('Établi : toucher un projet ouvre sa fiche de l’Établi', page.locator('#scrim:not([hidden])').count() == 1 and page.locator('.cal-scrim:not([hidden])').count() == 0)
        page.keyboard.press('Escape'); page.wait_for_timeout(600)
        verifier('Établi : Échap ferme la fiche sans rien annuler', page.locator('#scrim:not([hidden])').count() == 0 and fs6.ligne('rows', 'p:p1')['days'] == ['2026-11-26'] and page.locator('#pl-cal [data-jour="2026-11-26"][data-moment="matin"] ' + puce('Grenier')).count() == 1)
        page.screenshot(path=os.path.join(CAPT, 'etabli-planning.png'), full_page=True)
        verifier('pas d’erreur JS (Établi)', not err, err)
        ctx.close()

        print('Palettes (pas de couleur en dur)')
        fs3 = FauxSupabase(donnees())
        for pal in ('doux', 'nuit', 'contraste'):
            ctx = nav.new_context(viewport={'width': 420, 'height': 900}, service_workers='block')
            prof = json.dumps({'style': 'village', 'palette': pal, 'fond': 'clair', 'le': '2026-11-26T00:00:00Z'})
            ctx.add_init_script(f"localStorage.setItem('orga-auth', {json.dumps(SESSION)}); localStorage.setItem('locus-profil-{U}', {json.dumps(prof)});")
            page = ctx.new_page(); page.clock.set_system_time(datetime(2026, 11, 25, 10, 0)); page.route(SB + '/**', fs3.handle)
            page.goto(f'http://127.0.0.1:{PORT}/calendrier/?sem=2026-W48&vue=simple'); page.wait_for_selector('.cal-s'); page.wait_for_timeout(1300)
            page.screenshot(path=os.path.join(CAPT, f'palette-{pal}.png'), full_page=True); ctx.close()
        verifier('captures des palettes', all(os.path.exists(os.path.join(CAPT, f'palette-{x}.png')) for x in ('doux', 'nuit', 'contraste')))
        nav.close()
    srv.shutdown()
    print(f'\n{len(OK)} réussis, {len(KO)} ratés')
    sys.exit(1 if KO else 0)


if __name__ == '__main__':
    main()
