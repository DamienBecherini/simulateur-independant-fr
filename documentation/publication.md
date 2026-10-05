# Publier une version

Les exécutables Windows, macOS et Linux sont construits par l'intégration continue (workflow [« Publication des exécutables »](../.github/workflows/publication.yml)) à chaque étiquette `vX.Y.Z` poussée sur GitHub. Le workflow prépare un **brouillon** de version : rien n'est visible du public avant sa relecture et sa publication à la main.

## Une seule source pour le numéro de version

Le numéro de version est celui de `package.json` (champ `version`), et nulle part ailleurs :

- l'interface et la démo web le reçoivent à la compilation par la constante `__APP_VERSION__` (`vite.config.ts`, lue par `src/lib/version.ts`) et l'écrivent dans les fichiers qu'elles produisent ;
- le processus principal d'Electron le lit avec `app.getVersion()` ;
- electron-builder le met dans le nom des exécutables : `Simulateur-Independant-FR-<version>-<système>-<architecture>.<extension>`.

Le workflow refuse une étiquette qui ne correspond pas à `package.json` : l'étiquette `v1.2.0` exige la version `1.2.0`.

Numérotation ([versionnage sémantique](https://semver.org/lang/fr/)) : le dernier chiffre pour une correction, celui du milieu pour une fonctionnalité, le premier pour un changement qui rend les anciens fichiers ou habitudes incompatibles. Les fichiers de simulation ont leur propre numéro de format, indépendant de la version de l'application (voir l'ADR 005).

## Marche à suivre

1. **Partir de `main` à jour**, intégration continue au vert (CI, tests de bout en bout, démo web).
2. **Changer la version**, sans créer de commit ni d'étiquette à ce stade :

   ```sh
   npm version 1.2.0 --no-git-tag-version   # met à jour package.json et package-lock.json
   ```

3. **Mettre à jour [CHANGELOG.md](../CHANGELOG.md)** : renommer la section « Non publié » en `## [1.2.0] - AAAA-MM-JJ`, ouvrir une nouvelle section « Non publié » vide au-dessus, relire les entrées (ce qui change pour l'utilisateur, pas le détail des commits).
4. **Valider et pousser** sur `main` :

   ```sh
   git commit -am "chore: Version 1.2.0"
   git push
   ```

5. **Créer et pousser l'étiquette** (par le propriétaire du dépôt) :

   ```sh
   git tag -a v1.2.0 -m "Version 1.2.0"
   git push origin v1.2.0
   ```

6. **Suivre le workflow** « Publication des exécutables » dans l'onglet Actions : vérification de la version et tests unitaires, puis construction sur les trois systèmes (une vingtaine de minutes), puis brouillon de version.
7. **Relire le brouillon** dans l'onglet Releases :
   - fichiers attendus : `…-win-x64.exe` (installateur), `…-win-x64.zip`, `…-mac-arm64.dmg`, `…-mac-x64.dmg`, `…-linux-<architecture>.AppImage`, `…-linux-<architecture>.deb` (electron-builder écrit l'architecture à la manière de chaque format, `x86_64` ou `amd64`) et `SHA256SUMS.txt` ;
   - notes générées à partir des pull requests et commits : les remplacer ou les compléter par la section du CHANGELOG ;
   - si possible, installer et lancer au moins un exécutable (voir [installation.md](./installation.md)).
8. **Publier** le brouillon (« Publish release »). Les liens de téléchargement du README pointent vers la dernière version publiée : ils fonctionnent dès cet instant.

Le workflow peut aussi être lancé à la main (« Run workflow ») : sur une branche, il construit les exécutables et les laisse en téléchargement 14 jours sur la page de l'exécution, sans brouillon de version. C'est la façon de tester un changement de configuration sans créer d'étiquette.

En cas d'échec après la création de l'étiquette : corriger, puis relancer l'exécution (« Re-run jobs ») si la correction est hors du code construit, ou supprimer l'étiquette et le brouillon, et recommencer à l'étape 4. Une nouvelle exécution pour une étiquette dont le brouillon existe remplace ses fichiers ; elle ne touche jamais une version déjà publiée.

## Ce que contiennent les exécutables

Configuration : [`electron-builder.json`](../electron-builder.json).

| Système | Fichiers | Remarques |
|---|---|---|
| Windows (x64) | installateur NSIS (`.exe`), archive `.zip` | L'installateur s'installe pour l'utilisateur courant, sans droits d'administrateur, dossier au choix. L'archive se lance sans installation. |
| macOS | image disque `.dmg` pour Apple Silicon (`arm64`) et pour Intel (`x64`) | Construites toutes deux sur un Mac Apple Silicon. Signature ad hoc seulement (voir plus bas). |
| Linux (x64) | `.AppImage`, paquet `.deb` | L'AppImage se lance sur la plupart des distributions ; le `.deb` s'installe sur Debian, Ubuntu et dérivées. |

L'application embarque seulement ce dont elle a besoin hors ligne : le processus principal compilé (`dist-electron`), l'interface compilée par Vite (`dist-react`), l'écran de démarrage et, parmi les dépendances, **zod** seul (le processus principal valide les fichiers avec). Les autres dépendances (React, Radix, Tailwind…) sont déjà incluses dans l'interface compilée ; les embarquer aussi ajoutait environ 50 Mo, dont des modules natifs de Tailwind et de Vite. Seules les traductions française et anglaise de Chromium sont gardées.

**À retenir :** si le processus principal (`src/backend`) se met à importer un nouveau paquet npm, il faut l'ajouter à la liste `files` de `electron-builder.json` (sur le modèle de `node_modules/zod/**/*`), sinon l'application packagée ne démarrera pas. Pour le vérifier, lancer l'exécutable construit par `npm run dist:win` (ou `dist:mac`, `dist:linux`).

## Construire en local

```sh
npm run dist:win     # sous Windows : installateur et zip dans dist/
npm run dist:mac     # sous macOS uniquement : images disque arm64 et x64
npm run dist:linux   # sous Linux (ou WSL) : AppImage et deb
```

Les exécutables sont écrits dans `dist/`, ignoré par Git. Les images disque macOS ne peuvent être construites que sur un Mac.

Sous Windows 11 avec le **Contrôle intelligent des applications** (Smart App Control) activé, la construction de l'installateur NSIS peut échouer (`spawn UNKNOWN`, blocage visible dans l'Observateur d'événements, journal « CodeIntegrity ») : electron-builder doit exécuter un programme non signé qu'il vient de produire, et Windows peut le bloquer. Relancer la construction suffit parfois. L'archive zip et le dossier `dist/win-unpacked` sont produits avant cette étape et restent utilisables ; l'installateur se construit normalement sur les runners de GitHub.

Si le téléchargement d'Electron échoue sur `EPERM: operation not permitted, rename … win-unpacked.tmp` (antivirus qui analyse les fichiers juste extraits), on peut construire à partir de l'Electron déjà installé dans `node_modules` : `npm run dist:win -- -c.electronDist=node_modules/electron/dist` (après `node node_modules/electron/install.js` si le dossier `dist` d'Electron est absent).

## Signature du code

Aucun exécutable n'est signé avec un certificat : Windows et macOS affichent donc un avertissement au premier lancement, expliqué aux utilisateurs dans [installation.md](./installation.md). Sur macOS, l'application reçoit une signature ad hoc (`"identity": "-"`), sans laquelle un Mac Apple Silicon refuse de l'ouvrir en la disant « endommagée ».

Pour supprimer ces avertissements, il faudrait :

- **Windows :** un certificat de signature de code (ou un service de signature, par exemple SignPath, gratuit pour certains projets libres, ou Azure Trusted Signing), fourni à electron-builder par des secrets du dépôt (`CSC_LINK`, `CSC_KEY_PASSWORD`) ;
- **macOS :** un compte Apple Developer (payant) pour signer avec un certificat « Developer ID » et faire notariser l'application par Apple.

Ces secrets ne doivent jamais être écrits dans le dépôt : ils se déclarent dans les réglages du dépôt GitHub (Settings > Secrets and variables > Actions).

## Runners et versions des systèmes

- `windows-latest` et `macos-latest` (Apple Silicon) suivent les mises à jour de GitHub sans conséquence connue sur la construction.
- La construction Linux est fixée sur `ubuntu-24.04` : `ubuntu-latest` passe à Ubuntu 26.04 le 19 octobre 2026. Les exécutables ne dépendent pas de la version du runner (Electron est livré précompilé, l'application n'a pas de module natif), mais le paquet deb est produit par fpm, téléchargé par electron-builder avec son propre interpréteur Ruby, dont la compatibilité avec un système plus récent n'est pas garantie. Pour monter de version : lancer le workflow à la main avec `ubuntu-26.04`, vérifier que l'AppImage et le deb sont produits et s'installent, puis changer la valeur dans le workflow.
- Les jobs de vérification et de brouillon restent sur `ubuntu-latest` : ils n'utilisent que Node.js et l'outil `gh`.
