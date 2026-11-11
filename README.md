# ORGA

Mes apps perso, réunies derrière un menu à tuiles. Une seule app à installer.

- Accueil : https://gottonic.github.io/orga/
- **Établi** — mes projets, semaine par semaine : https://gottonic.github.io/orga/etabli/
- **Banque** — mes comptes et mes dépenses (ex-« Cash ») : https://gottonic.github.io/orga/banque/
- **Forge** — mon entraînement parkour (ex-« Carnet ») : https://gottonic.github.io/orga/forge/

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
| `commun/` | ce que les apps partagent : `supabase.js`, `ampoule.js` (bugs et idées), polices |
| `supabase/` | `schema.sql` (Établi), `cash.sql` (Banque : la table s'appelle `cash_rows`), `carnet.sql` (Forge : la table garde l'ancien nom `carnet`), `idees.sql` (l'ampoule 💡, pour toutes les apps) |
| `.github/workflows/` | signal deux fois par semaine pour que Supabase ne se mette pas en veille |

À chaque mise à jour du code, changer `VERSION` en haut de `sw.js`.

## Mise en route (une seule fois)

### 1. Les bases de données
Supabase → ton projet → **SQL Editor** → **New query** → coller `supabase/schema.sql` → **Run**
(déjà fait pour Établi). Puis une nouvelle requête avec `supabase/cash.sql` → **Run** : le résultat doit être « cash_rows prête ».
Puis `supabase/idees.sql` → **Run** : le résultat doit être « idees prête ».

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

## L'ampoule 💡 (toutes les apps)

- Dans chaque app et sur l'accueil, le bouton 💡 ouvre « Bugs et idées », comme dans l'app Gamins de Talus :
  choisir 🐞 Bug ou 💡 Idée, écrire le titre, « + » (détails facultatifs). Cocher = fait, la ligne quitte la liste.
- Chaque app a sa propre liste. Sur l'accueil : la liste d'ORGA (menu, liens entre apps…) et « Toutes les apps ».
- « Copier pour Claude » copie la liste en texte, à coller dans la conversation de l'app.
- On peut noter hors ligne : l'envoi se fait dès que le réseau revient.
- Données : table `idees` (une ligne par idée, colonne `app`), même connexion que les apps.
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
