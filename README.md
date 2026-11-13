# ORGA

Mes apps perso, réunies derrière un menu à tuiles. Une seule app à installer.

- Accueil : https://gottonic.github.io/orga/
- **L’Établi** — mes projets, semaine par semaine : https://gottonic.github.io/orga/etabli/
- **La Banque** — mes comptes et mes dépenses (ex-« Cash ») : https://gottonic.github.io/orga/banque/
- **La Forge** — mon entraînement parkour (ex-« Carnet ») : https://gottonic.github.io/orga/forge/
- **Le Marché** — ma liste de courses, rangée par magasin : https://gottonic.github.io/orga/marche/
- **La Mine** — mon travail pro : mandats, clients, heures, devis, factures avec QR-facture : https://gottonic.github.io/orga/mine/

Toutes les apps partagent la même base Supabase et la même connexion : on se connecte une fois.
Chaque app garde son propre style : chacune est un lieu à part.
Tout fonctionne hors ligne ; les changements partent dès que le réseau revient.

## Organisation du dépôt

| Dossier | Contenu |
|---|---|
| `/` | accueil ORGA (`index.html`), `manifest.webmanifest`, `sw.js` (hors ligne pour toutes les apps), icônes |
| `etabli/` | l'app Établi |
| `banque/` | l'app Banque (`cash/` redirige vers elle) |
| `forge/` | l'app Forge, avec son programme (`programme.json`), ses polices et ses icônes |
| `marche/` | l'app Marché (liste de courses), avec sa police (Caveat) et ses icônes |
| `mine/` | l'app Mine (travail pro), avec sa police (Big Shoulders Stencil), ses icônes et `lib/qrcode.js` (générateur de codes QR, licence MIT) |
| `commun/` | ce que les apps partagent : `supabase.js`, `ampoule.js` (bugs et idées), polices |
| `supabase/` | `schema.sql` (Établi), `cash.sql` (Banque : la table s'appelle `cash_rows`), `carnet.sql` (Forge : la table garde l'ancien nom `carnet`), `orga.sql` (socle commun : ampoule 💡, captures, place utilisée — remplace `idees.sql`), pour toutes les apps), `marche.sql` (Marché : table `marche_rows`), `mine.sql` (Mine : table `mine_rows`) |
| `.github/workflows/` | signal deux fois par semaine pour que Supabase ne se mette pas en veille |

À chaque mise à jour du code, changer `VERSION` en haut de `sw.js`.

## Mise en route (une seule fois)

### 1. Les bases de données
Supabase → ton projet → **SQL Editor** → **New query** → coller `supabase/schema.sql` → **Run**
(déjà fait pour Établi). Puis une nouvelle requête avec `supabase/cash.sql` → **Run** : le résultat doit être « cash_rows prête ».
Puis `supabase/orga.sql` → **Run** : le résultat doit être « ORGA prêt » (table des idées, dossier des captures, mesure de la place). On peut le relancer sans risque.
Puis `supabase/marche.sql` → **Run** : le résultat doit être « marche_rows prête ».
Puis `supabase/mine.sql` → **Run** : le résultat doit être « mine_rows prête ».

### 2. Ton compte
Supabase → **Authentication** → **Users** → **Add user** → **Create new user** :
adresse e-mail + mot de passe, cocher **Auto Confirm User**.
Puis fermer la porte aux inconnus : **Authentication** → **Sign In / Providers** →
désactiver **Allow new users to sign up**.

### 3. Le site
GitHub → dépôt `orga` → **Settings** → **Pages** → Source : **Deploy from a branch**,
branche `main`, dossier `/ (root)` → **Save**.

## Installer l'app

- **Téléphone** : ouvrir https://gottonic.github.io/orga/ → menu du navigateur → **Installer** ou
  **Ajouter à l'écran d'accueil**. Si l'ancienne icône « Établi » est encore là, la supprimer.
- **Ubuntu** : dans Chromium, Brave ou Vivaldi → icône d'installation dans la barre d'adresse.
  Dans Firefox : un onglet épinglé.

Dans chaque app, le petit carré en haut à gauche ramène à l'accueil ORGA.

## Réglages d'ORGA

- La roue dentée ⚙ en haut à droite de l'accueil → `reglages/` : place utilisée sur Supabase (base et fichiers, par app),
  compte (se déconnecter de toutes les apps), version installée et recherche de mise à jour.
- La place vient de la fonction `orga_espace()` (dans `supabase/orga.sql`) : seulement des totaux, réservée aux personnes connectées.
- Limites du plan gratuit : 500 Mo de base pour ce projet ; 1 Go de fichiers et 5 Go de trafic pour tout le compte Supabase.

## L'ampoule 💡 (toutes les apps)

- Dans chaque app et sur l'accueil, le bouton 💡 ouvre « Bugs et idées », comme dans l'app Gamins de Talus :
  choisir 🐞 Bug ou 💡 Idée, écrire le titre, « + » (détails facultatifs). Cocher = fait, la ligne quitte la liste.
- Chaque app a sa propre liste. Sur l'accueil : la liste d'ORGA (menu, liens entre apps…) et « Toutes les apps ».
- « Copier pour Claude » copie la liste en texte, à coller dans la conversation de l'app.
- **Captures d'écran** : coller (Ctrl+V), glisser ou « 📎 Joindre une capture », à l'ajout comme dans la fiche (6 au plus).
  Réduites à 1600 px (WebP), gardées sur l'appareil puis envoyées dans le dossier privé `idees` de Supabase.
  Retirer une capture ou supprimer l'idée efface aussi le fichier.
- On peut noter hors ligne : l'envoi (texte et captures) se fait dès que le réseau revient.
- Données : table `idees` (une ligne par idée, colonne `app`), dossier `idees`, même connexion que les apps.
- Pour l'ajouter à une nouvelle app : `<script src="../commun/ampoule.js" data-app="nom" data-avant="#bouton"></script>`
  (voir les explications en haut de `commun/ampoule.js`), puis ajouter son nom et son style dans `APPS` et `THEMES`.

## Bon à savoir (Établi)

- Le petit symbole à côté du numéro de semaine indique l'état : ✓ tout est enregistré,
  ↻ envoi en cours, « hors ligne », ⚠ problème (toucher pour les détails).
- Toucher ce symbole permet aussi d'**exporter toutes tes données** dans un fichier.
- GitHub arrête les signaux de réveil après 60 jours sans aucune modification du dépôt :
  il suffit alors de relancer l'action à la main (onglet **Actions**).

## Bon à savoir (Forge)

- Le programme (blocs, séances, conseils) est dans `forge/programme.json`. Quand Claude publie une nouvelle version,
  l'app l'installe toute seule à l'ouverture (ce fichier ne passe jamais par le cache). Ton journal, tes charges
  et tes tests ne sont jamais dans ce dépôt.
- Un bloc ou une séance modifié dans l'app n'est plus écrasé par les mises à jour de Claude : la version de Claude
  attend dans **Données → Programme**, où tu choisis de la prendre ou de garder la tienne.
- **Données → Exporter** crée un fichier avec tout l'entraînement : à envoyer à Claude pour un bilan, ou à garder.
- Les données sont dans la table `carnet` et le dossier privé `carnet` de Supabase (ancien nom, inchangé).
- Les images d'exercices sont gardées sur l'appareil (cache `carnet-media`), que les mises à jour n'effacent pas.
- Les clés présentes dans le code (adresse du projet, clé « publishable ») sont faites pour être publiques.
  Ne jamais mettre ici la clé « secret / service_role » ni le mot de passe de la base.

## Bon à savoir (Marché)

- **Liste** : les articles à acheter, rangés par étal (un magasin = un étal, dans l'ordre de l'onglet Magasins).
  « Je suis chez » ne montre que ce qu'on trouve dans ce magasin : ses articles, ceux de son type
  (ex. « Supermarché (tous) ») et ceux qui se trouvent n'importe où. Le champ du haut ajoute un article
  (dans le magasin choisi) ou en remet un connu sur la liste.
- Cocher = dans le panier. « Ranger » (ou tout seul après 12 h) enregistre l'achat et sort l'article de la liste.
- **Basiques** : ce qu'on rachète quand c'est fini. « Fini » le remet sur la liste. Avec un rythme
  (ex. toutes les 2 semaines), il revient tout seul après ce délai depuis le dernier achat.
- **Magasins** : un magasin a un ou plusieurs types (Supermarché, Brico, Jardin…) ; la couleur du type donne celle de l'auvent.
- Données : table `marche_rows` (une ligne par magasin `m:`, type `y:`, article `a:`). Réglages ⚙ → Exporter.

## Bon à savoir (Mine)

- **Mandats** : le travail pro rangé par activité (les « filons » : GDT, Isolation, Fertik, Parkour, Petits travaux,
  comme les sous-catégories Pro de la Banque). Un mandat = un chantier, un cours, une commande : son client, son état
  (Prospection, En cours, Terminé), ses tâches, ses heures, ses opérations de la Banque, ses devis et factures.
  En haut, « À faire » : paiements reçus à confirmer, factures en retard, heures pas encore facturées.
- **Heures** : chronomètre (▶ sur un mandat, ■ pour noter) ou saisie après coup (« 2:30 », « 2,5 », « 45 min ») ; vue par semaine.
- **Factures** et **Devis** : numéros `F-2026-001` et `D-2026-001`. « Facturer » reprend les heures pas encore facturées ;
  « + Matériel de la Banque » reprend les dépenses rattachées au mandat. Un devis accepté devient une facture en un geste.
  « Aperçu et PDF » → Imprimer → « Enregistrer en PDF » (A4, sans marges).
- **QR-facture** : bulletin suisse en bas de chaque facture (normes SIX, version 2.3, adresses structurées).
  Il faut ton nom, ton NPA et lieu, et ton IBAN (⚙ Réglages). Référence `RF…` tirée du numéro de facture
  (référence `QRR` si c'est une QR-IBAN). Une activité peut facturer sous un autre nom ou sur un autre IBAN.
- **Banque** : la Mine lit les opérations Pro de la Banque (table `cash_rows`) sans jamais les modifier.
  Rattacher une opération à un mandat compte ses dépenses dans le mandat ; un paiement reçu du même montant qu'une
  facture envoyée est proposé pour la marquer payée. « Bilan » → « Trier les opérations » range celles de l'année.
- **Contacts** : clients et fournisseurs ; leur adresse va sur les documents et dans la QR-facture.
- Données : table `mine_rows` (une ligne par activité `a:`, mandat `m:`, contact `c:`, heure `h:`, document `d:`,
  lien vers la Banque `l:`, réglages `s:reglages`, chrono en cours `s:chrono`). ⚙ Réglages → Exporter.
