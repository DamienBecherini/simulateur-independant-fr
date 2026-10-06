# ADR-012: Démo web installable et utilisable hors ligne

- **Date :** 2026-10-06
- **Statut :** Accepté

## Contexte

L'application de bureau n'est pas signée. Sous Windows 11, le Contrôle intelligent des applications la bloque sans proposer de la lancer quand même. La démo web (GitHub Pages, `/simulateur-independant-fr/`) offre la même interface, avec le moteur de calcul dans la page : il lui manque d'être installable (fenêtre propre, icône dans le menu Démarrer) et de fonctionner hors ligne, comme l'application de bureau.

Contraintes : la CI installe les dépendances sans scripts d'installation (`npm ci --ignore-scripts`) ; la page a une politique de sécurité du contenu stricte (`script-src 'self'`) ; l'application Electron ne doit pas changer.

## Décision

### Un service worker écrit à la main, pas vite-plugin-pwa

`vite-plugin-pwa` s'appuie sur Workbox (`workbox-build`), soit plusieurs dizaines de paquets de plus (Babel, Rollup et ses extensions, Terser…) pour la compilation, dont des versions à suivre au rythme de Vite. Le besoin est petit : mettre en cache une liste fixe de fichiers publiés, les servir, et annoncer une nouvelle version. Il tient en une soixantaine de lignes, sans dépendance de plus : esbuild, déjà figé pour le serveur MCP (ADR 011), compile le service worker.

- `src/web/pwa/manifeste.ts` : le manifeste (nom, `lang: fr`, `start_url` et `scope` à l'adresse de publication, `display: standalone`, couleurs du thème clair), les balises de `index.html` (manifeste, icône d'iOS, `theme-color` clair et sombre) et la liste des fichiers à mettre en cache. Fonctions pures, testées.
- `src/web/pwa/strategie.ts` : nom du cache par version, caches périmés, et réponse à chaque requête. Fonctions pures, testées.
- `src/web/pwa/service-worker.ts` : les événements `install`, `activate`, `fetch` et `message`, vérifiés par les tests de bout en bout.
- `vite-plugin-demo-installable.ts`, branché par `vite.config.ts` en mode `web` seulement : il ajoute les balises à `index.html`, puis, une fois `dist-web` écrit, y copie les icônes (`src/web/pwa/icones/`, tirées de `templateIcon.png`, ordinaires et masquables, en 192 et 512 px), écrit `manifest.webmanifest`, et compile `sw.js` avec la liste de **tous les fichiers publiés** (sauf `sw.js`, les cartes de sources et `retours.json`, le badge du README) et une version tirée de leur contenu.

### Stratégie de cache

- À l'installation, tous les fichiers de la publication sont mis en cache (page, scripts, styles, polices Inter, icônes, manifeste), redemandés au serveur sans passer par le cache HTTP du navigateur.
- Les fichiers de la démo sont servis depuis le cache ; toute ouverture d'une adresse de la démo reçoit la page en cache. Le reste (autres sites, autres méthodes que GET, `retours.json`) va au réseau. Un fichier manquant au cache est redemandé au réseau.
- Une nouvelle publication change `sw.js` : le navigateur installe la nouvelle version à côté de l'ancienne, qui continue de servir les fenêtres ouvertes avec ses propres fichiers (jamais de mélange de deux publications). La nouvelle prend la main à l'ouverture suivante, sans rien demander ; en attendant, une notification (sonner) « Nouvelle version disponible » propose « Recharger », qui l'active aussitôt. À l'activation, les caches des versions précédentes sont effacés.
- À la première visite, la version installée prend aussitôt en charge la page (`clients.claim`) : la démo fonctionne hors ligne sans rechargement.

### Installation et données

- L'installation se découvre sans fenêtre qui s'ouvre d'elle-même : le bandeau de la démo porte la ligne « Installer le simulateur sur votre ordinateur : il fonctionne hors ligne, sans compte » et un bouton « Comment faire ? » ; le panneau des paramètres, un bouton « Installer le simulateur ». Tous deux ouvrent la même aide (`src/web/AideALInstallation.tsx`), qui s'adapte au navigateur :
  - Edge, Chrome et les autres navigateurs Chromium (ou tout navigateur qui envoie `beforeinstallprompt`) : les avantages, un bouton « Installer maintenant » qui rejoue l'événement `beforeinstallprompt` gardé dès le démarrage (remplacé par une explication tant que le navigateur ne l'a pas envoyé), puis les étapes à la main, avec deux captures d'Edge (WebP, importées par le seul code de la démo ; un petit plugin de `vite-plugin-demo-installable.ts` les écarte de la compilation de l'application de bureau) ;
  - Firefox, Safari et les navigateurs d'iPhone : ouvrir la démo dans Edge ou Chrome, ou télécharger l'application de bureau.
- Démo déjà installée (`display-mode: standalone`, `navigator.standalone` sur iPhone, ou événement `appinstalled` dans l'onglet) : ni la ligne du bandeau ni le bouton des paramètres n'apparaissent. Rien de tout cela n'existe dans l'application de bureau.
- `navigator.storage.persist()` est demandé une fois par visite, à la première sauvegarde nommée et à l'installation, pour que le navigateur n'efface pas de lui-même les données (localStorage) quand l'espace manque. Chrome et Edge l'accordent sans rien demander, selon l'usage du site ; Firefox demande l'autorisation.
- La politique de sécurité du contenu reste stricte ; `worker-src 'self'` et `manifest-src 'self'` y sont écrits pour être explicites (déjà couverts par `default-src 'self'`).

### Tests

- Tests unitaires du manifeste, de la stratégie, de l'enregistrement (proposition de mise à jour) et de l'installation.
- `e2e-web/installable.web.ts` : manifeste et icônes servis, aucune erreur d'installabilité relevée par Chromium (`Page.getAppManifest`, `Page.getInstallabilityErrors` par le protocole DevTools), puis réouverture et calcul de la simulation d'exemple **hors ligne** (`context.setOffline(true)`).
- `e2e-web/aide-installation.web.ts` : la ligne du bandeau et l'aide (Chromium, Firefox imité), « Installer maintenant » avec une invitation imitée, la démo déjà installée, l'accessibilité en thèmes clair et sombre, et la largeur d'un téléphone avec les deux polices.
- Partout ailleurs, `playwright.web.config.ts` bloque les service workers (`serviceWorkers: "block"`) : sinon, les fichiers seraient servis depuis le cache, hors de portée de `page.route`, et chaque test remplirait un cache.

## Conséquences

- **Positives :**
  - Sous Windows, la démo installée depuis Edge remplace l'application de bureau bloquée, sans signature payante, hors ligne comme elle.
  - Aucune dépendance de plus ; tout le code du hors-ligne est lisible et testé dans le dépôt.
  - L'application de bureau est inchangée (plugin et enregistrement du service worker limités au mode `web`).
- **Négatives ou Compromis :**
  - Les données restent dans le stockage du navigateur, pour ce profil seulement : un effacement des données du site les supprime, d'où le rappel d'exporter ses simulations. Le serveur MCP local n'existe pas dans la démo.
  - Le cache contient toute la publication (environ 1,5 Mo), téléchargée en une fois à la première visite, y compris quand on ne l'installe pas.
  - Une mise à jour n'est vue qu'à l'ouverture suivante, ou après « Recharger ». Pas de vérification périodique : le navigateur cherche une nouvelle version de `sw.js` à chaque ouverture de la démo.
  - Le service worker n'est pas couvert par les tests unitaires : sa logique est extraite en fonctions pures, le reste est vérifié dans Chromium.
