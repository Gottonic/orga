# Locus — charte commune

Décidée avec Nicolas le 15.11.2026, dans la conversation ORGA. Les apps de Locus se ressemblent par la police, les formes et les pictos, qui viennent de la Forge. Chacune garde son ambiance de couleurs : c'est un lieu. En l'ouvrant, on sait où on est, mais l'ensemble paraît unifié.

Fichiers :
- `commun/lieux.css` : les polices, les couleurs de chaque lieu sous forme de jetons, l'habillage de l'en-tête commun, le style `.ic` des pictos, `.plaque` et `.eyebrow`.
- `commun/pictos.js` : les pictos au trait, utilisés par `Pictos.svg(k)` et `Pictos.plaque(k)`.
- `commun/fonts/` : Unbounded, Space Grotesk, JetBrains Mono et leurs licences.

## Polices et formes : celles de la Forge, partout
- **Titres** : Unbounded 700, larges, avec un espacement de −0,02 em.
- **Texte** : Space Grotesk, de 400 à 600.
- **Petites étiquettes** : JetBrains Mono en majuscules espacées, façon terminal (`.eyebrow`, par exemple « SAISON · 52 SEMAINES »).
- **Cartes** : très arrondies (20 px). Les boutons et les onglets sont en pilule.
- **Rendu** : pas d'ombres, des filets fins. Les hachures diagonales marquent « en pause / décharge », les pointillés marquent « provisoire ».
- **Couleur d'accent** : une seule par lieu, pour l'onglet actif, le bouton principal et la plaque des pictos. Le texte posé dessus est foncé ou clair selon le lieu (`--on-acc`).

## Pictos
- Au trait, sur une grille de 20×20, centrés. Traits de 1,8, bouts carrés, angles vifs, le moins de traits possible, plutôt abstraits.
- Ils remplacent les émojis dans l'interface : logos des apps, onglets, boutons, états.
- **Exception** : les émojis que Nicolas choisit pour ses projets et ses domaines dans l'Établi restent des émojis.
- Le logo d'une app est son picto posé sur une plaque de la couleur de l'accent du lieu, comme les séances de la Forge.
- Les logos :

| App | Picto |
|---|---|
| Locus | un cadran : cercle, carré au centre, quatre repères |
| L'Établi | un plateau et ses pieds, avec une traverse |
| La Banque | un dôme (demi-cercle plein) sur un trait |
| La Forge | la braise : deux chevrons qui montent |
| Le Marché | un bac, avec un trait au milieu |
| La Mine | une pioche |
| La Bibliothèque | trois traits verticaux et un trait en diagonale |

## Les lieux (couleurs)
Du plus sombre au plus clair : Forge, Banque, Locus, Marché, Établi, Mine. La Bibliothèque est à part, avec des murs bordeaux et des pages claires. L'accueil Locus se place au milieu pour qu'on ne passe jamais d'un coup d'un extrême à l'autre.

| Lieu | Idée | Fond | Cartes | Texte | Accent (texte dessus) | Couleurs en plus |
|---|---|---|---|---|---|---|
| Locus | lilas profond, le lieu du milieu | #4A4458 | #5A536A | #F3F1E7 | #C3B6DF (#2A2535) | — |
| La Forge | feu et acier, le vert pour contrebalancer (référence, inchangée) | #1A1714 | #25201C | #EFE3CC | #8DBA88 (#1A1714) | braise #DB754B, acier #B8B4AE, phases de la Forge |
| La Banque | lampe de banquier : vert bouteille et laiton | #15302A | #1E3E36 | #F2ECDC | #D6B15E (#1E1606) | entrée #8FCB9B, sortie #F08A8A |
| La Mine | granit clair, gris bleuté | #DCE1E6 | #F7F9FB | #1D2833 | améthyste #4E3A86 (#F6F2FF) | une pierre par état, en pastille avec texte #1E2326 : diamant #A6E8F2 (action), émeraude #6FCF97 (payé), topaze #F0C566 (à encaisser), rubis #F07A85 (en retard), améthyste #C2A8F0 (devis) |
| Le Marché | étal au soleil | céleri #D7E6C3 | cagette #F8F5EA | #1E3324 | tomate #B83C28 (#FFF5EE) | carotte #E8913A, feuille #3F7A4A |
| L'Établi | bois huilé, atelier | #CDB893 | contreplaqué #E9DDC6 | #262321 | graphite #2F2C29 (jaune mètre #F2C230) | crayon de charpentier #C2452D pour l'urgent |
| La Bibliothèque | reliure : murs bordeaux, pages claires | bordeaux #6E2733 (texte dessus #F9E9E4) | pages #F7EAE6 | encre #2E1418 | doré #E8C27A (#3A1A10) | dorure #9A6E28, liens en bordeaux #7A2E3A sur les pages |

- **En-tête** : il prend `--head`, un peu plus foncé que le fond du lieu, comme la Forge.
- **États** : `--good`, `--bad` et `--warn` sont réglés par lieu pour rester lisibles sur les cartes.
- **Contrastes** : vérifiés le 15.11. Le texte se lit au moins à 4,5:1 sur ses fonds, sauf le texte discret sur les cartes de survol de Locus, à 4,1:1.
- **Documents imprimés** (factures et devis de la Mine) : ils restent en noir sur blanc.

## Ordre d'application
1. L'accueil Locus, fait le 15.11 : `index.html`, logos de toutes les apps (`*/icons/`, `icons/`).
   - La Bibliothèque, faite le 15.11 : le contenu est une grande page claire posée sur le mur bordeaux. Les boutons d'action sont bordeaux sur les pages ; le doré sert à l'onglet actif, au bouton + flottant et aux plaques. La barre d'outils de l'éditeur est en pictos.
   - L'Établi, fait le 15.11 :
     - Le fond est en bois huilé et les cartes en contreplaqué, avec des bordures bois plus sombres plutôt que noires.
     - Les intertitres et les choix actifs sont en graphite avec le jaune du mètre. Le rouge du crayon marque l'urgent.
     - Les projets gardent leurs couleurs et leurs émojis.
     - Les pictos remplacent les émojis d'interface : petites tâches, idées, à trier, notes, échéance, congés, choix du vrac.
   - La Mine, faite le 15.11 :
     - Le fond est en granit clair, avec un léger grain.
     - Les états sont en pastilles de pierres : diamant pour en cours, émeraude pour payé, topaze pour envoyé, rubis pour en retard, améthyste pour la prospection.
     - Le diamant sert au bouton d'action et au chrono. L'améthyste sert aux choix actifs et au bouton +.
     - Les filons de couleur des activités restent.
   - La Banque, faite le 15.11 : vert bouteille et laiton. Les catégories gardent leurs couleurs, et le vert et le rouge restent pour les entrées et les sorties.
   - Le Marché, fait le 15.11 : fond céleri, cartes cagette, tomate pour l'action.
   - Les Réglages restent comme ils sont (choix de Nicolas). La Forge garde ses couleurs ; seuls les pictos de son en-tête ont changé.
2. Ensuite, pour toute nouvelle page ou app, chacune dans sa conversation ou ici : la page reçoit `data-lieu`, charge `lieux.css`, remplace ses couleurs propres par les jetons, passe ses titres en Unbounded et ses émojis d'interface en pictos. Le thème de l'ampoule (`commun/ampoule.js`, THEMES) suit.
3. La Forge garde ses couleurs. Elle peut adopter les jetons quand ça l'arrange.
