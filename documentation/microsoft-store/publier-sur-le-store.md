# Publier sur le Microsoft Store

Marche à suivre pour distribuer l'application de bureau Windows par le Microsoft Store. Le Store signe le paquet : l'application passe le Contrôle intelligent des applications (Smart App Control) et SmartScreen sans certificat de signature à acheter. L'installateur NSIS et l'archive zip de GitHub ne changent pas.

Ce qui est déjà prêt dans le dépôt :

- la cible `appx` d'electron-builder (`electron-builder.json`, section `appx`) : nom affiché, langue `fr-FR`, Windows 10 version 1809 au minimum, alias d'exécution pour le serveur MCP ;
- les images du paquet (`build/appx/`, tuiles et icônes à toutes les échelles) et les logos de la fiche (`documentation/microsoft-store/logos/`), générés par `scripts/generer-images-store.ps1` ;
- la construction : `npm run dist:store` en local, et le workflow [« Paquet du Microsoft Store »](../../.github/workflows/store.yml) dans GitHub Actions ;
- les textes de la fiche, les réponses au questionnaire d'âge, la justification de `runFullTrust` et les notes pour la certification : [fiche-du-store.md](./fiche-du-store.md) ;
- les captures d'écran : [captures/](./captures/) ;
- le serveur MCP adapté au paquet ([ADR 012](../adr/012-serveur-mcp-dans-la-version-du-microsoft-store.md)), **à essayer avant la première soumission** (étape 2).

Il reste à faire, par le propriétaire du compte : créer le compte développeur, réserver le nom, recopier l'identité du paquet, essayer le paquet, et faire la première soumission. Les étapes ci-dessous suivent cet ordre.

## 1. Compte développeur et identité du paquet

### Créer le compte « entreprise »

1. Aller sur **https://storedeveloper.microsoft.com** (et pas directement sur Partner Center ni depuis Visual Studio, qui mènent encore à l'ancien parcours). L'inscription est gratuite.
2. Choisir un compte **entreprise** (« Company »). C'est le type prévu pour les indépendants qui publient dans le cadre de leur activité professionnelle (politique 10.14 du Store) ; un compte individuel ne peut pas devenir un compte entreprise ensuite.
3. Se connecter avec un compte Microsoft, puis donner :
   - une **adresse e-mail sur le domaine de l'entreprise** : `damien@becherini.fr` ;
   - le nom légal de l'entreprise individuelle et son adresse, tels qu'ils figurent au répertoire SIRENE ;
   - un justificatif : numéro **DUNS** s'il existe, sinon un document officiel récent, par exemple l'**avis de situation au répertoire SIRENE** (téléchargeable sur avis-situation-sirene.insee.fr) ou un extrait du RNE de moins de trois mois ;
   - la **vérification d'identité** demandée (pièce d'identité et photo).
4. Attendre la vérification de l'entreprise : 2 à 5 jours ouvrés, revue manuelle. Partner Center l'affiche dans Paramètres du compte > Profil légal.

**À trancher avant de publier :** les [mentions légales](../mentions-legales.md) disent que le simulateur est édité « à titre personnel et non professionnel ». Avec un compte entreprise, l'éditeur affiché par le Store sera l'entreprise : mettre ce passage en accord (texte dans `src/lib/mentions-legales.ts`, puis `npm run mentions-legales`), puisque cette page sert de politique de confidentialité au Store.

### Réserver le nom

1. Dans Partner Center, **Applications et jeux** > **Nouveau produit** > **Application MSIX ou PWA**.
2. Réserver le nom **Simulateur Indépendant FR** (le nom doit être unique dans le Store ; il est réservé trois mois sans soumission).

### Recopier l'identité du paquet

1. Dans l'application créée : **Gestion des produits** > **Identité du produit** (Product identity).
2. Recopier les trois valeurs dans [`build/store/identite.json`](../../build/store/identite.json), à la place des `A_REMPLIR` :

   | Partner Center | `identite.json` | Exemple de forme |
   |---|---|---|
   | Package/Identity/Name | `identityName` | `12345DamienBecherini.SimulateurIndependantFR` |
   | Package/Identity/Publisher | `publisher` | `CN=0A1B2C3D-…` (tout, avec `CN=`) |
   | Package/Properties/PublisherDisplayName | `publisherDisplayName` | `Damien Becherini` |

   Rien de tout cela n'est secret : c'est écrit dans le manifeste de tout paquet publié.
3. Noter aussi, pour plus tard, l'**ID Store** (12 caractères, par exemple `9N…`, qui donne le lien `https://apps.microsoft.com/detail/<ID Store>`) et le **nom de famille du paquet** (Package Family Name, `…_xxxxxxxxxxxxx`).
4. Vérifier, puis valider sur une branche et fusionner comme tout autre changement (`integration`, puis `main`) :

   ```sh
   node scripts/construire-paquet-store.mjs --verifier   # « Identité du paquet : … »
   npx vitest run --project scripts                      # vérifie aussi le format de l'identité
   git commit -am "build: Identité du paquet du Microsoft Store"
   ```

## 2. Essayer le paquet avant la première soumission

Le serveur MCP sous MSIX n'a pas encore été essayé sur un paquet installé ([ADR 012](../adr/012-serveur-mcp-dans-la-version-du-microsoft-store.md#à-vérifier)). L'essai demande d'installer le paquet non signé, donc le **mode développeur** de Windows (à désactiver ensuite).

1. **Construire le paquet** : GitHub > Actions > « Paquet du Microsoft Store » > **Run workflow** sur `main` (cocher « essai » si l'identité n'est pas encore remplie). Télécharger l'artefact `paquet-microsoft-store` (un zip qui contient le `.appx`). En local, sous Windows : `npm run dist:store` (ou `npm run dist:store -- --essai`), paquet dans `dist/`.
2. **Activer le mode développeur** : Paramètres > Système > Espace développeurs (Pour les développeurs) > Mode développeur : activé.
3. **Installer le paquet** depuis son contenu décompressé (PowerShell) :

   ```powershell
   $paquet = "$HOME\Downloads\Simulateur-Independant-FR-0.9.0-store-x64.appx"   # adapter le nom
   $dossier = "$HOME\Downloads\essai-store"
   Copy-Item $paquet "$env:TEMP\paquet-store.zip"
   Expand-Archive "$env:TEMP\paquet-store.zip" $dossier -Force
   Add-AppxPackage -Register "$dossier\AppxManifest.xml"
   Get-AppxPackage *SimulateurIndependantFR*   # nom de famille du paquet (PackageFamilyName)
   ```

   Si `Add-AppxPackage` refuse le dossier à cause de `AppxBlockMap.xml` ou de `[Content_Types].xml` (fichiers propres au paquet compressé), supprimer ces deux fichiers du dossier et relancer la dernière commande.

4. **Essayer l'application** : la lancer depuis le menu Démarrer (« Simulateur Indépendant FR »). La fenêtre s'ouvre, les résultats s'affichent, une simulation modifiée est retrouvée au lancement suivant, les exports (CSV, PDF) s'enregistrent là où on le demande.
5. **Essayer le serveur MCP** :
   - dans l'application : Paramètres > « Utiliser avec une IA (MCP) ». La configuration doit commencer par `…\AppData\Local\Microsoft\WindowsApps\simulateur-independant-fr.exe`, et la fenêtre doit afficher le paragraphe « Version du Microsoft Store » ;
   - la commande de vérification (même fenêtre), dans PowerShell, doit écrire « Serveur MCP du simulateur … prêt » (Ctrl+C pour l'arrêter) ;
   - la copie du serveur doit exister dans le dossier redirigé : `dir "$env:LOCALAPPDATA\Packages\<nom de famille du paquet>\LocalCache\Roaming\simulateur-independant-fr\mcp"` ;
   - dans Claude Desktop : coller la configuration (voir [utiliser-avec-une-ia.md](../utiliser-avec-une-ia.md)), quitter complètement Claude Desktop et le relancer. Les outils du simulateur apparaissent ; demander « Décris ma simulation » (le serveur lit la session de l'application), puis une proposition d'ajout : la fenêtre « Proposition de votre IA » doit s'ouvrir dans l'application.
   - En cas d'échec : journal de Claude Desktop `%APPDATA%\Claude\logs\mcp-server-simulateur-independant-fr.log`. Les solutions de repli sont décrites dans l'ADR 012.
6. **Désinstaller et nettoyer** :

   ```powershell
   Get-AppxPackage *SimulateurIndependantFR* | Remove-AppxPackage
   Remove-Item -Recurse $dossier, "$env:TEMP\paquet-store.zip"
   ```

   puis désactiver le mode développeur. Retirer aussi l'entrée `simulateur-independant-fr` de la configuration de Claude Desktop si elle ne sert plus.

Facultatif : le **Windows App Certification Kit** (dans le SDK Windows : `winget install Microsoft.WindowsSDK.10.0.26100`, puis « Windows App Cert Kit ») fait en local les contrôles automatiques de la certification.

## 3. Première soumission

1. **Construire le paquet à publier** : l'identité remplie et fusionnée dans `main`, lancer le workflow « Paquet du Microsoft Store » sur `main` (sans « essai »), ou pousser l'étiquette de la version (`vX.Y.Z`, voir [publication.md](../publication.md)) : le workflow se lance aussi sur les étiquettes. Télécharger l'artefact `paquet-microsoft-store` et le décompresser : `Simulateur-Independant-FR-X.Y.Z-store-x64.appx`.
2. Dans Partner Center, sur l'application : **Démarrer la soumission**, puis remplir chaque partie.
   - **Tarification et disponibilité** : marchés **France** (recommandé : les règles simulées sont françaises ; d'autres marchés peuvent s'ajouter plus tard), visibilité **publique**, prix **gratuit**, pas de version d'évaluation. Date de publication : « Publier manuellement après la certification », pour garder la main sur la date.
   - **Propriétés** : catégorie **Entreprise**, sous-catégorie **Comptabilité et finances** (voir la fiche). URL de la politique de confidentialité, site web et contact du support : [fiche-du-store.md](./fiche-du-store.md#identité-de-la-fiche). Configuration requise : clavier et souris ; Windows 10 version 1809 ou suivante, x64 (déjà dans le paquet).
   - **Classifications par âge** : remplir le questionnaire IARC avec les réponses de la fiche (application, pas un jeu ; classification attendue 3+).
   - **Packages** : déposer le `.appx`. Familles d'appareils : Windows 10/11 **Bureau** seulement. Partner Center lit l'identité dans le paquet et refuse un paquet dont l'identité ne correspond pas à la réservation (c'est le cas du paquet d'essai). Il demande la justification de la capacité restreinte **runFullTrust** : texte dans la fiche.
   - **Fiche du Store** (français (France)) : description, description courte, nouveautés, fonctionnalités, mots-clés, captures (`captures/*.png`, avec leurs légendes), logo carré (`logos/icone-300x300.png`), copyright, conditions de licence supplémentaires : tout est dans [fiche-du-store.md](./fiche-du-store.md).
   - **Options de soumission** : coller les **notes pour la certification** de la fiche.
3. **Soumettre pour certification.** Compter quelques heures à trois jours ouvrés. En cas de refus, le rapport de certification dit quoi corriger ; corriger, reconstruire si besoin (même version : le Store accepte un nouveau paquet tant que la soumission n'est pas publiée), et resoumettre.
4. Une fois certifiée : **Publier maintenant** (si la publication manuelle a été choisie). La fiche est en ligne sous `https://apps.microsoft.com/detail/<ID Store>`, en général dans l'heure.
5. Ensuite, dans le dépôt : ajouter le lien du Store au README, à [installation.md](../installation.md) (le Store comme moyen recommandé sous Windows) et à la page de la démo web ; mentionner la version du Store dans [utiliser-avec-une-ia.md](../utiliser-avec-une-ia.md) si l'essai de l'étape 2 a demandé des ajustements.

## 4. Mises à jour

Le Store met l'application à jour tout seul chez les utilisateurs. Pour chaque nouvelle version :

1. Suivre [publication.md](../publication.md) : numéro de version dans `package.json`, CHANGELOG, étiquette `vX.Y.Z`. Le Store exige un numéro **plus grand** que celui du paquet déjà publié ; le paquet porte `X.Y.Z.0` (le quatrième nombre est réservé au Store).
2. L'étiquette lance les deux workflows : « Publication des exécutables » (brouillon de version GitHub) et « Paquet du Microsoft Store » (artefact `paquet-microsoft-store`, gardé 30 jours ; il n'est pas joint à la version GitHub, puisqu'il ne s'installe pas hors du Store).
3. Partner Center > l'application > **Mettre à jour** (nouvelle soumission, qui reprend la précédente) > **Packages** : retirer l'ancien paquet, déposer le nouveau ; **Fiche du Store** : mettre à jour « Nouveautés » ; soumettre.

### Automatiser l'envoi (facultatif, après la première publication)

Microsoft fournit une action GitHub et un outil en ligne de commande (`msstore`) pour soumettre une mise à jour depuis le workflow, sans passer par l'interface de Partner Center ([Publish app updates with GitHub Actions](https://learn.microsoft.com/en-us/windows/apps/publish/msstore-dev-cli/github-actions)). Cela ne fonctionne **qu'une fois l'application publiée** une première fois à la main.

À préparer, par le propriétaire du compte :

1. Partner Center > Paramètres du compte > **Gestion des utilisateurs** > **Applications Microsoft Entra** : créer (ou ajouter) une application Entra ID, lui donner le rôle **Gestionnaire** (Manager), puis lui créer une **clé** (secret client, à durée limitée : noter sa date d'expiration).
2. Déclarer dans le dépôt GitHub (Settings > Secrets and variables > Actions), **jamais dans les fichiers du dépôt** :

   | Secret | D'où vient la valeur |
   |---|---|
   | `PARTNER_CENTER_TENANT_ID` | ID de locataire (tenant) de l'annuaire Entra ID : page de l'application Entra dans Partner Center, ou Paramètres du compte > Locataires |
   | `PARTNER_CENTER_CLIENT_ID` | ID client (application) de l'application Entra créée à l'étape 1 |
   | `PARTNER_CENTER_CLIENT_SECRET` | la clé créée à l'étape 1 (visible une seule fois) |
   | `PARTNER_CENTER_SELLER_ID` | Paramètres du compte > Informations légales > Développeur > **ID du vendeur** (Seller ID) |

   L'**ID Store** de l'application n'est pas un secret : il peut aller dans une variable (`vars.STORE_PRODUCT_ID`).
3. Ajouter au workflow `store.yml`, après « Conserver le paquet », des étapes sur le modèle de la documentation de Microsoft (en épinglant l'action par son empreinte de commit, comme les autres, et en vérifiant les options de `msstore` sur cette page au moment de le faire) :

   ```yaml
   - name: Installer l'outil msstore
     if: github.ref_type == 'tag'
     uses: microsoft/microsoft-store-apppublisher@<empreinte> # v1.1
   - name: Soumettre la mise à jour au Store
     if: github.ref_type == 'tag'
     shell: bash
     run: |
       msstore reconfigure --tenantId "${{ secrets.PARTNER_CENTER_TENANT_ID }}" --sellerId "${{ secrets.PARTNER_CENTER_SELLER_ID }}" \
         --clientId "${{ secrets.PARTNER_CENTER_CLIENT_ID }}" --clientSecret "${{ secrets.PARTNER_CENTER_CLIENT_SECRET }}"
       msstore publish dist/*.appx -id "${{ vars.STORE_PRODUCT_ID }}"
   ```

   La soumission ainsi créée passe la certification comme les autres ; « Nouveautés » reste à mettre à jour dans Partner Center si on le souhaite.

## Construire en local

Sous Windows seulement (electron-builder télécharge lui-même `makeappx` et `makepri` ; le SDK Windows n'est pas nécessaire) :

```sh
npm run dist:store              # paquet à publier : identité remplie dans build/store/identite.json
npm run dist:store -- --essai   # paquet d'essai, identité fictive, refusé par le Store
```

Le paquet est écrit dans `dist/` : `Simulateur-Independant-FR-<version>-store-x64.appx` (ou `…-store-essai-x64.appx`). Il n'est pas signé : seul le Store le signe. L'identité peut aussi venir des variables d'environnement `STORE_IDENTITY_NAME`, `STORE_PUBLISHER` et `STORE_PUBLISHER_DISPLAY_NAME`.

Sur un poste sans mode développeur ni droits d'administrateur, electron-builder signale en décompressant ses outils qu'il ne peut pas créer deux liens symboliques (« Cannot create symbolic link », fichiers macOS inutiles ici) : l'avertissement est sans effet, le paquet est construit.

Les images de `build/appx/` et de `logos/` se régénèrent depuis l'icône de l'application si elle change : `powershell -ExecutionPolicy Bypass -File scripts/generer-images-store.ps1`. Les captures d'écran : `npm run captures`.
