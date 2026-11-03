# Délégataires des aides à la pierre

Carte de France (Plan IGN, zoom jusqu'à la rue). Une adresse saisie ou un clic droit (appui long sur mobile) sur la carte ouvre une barre latérale. Elle indique si le point est couvert par un délégataire des aides à la pierre listé en colonne A du classeur Google, et affiche alors les autres colonnes de sa ligne.

## Comment la réponse est trouvée

1. Le point cliqué est situé dans sa commune, son intercommunalité (EPCI) et son département, d'après le découpage administratif de l'IGN (ADMIN EXPRESS, Géoplateforme).
2. Règle de décision, dans cet ordre :
   - **Oui, délégataire intercommunal** : l'intercommunalité figure en colonne A (SIREN identique si une colonne « SIREN » existe, sinon même nom sans les mots génériques ; un nom seulement approché s'affiche « Oui ? », à vérifier) ;
   - **Non, DDT / DDTM** : sinon, la DDT ou DDTM du département figure en colonne A (par son nom ou son numéro, « DDT 26 ») ;
   - **Oui, département** : sinon (pas de DDT, ou DDT avec « Non » en colonne B), c'est forcément le département ; sa ligne « Conseil départemental … » est affichée si elle existe.
3. Une ligne avec « Non » en colonne B n'est jamais retenue comme délégataire ni comme DDT.

En plus, au même niveau :
- **Île-de-France** (région 11) : les marges sont gérées par la **DRIHL** ;
- **Profil Prestaterre** du lieu : Profil CUD (CU de Dunkerque), Profil Lyon Métropole, Profil MEL, Profil Métropole Nice Côte d’Azur (par SIREN de l’EPCI), Profil Ville de Paris (commune 75056). Les profils de maîtres d’ouvrage (Care Promotion, CDC Habitat, Futurhable) ne dépendent pas du lieu. Liste dans `match.js` (`PROFILES`).

La barre affiche toujours la commune, l'intercommunalité et le département trouvés, pour vérification.

## Sécurité (même principe que l'Observatoire)

Le classeur reste **privé**. Un script Google Apps Script installé dans le classeur sert de pont :

- il ne transmet les données qu'au site déclaré (`PIERRE_ALLOWED_ORIGINS`) ;
- il vérifie la clé d'accès à chaque requête (`PIERRE_ACCESS_KEY`, 16 caractères minimum) et bloque les essais répétés ;
- la clé est saisie sur le site, gardée en mémoire de l'onglet seulement, jamais dans une URL ni dans le navigateur.

## Installation du pont (une seule fois)

1. Ouvrir le classeur → **Extensions › Apps Script**, coller le contenu de `apps-script/Code.gs`, enregistrer.
2. **Paramètres du projet › Propriétés du script** :
   - `PIERRE_ALLOWED_ORIGINS` = `https://cedriccovarel.github.io`
   - `PIERRE_SHEET_GID` = le nombre après `gid=` dans l'URL de l'onglet (par défaut `1819788546`).
3. Dans l'éditeur, exécuter `genererCleAcces` (accepter les autorisations), puis lire la clé dans les propriétés du script.
4. Exécuter `configurerSecurite` : le journal indique l'onglet trouvé et le nombre de délégataires.
5. **Déployer › Nouveau déploiement › Application Web** : exécuter en tant que **moi**, accès **Tout le monde**. Copier l'URL `…/exec`.
6. Mettre cette URL dans `config.js` (`EXEC_URL`). Elle ne donne accès à rien sans la clé.

Après une modification de `Code.gs` : **Déployer › Gérer les déploiements › Modifier › Nouvelle version** (l'URL reste la même).

## Développement

- Site statique, sans build : `index.html`, `app.js`, `match.js`, `bridge.js`, `styles.css`.
- Tests : `node test_match.mjs`.
- Test local : `python3 -m http.server 8000 --bind 127.0.0.1`. Pour lire le classeur depuis le poste, ajouter `http://127.0.0.1:8000` à `PIERRE_ALLOWED_ORIGINS`.
