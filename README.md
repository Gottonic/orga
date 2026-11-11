# ORGA

Mes apps perso, réunies derrière un menu à tuiles. Une seule app à installer.

- Accueil : https://gottonic.github.io/orga/
- **Établi** — mes projets, semaine par semaine : https://gottonic.github.io/orga/etabli/
- **Cash** — mes finances (en construction) : https://gottonic.github.io/orga/cash/

Toutes les apps partagent la même base Supabase et la même connexion : on se connecte une fois.
Tout fonctionne hors ligne ; les changements partent dès que le réseau revient.

## Organisation du dépôt

| Dossier | Contenu |
|---|---|
| `/` | accueil ORGA (`index.html`), `manifest.webmanifest`, `sw.js` (hors ligne pour toutes les apps), icônes |
| `etabli/` | l'app Établi |
| `cash/` | l'app Cash |
| `commun/` | ce que les apps partagent : `supabase.js`, polices |
| `supabase/` | `schema.sql` (Établi), `cash.sql` (Cash) |
| `.github/workflows/` | signal deux fois par semaine pour que Supabase ne se mette pas en veille |

À chaque mise à jour du code, changer `VERSION` en haut de `sw.js`.

## Mise en route (une seule fois)

### 1. Les bases de données
Supabase → ton projet → **SQL Editor** → **New query** → coller `supabase/schema.sql` → **Run**
(déjà fait pour Établi). Puis une nouvelle requête avec `supabase/cash.sql` → **Run**.

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

## Bon à savoir (Établi)

- Le petit symbole à côté du numéro de semaine indique l'état : ✓ tout est enregistré,
  ↻ envoi en cours, « hors ligne », ⚠ problème (toucher pour les détails).
- Toucher ce symbole permet aussi d'**exporter toutes tes données** dans un fichier.
- GitHub arrête les signaux de réveil après 60 jours sans aucune modification du dépôt :
  il suffit alors de relancer l'action à la main (onglet **Actions**).
