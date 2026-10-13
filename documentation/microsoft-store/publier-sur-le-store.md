# Publier sur le Microsoft Store

Marche à suivre pour distribuer l'application de bureau Windows par le Microsoft Store. Le Store signe le paquet : l'application passe le Contrôle intelligent des applications (Smart App Control) et SmartScreen sans certificat de signature à acheter. L'installateur NSIS et l'archive zip de GitHub ne changent pas.

Ce qui est déjà prêt dans le dépôt :

- la cible `appx` d'electron-builder (`electron-builder.json`, section `appx`) : nom affiché, langue `fr-FR`, Windows 10 version 1809 au minimum, alias d'exécution pour le serveur MCP ;
- les images du paquet (`build/appx/`, tuiles et icônes à toutes les échelles) et les logos de la fiche (`documentation/microsoft-store/logos/`), générés par `scripts/generer-images-store.ps1` ;
- la construction : `npm run dist:store` en local, et le workflow [« Paquet du Microsoft Store »](../../.github/workflows/store.yml) dans GitHub Actions ;
- les textes de la fiche, les réponses au questionnaire d'âge, la justification de `runFullTrust` et les notes pour la certification : [fiche-du-store.md](./fiche-du-store.md) ;
- les captures d'écran : [captures/](./captures/) ;
- le serveur MCP adapté au paquet ([ADR 013](../adr/013-serveur-mcp-dans-la-version-du-microsoft-store.md)), **à essayer avant la première soumission** (étape 2, `npm run essai:store`).

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
4. Attendre la vérification de l'entreprise : 2 à 5 jours ouvrés, revue manuelle. Partner Center l'affiche dans Account settings > Legal info.

**Mentions légales :** les [mentions légales](../mentions-legales.md) nomment l'éditeur comme l'entreprise individuelle qui détient le compte (SIREN, RCS et SIRET), puisque cette page sert de politique de confidentialité au Store. Si ces informations changent, modifier le texte dans `src/lib/mentions-legales.ts`, puis lancer `npm run mentions-legales`.

### Réserver le nom

1. Dans Partner Center, **Apps and games** > **New product** > **MSIX or PWA app**.
2. Réserver le nom **Simulateur Indépendant FR** (le nom doit être unique dans le Store ; il est réservé trois mois sans soumission).

### Recopier l'identité du paquet

1. Dans l'application créée : **Product management** > **Product Identity**.
2. Recopier les trois valeurs dans [`build/store/identite.json`](../../build/store/identite.json), à la place des `A_REMPLIR` :

   | Partner Center | `identite.json` | Exemple de forme |
   |---|---|---|
   | Package/Identity/Name | `identityName` | `12345DamienBecherini.SimulateurIndependantFR` |
   | Package/Identity/Publisher | `publisher` | `CN=0A1B2C3D-…` (tout, avec `CN=`) |
   | Package/Properties/PublisherDisplayName | `publisherDisplayName` | `Damien Becherini` |

   Rien de tout cela n'est secret : c'est écrit dans le manifeste de tout paquet publié.
   Valeurs recopiées le 2026-10-11 : `DamienBECHERINI.SimulateurIndpendantFR` (Partner Center a retiré le « é » du nom réservé : c'est bien la valeur à garder), `CN=82BAFE86-DEBC-4123-9C53-FF6F4E086825`, `Damien BECHERINI`. Nom de famille du paquet : `DamienBECHERINI.SimulateurIndpendantFR_r47q8w9e2mv8c` (dossier `%LOCALAPPDATA%\Packages\<nom de famille du paquet>` de l'étape 2).
3. Noter aussi, pour plus tard, l'**ID Store** (12 caractères, par exemple `9N…`, qui donne le lien `https://apps.microsoft.com/detail/<ID Store>`) et le **nom de famille du paquet** (Package Family Name, `…_xxxxxxxxxxxxx`).
4. Vérifier, puis valider sur une branche et fusionner comme tout autre changement (`integration`, puis `main`) :

   ```sh
   node scripts/construire-paquet-store.mjs --verifier   # « Identité du paquet : … »
   npx vitest run --project scripts                      # vérifie aussi le format de l'identité
   git commit -am "build: Identité du paquet du Microsoft Store"
   ```

## 2. Essayer le paquet avant la première soumission

Le serveur MCP sous MSIX doit être essayé sur un paquet installé ([ADR 013](../adr/013-serveur-mcp-dans-la-version-du-microsoft-store.md#vérifications)). Le paquet n'est pas signé (c'est le Store qui le signe) ; pour l'essayer, on en signe une **copie** avec un certificat d'essai, au nom de l'éditeur du paquet, et on l'installe comme le Store le ferait. `npm run essai:store` fait tout cela, sous Windows ; la marche à suivre à la main, vérifiée le 2026-10-12, est en annexe ([Sans le script](#annexe--essayer-le-paquet-sans-le-script)).

**Pourquoi pas le mode développeur ?** La méthode qui consiste à décompresser le `.appx` (`Expand-Archive`) puis à l'enregistrer avec `Add-AppxPackage -Register` ne convient pas :

- dans un `.appx`, les noms de fichiers sont encodés comme des adresses web : `Expand-Archive` garde `app\Simulateur%20Ind%C3%A9pendant%20FR.exe`, alors que le manifeste attend `app\Simulateur Indépendant FR.exe`, et l'application ne démarre pas sans renommage ;
- surtout, Electron ne met `process.windowsStore` à vrai que si l'exécutable se trouve sous `C:\Program Files\WindowsApps`. Un paquet enregistré depuis un autre dossier s'affiche comme la version classique : la fenêtre « Utiliser avec une IA (MCP) » n'a pas le paragraphe « Version du Microsoft Store », et la configuration pointe vers le dossier décompressé. L'essai ne vérifierait pas ce que verront les utilisateurs.

Avec un paquet signé par un certificat approuvé, le mode développeur de Windows n'est pas nécessaire.

> **Sécurité.** Tant que le certificat d'essai est approuvé par le PC (`Cert:\LocalMachine\TrustedPeople`), Windows fait confiance à **tout** ce que ce certificat signe, pas seulement au paquet du simulateur : sa clé privée reste dans le magasin de l'utilisateur, sans fichier `.pfx` ni mot de passe, mais un programme lancé sous ce compte pourrait s'en servir. Finir chaque essai par `npm run essai:store -- nettoyer`.

### Installer : `npm run essai:store`

Avant de commencer : la démo web installée comme application avec Edge porte le même nom dans le menu Démarrer ; la désinstaller (`edge://apps`) ou savoir la distinguer (son éditeur est « Microsoft Edge »). Si la version du Store elle-même est installée, la désinstaller : le script refuse d'y toucher.

```powershell
npm run essai:store                                    # construit le paquet, puis l'installe
npm run essai:store -- --paquet "$HOME\Downloads\paquet-store\Simulateur-Independant-FR-0.11.0-store-x64.appx"
npm run essai:store -- --nouvel-utilisateur --claude-desktop
```

Le script, sans droits d'administrateur sauf à l'étape 4 :

1. **Paquet** : avec `--paquet`, un `.appx` déjà construit, par exemple l'artefact `paquet-microsoft-store` du workflow [« Paquet du Microsoft Store »](../../.github/workflows/store.yml) (`gh run download <id de l'exécution> -n paquet-microsoft-store -D "$HOME\Downloads\paquet-store"`) ; sinon, il le construit (`npm run dist:store`, ou `-- --essai` si l'identité n'est pas remplie) et prend dans `dist/` le paquet de la version de `package.json`. Il lit l'identité du manifeste du paquet (nom, éditeur, version).
2. **signtool récent** : celui du cache d'electron-builder est trop ancien (« SignTool Error: A required function is not present »). Le script prend celui du SDK Windows le plus récent (`Windows Kits\10\bin\<version>\x64`, 10.0.22621 au moins) ; sans SDK, il télécharge le paquet NuGet officiel `Microsoft.Windows.SDK.BuildTools` **10.0.26100.4188** (environ 22 Mo) dans `%LOCALAPPDATA%\simulateur-independant-fr-outils`. Dans les deux cas, il refuse un `signtool.exe` dont la signature Authenticode n'est pas valide et faite par Microsoft.
3. **Certificat d'essai** : sujet = éditeur du paquet (`CN=82BAFE86-…`, le champ `publisher` de [`identite.json`](../../build/store/identite.json)), nom « Essai du paquet Simulateur Indépendant FR (npm run essai:store) », dans `Cert:\CurrentUser\My`. Créé la première fois, réutilisé ensuite.
4. **Approbation par le PC** : la partie publique du certificat (`.cer`, sans clé privée) est importée dans `Cert:\LocalMachine\TrustedPeople`. **Windows affiche une fenêtre de contrôle de compte d'utilisateur** : c'est la seule étape administrateur, avec la seule commande `Import-Certificate`, affichée avant. Rien à faire si le certificat est déjà approuvé.
5. **Signature d'une copie** dans `%LOCALAPPDATA%\simulateur-independant-fr-outils\essai` (`signtool sign /fd SHA256 /sha1 <empreinte> /s My`) : le paquet d'origine, celui qui part dans Partner Center, n'est jamais modifié.
6. **Garde-fou** : si la version du Store est installée (`SignatureKind` `Store`), le script s'arrête. Une copie d'essai de même version ou plus récente est désinstallée puis remplacée, ce que le script annonce ; une plus ancienne est mise à jour.
7. **Installation** (`Add-AppxPackage`) et vérification : `InstallLocation` sous `C:\Program Files\WindowsApps\`, `SignatureKind` `Developer`, version attendue.
8. **Serveur MCP** : le script lance le serveur exactement comme un client d'IA configuré pour la version du Store (alias `%LOCALAPPDATA%\Microsoft\WindowsApps\simulateur-independant-fr.exe`, `ELECTRON_RUN_AS_NODE=1`, copie du serveur dans le dossier de données, `--donnees`), attend « Serveur MCP du simulateur 0.11.0 prêt ; données lues dans … », puis l'arrête. La copie du serveur n'existe qu'après un lancement de l'application : s'il n'y en a pas encore, ou si elle est d'une autre version, **le script ouvre l'application** (par `shell:AppsFolder`, comme le menu Démarrer) et attend qu'elle l'écrive ; l'application reste ouverte pour la suite. Si elle n'y parvient pas en 90 secondes : la lancer depuis le menu Démarrer, puis `npm run essai:store -- verifier`.

Options :

- `--nouvel-utilisateur` : simule un nouvel utilisateur en renommant `%APPDATA%\simulateur-independant-fr` en `simulateur-independant-fr.classique` (application fermée ; refusé si `.classique` existe déjà). Sur un poste qui a eu la version classique, les fichiers déjà présents dans ce dossier sont modifiés sur place par le paquet, sans redirection ([ADR 013](../adr/013-serveur-mcp-dans-la-version-du-microsoft-store.md), décision) : l'essai ne testerait pas la redirection. Si `%APPDATA%\electron-vite-template` existe (données d'avant la version 0.10), l'application y reprend la session au premier lancement (`src/backend/ancien-dossier-de-donnees.ts`) et affiche la fenêtre « Sauvegardes converties » : c'est normal.
- `--claude-desktop` : ajoute l'entrée `simulateur-independant-fr` de la version du Store dans la configuration de Claude Desktop, en paquet MSIX (`%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`) ou installé classiquement (`%APPDATA%\Claude\`), détecté. Claude Desktop doit être **complètement quitté** (clic droit sur son icône près de l'horloge > Quitter), sinon il peut réécrire le fichier en se fermant : le script refuse s'il tourne. Une copie de sauvegarde horodatée (`claude_desktop_config.json.avant-essai-store-<date>`) précède toute modification ; le reste du fichier (`preferences`…) est gardé. Rien ne change si l'entrée est déjà là, identique ; si elle diffère (version classique), le script le signale sans la remplacer. Un fichier qui n'est pas du JSON valide n'est pas touché.

Les autres commandes :

```powershell
npm run essai:store -- verifier     # refait seulement l'étape 8, par exemple après une mise à jour
npm run essai:store -- etat         # paquet installé, certificat présent et approuvé, données mises de côté, serveurs MCP en cours et leur client, entrée de Claude Desktop : rien n'est modifié
npm run essai:store -- nettoyer     # à la fin de l'essai ; --arreter-les-serveurs-mcp arrête avant les serveurs MCP restés lancés par un client d'IA
```

### Essayer l'application

La lancer en tapant son nom (« Simulateur Indépendant FR ») dans la recherche du menu Démarrer : un raccourci épinglé à la barre des tâches ou une entrée récente peut continuer à lancer une ancienne copie d'essai. La fenêtre s'ouvre, les résultats s'affichent, une simulation modifiée est retrouvée au lancement suivant, les exports (CSV, PDF) s'enregistrent là où on le demande.

Avec le dossier de données mis de côté, les données du paquet sont dans `%LOCALAPPDATA%\Packages\<nom de famille du paquet>\LocalCache\Roaming\simulateur-independant-fr`, avec la copie du serveur dans `mcp\serveur-mcp.mjs`. Le vrai `%APPDATA%\simulateur-independant-fr` n'existe plus : si l'IA décrit une simulation, elle lit forcément le dossier redirigé, ce qui prouve que l'alias fonctionne.

### Essayer le serveur MCP avec Claude Desktop

- Dans l'application : Paramètres > « Utiliser avec une IA (MCP) ». La configuration doit commencer par `…\AppData\Local\Microsoft\WindowsApps\simulateur-independant-fr.exe`, et la fenêtre doit afficher le paragraphe « Version du Microsoft Store ». C'est la même entrée que celle qu'ajoute `--claude-desktop`.
- **Claude Desktop** s'installe depuis https://claude.com/download. Il est lui-même un paquet MSIX : son fichier de configuration n'est **pas** dans `%APPDATA%\Claude` mais dans `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json` (de même, ses journaux sont dans le dossier `logs` voisin). Sans `--claude-desktop`, l'ouvrir par Claude Desktop (Paramètres > Développeur > Modifier la configuration) et ajouter la rubrique `"mcpServers": { … },` juste après la première accolade, Claude Desktop quitté (voir [utiliser-avec-une-ia.md](../utiliser-avec-une-ia.md)).
- Les serveurs MCP ne sont disponibles que dans l'onglet **Chat** de Claude Desktop, pas dans l'onglet Code. Vérifier leur présence dans le menu « + » sous la zone de saisie, ou dans Paramètres > Développeur.
- Demander « Décris ma simulation » (le serveur lit la session de l'application), modifier un montant dans l'application (il est vu à la question suivante), puis demander l'ajout d'une activité : la fenêtre « Proposition de votre IA » doit s'ouvrir dans l'application. Ces essais ont été concluants le 2026-10-12.
- En cas d'échec : journal `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\logs\mcp-server-simulateur-independant-fr.log`. Les solutions de repli sont décrites dans l'ADR 013.

### Nettoyer : `npm run essai:store -- nettoyer`

Application fermée, le script :

- vérifie d'abord que rien de l'application ne tourne, et distingue deux cas. Si la **fenêtre** est ouverte : « L'application « Simulateur Indépendant FR » est ouverte : fermez-la… ». Si elle est fermée mais que des **serveurs MCP** de la version du Store tournent encore (des process du même exécutable sous `WindowsApps`, à la ligne de commande contenant `serveur-mcp.mjs`, lancés par Claude Code ou Claude Desktop par l'alias d'exécution), il dit combien et par quel client (« 3 lancés par Claude Code »), et propose de quitter ce client, ou de relancer avec `--arreter-les-serveurs-mcp`, qui arrête ces seuls process (annoncés un à un) ; le client les relance à sa prochaine session. Les serveurs d'une installation classique ne sont pas concernés. L'option existe aussi pour `installer`, et `etat` liste les serveurs en cours ;
- désinstalle la copie d'essai (jamais une version `Store`, qu'il signale et laisse) ; Windows supprime avec elle ses données redirigées (`LocalCache`) ;
- retire le certificat d'essai de `Cert:\LocalMachine\TrustedPeople` (**une fenêtre de contrôle de compte d'utilisateur**, pour la seule commande `Remove-Item` affichée) et de `Cert:\CurrentUser\My` ;
- supprime les copies signées et le certificat exporté (`%LOCALAPPDATA%\simulateur-independant-fr-outils\essai`) ; le signtool téléchargé reste en cache ;
- remet `%APPDATA%\simulateur-independant-fr.classique` à sa place. Si un dossier `%APPDATA%\simulateur-independant-fr` existe aussi (la version classique a été lancée entre-temps), il ne déplace rien et dit quoi faire : supprimer ce dossier s'il n'a rien à garder, ou comparer les deux, puis relancer `nettoyer` ;
- laisse l'entrée du serveur dans Claude Desktop, qui reste valable pour la version installée depuis le Store, et le dit. `npm run essai:store -- nettoyer --claude-desktop` la retire (Claude Desktop quitté, après une copie de sauvegarde), si c'est bien celle de la version du Store ; le reste du fichier est gardé.

Facultatif : le **Windows App Certification Kit** (dans le SDK Windows : `winget install Microsoft.WindowsSDK.10.0.26100`, puis « Windows App Cert Kit ») fait en local les contrôles automatiques de la certification.

## 3. Première soumission

Partner Center s'affiche en français ou en anglais, selon le compte et la page : les noms des options sont cités tels qu'ils s'affichent en anglais (relevés le 2026-10-11), et les pages du menu de gauche portent leur libellé français entre parenthèses. Dans **Apps and games** > l'application, le menu de gauche liste, sous **Submission 1**, les pages à remplir dans l'ordre ci-dessous. Chaque page s'enregistre à part (**Save** ou **Save draft**) : rien ne part avant **Submit for certification**. Toutes peuvent se remplir avant le paquet, sauf **Store listings**, qui attend le paquet (voir plus bas).

1. **Construire le paquet à publier** : l'identité remplie et fusionnée dans `main`, lancer le workflow « Paquet du Microsoft Store » sur `main` (sans « essai »), ou pousser l'étiquette de la version (`vX.Y.Z`, voir [publication.md](../publication.md)) : le workflow se lance aussi sur les étiquettes. Télécharger l'artefact `paquet-microsoft-store` et le décompresser : `Simulateur-Independant-FR-X.Y.Z-store-x64.appx`.

2. **Pricing and availability** (Tarification et disponibilité)
   - **Markets** : *Restrict to specific markets*, puis *Show options* : **France** seulement (les règles simulées sont françaises ; d'autres marchés peuvent s'ajouter plus tard). Décocher *Make my product available in any future market…*, pour ne pas ouvrir l'application d'office à un nouveau marché.
   - **Visibility** : *Public audience*, et *Make this product available and discoverable in the Microsoft Store*.
   - **Schedule** : *Release* : *as soon as possible*, *Stop acquisition* : *never* (la date de publication se règle dans **Submission Options**, étape 8).
   - **Pricing** : *Market groups*, *EUR – France*, *Retail price* : **0** (gratuit). *Free trial*, *Sale pricing* et *Organizational licensing* : laisser par défaut.

3. **Properties** (Propriétés)
   - **Category and subcategory** : **Business**, sous-catégorie **Accounting & finance** (voir la [fiche](./fiche-du-store.md#catégorie)). Catégorie secondaire : aucune.
   - **Privacy policy** : à la question *Does this product access, collect, or transmit personal information…?*, répondre **No** : tout reste sur l'ordinateur. Partner Center demande **quand même l'adresse de la politique de confidentialité** (application de bureau avec la capacité `runFullTrust`) : donner celle de la [fiche](./fiche-du-store.md#identité-de-la-fiche).
   - **Support info** : *Use my account details* affiche sur la fiche publique l'adresse, l'e-mail, le site et le **téléphone** du compte (obligation du règlement européen sur les services numériques pour un professionnel). Pour afficher d'autres coordonnées sur cette application seulement, choisir *Use different details for this app*.
   - **Display mode** : rien à cocher (réservé à la réalité mixte).
   - **Product declarations** : garder *Customers can install this product to alternate drives or removable storage* et *Windows can include this product's data in automatic backups to OneDrive* ; **décocher** *Customers can use Windows 10/11 features to record and broadcast clips…* (réservé aux jeux, Partner Center l'avertit). Ne pas cocher les achats hors Store, le stylet, ni l'IA générative (l'application ne génère aucun contenu ; le serveur MCP sert un assistant installé par l'utilisateur). *This product has been tested to meet accessibility guidelines* : facultatif ; les tests automatiques WCAG (axe, thèmes clair et sombre) le justifient, mais aucun essai n'a été fait avec les outils d'accessibilité de Windows (Accessibility Insights, Narrateur).
   - **System requirements** : cocher **Keyboard** et **Mouse** en *Minimum hardware* ; le reste *Not specified*.

4. **Age ratings** (Évaluation de l'âge) : *I'm ready to complete the International Age Rating Coalition (IARC) questionnaire*. *App Type* : **All Other App Types**. *Will this product use ratings obtained directly from a ratings board…?* : **No**. Puis répondre aux questions (toutes **No**) avec les réponses de la [fiche](./fiche-du-store.md#classification-par-âge-questionnaire-iarc) (classification attendue 3+).

5. **Packages**
   - Déposer le `.appx` dans *Drag your packages here… or browse your files*. Partner Center lit l'identité dans le paquet et refuse un paquet dont l'identité ne correspond pas à la réservation (c'est le cas du paquet d'essai).
   - **Device family availability** : cocher **Windows 10/11 Desktop** seulement, et décocher *Let Microsoft decide whether to make this app available to any future device families*.
   - Après le dépôt, la page avertit : « The following restricted capabilities require approval before you can use them in your app: runFullTrust ». La justification ne se donne pas ici mais dans **Submission Options** (étape 8), rubrique *Restricted capabilities*, champ « Why do you need the runFullTrust capability, and how will it be used in your product? », limité à **500 caractères** : texte anglais court de la [fiche](./fiche-du-store.md#justification-de-la-capacité-runfulltrust).

6. **Store listings** (Descriptions dans le Store ; *Manage Store listing languages*) : la langue de la fiche vient du paquet (`fr-FR`) et n'apparaît sous *Languages supported in packages* qu'**une fois le paquet déposé** (étape 5). Ouvrir alors **French (France)** et remplir description, description courte, fonctionnalités, mots-clés (voir la [fiche](./fiche-du-store.md#mots-clés)), captures (`captures/*.png`, avec leurs légendes), copyright et conditions de licence supplémentaires : tout est dans [fiche-du-store.md](./fiche-du-store.md). Aucune langue supplémentaire (*Additional Store listing languages*).
   - Le champ « Nouveautés de cette version » reste **vide** pour la première soumission : Partner Center le précise lui-même.
   - Les cases de logo 9:16 et 1:1 du haut de la page ne servent qu'à la Xbox : les laisser vides. Seule l'« Icône de vignette d'application 1:1 300 × 300 » sert : `logos/icone-300x300.png`. Les icônes 150 × 150 et 71 × 71 restent vides (ce sont les images du paquet).

7. **Additional Testing Information** (Informations supplémentaires sur les tests ; menu de gauche, *Supplemental info*) : un seul champ de texte libre, *Notes for Certification* : y coller tout le bloc des [notes pour la certification](./fiche-du-store.md#notes-pour-la-certification). Rien dans *Credentials* (l'application n'a pas de compte). La page **Submission Options** y renvoie.

8. **Submission Options** (Options de soumission) :
   - **Publishing hold options** : choisir **Don't publish this submission until I select Publish now**, pour garder la main sur la date de publication.
   - **Restricted capabilities** : coller la justification de `runFullTrust` (texte anglais court de la [fiche](./fiche-du-store.md#justification-de-la-capacité-runfulltrust), 500 caractères au plus).

9. **Submit for certification** (sur la page de la soumission, une fois toutes les pages complètes). Compter quelques heures à trois jours ouvrés. La page de l'application montre alors l'avancement : Submission, Pre-processing, Certification, Publishing. Ne pas cliquer sur **Cancel certification**. En cas de refus, le rapport de certification dit quoi corriger ; corriger, reconstruire si besoin (même version : le Store accepte un nouveau paquet tant que la soumission n'est pas publiée), et resoumettre.

10. Une fois certifiée (le publishing hold est pris en compte : la page indique « Your product will start publishing when you click on Publish now »), cliquer sur **Publish now** sur la page d'état de la certification. La fiche est en ligne sous `https://apps.microsoft.com/detail/<ID Store>`, en général dans l'heure. L'**ID Store** (12 caractères, `9N…`) s'affiche dans **Product management** > **Product Identity** (Identité du produit).

11. Ensuite, dans le dépôt : ajouter le lien du Store au README, à [installation.md](../installation.md) (le Store comme moyen recommandé sous Windows) et à la démo web : dans `src/web/ApplicationDeBureau.tsx`, remplacer « Bientôt sur le Microsoft Store » par un lien vers la fiche, en premier sous Windows (il sert à l'aide à l'installation, à la fenêtre « Utiliser avec une IA (MCP) » et à la ligne MCP de la version web installée, qui renvoient aujourd'hui vers l'exécutable GitHub, bloqué par Smart App Control) ; mentionner la version du Store dans [utiliser-avec-une-ia.md](../utiliser-avec-une-ia.md) si l'essai de l'étape 2 a demandé des ajustements. Ajouter aussi le lien à la fiche du projet du site becherini-web.

## 4. Mises à jour

Le Store met l'application à jour tout seul chez les utilisateurs. Pour chaque nouvelle version :

1. Suivre [publication.md](../publication.md) : numéro de version dans `package.json`, CHANGELOG, étiquette `vX.Y.Z`. Le Store exige un numéro **plus grand** que celui du paquet déjà publié ; le paquet porte `X.Y.Z.0` (le quatrième nombre est réservé au Store).
2. L'étiquette lance les deux workflows : « Publication des exécutables » (brouillon de version GitHub) et « Paquet du Microsoft Store » (artefact `paquet-microsoft-store`, gardé 30 jours ; il n'est pas joint à la version GitHub, puisqu'il ne s'installe pas hors du Store).
3. Partner Center > l'application > **Update** (nouvelle soumission, qui reprend la précédente) > **Packages** : retirer l'ancien paquet, déposer le nouveau ; **Store listings** > French (France) : mettre à jour les nouveautés (*What's new in this version*) ; **Submit for certification**.

### Automatiser l'envoi (facultatif, après la première publication)

Microsoft fournit une action GitHub et un outil en ligne de commande (`msstore`) pour soumettre une mise à jour depuis le workflow, sans passer par l'interface de Partner Center ([Publish app updates with GitHub Actions](https://learn.microsoft.com/en-us/windows/apps/publish/msstore-dev-cli/github-actions)). Cela ne fonctionne **qu'une fois l'application publiée** une première fois à la main.

À préparer, par le propriétaire du compte :

1. Partner Center > Account settings > **User management** > **Microsoft Entra applications** : créer (ou ajouter) une application Entra ID, lui donner le rôle **Manager**, puis lui créer une **clé** (secret client, à durée limitée : noter sa date d'expiration).
2. Déclarer dans le dépôt GitHub (Settings > Secrets and variables > Actions), **jamais dans les fichiers du dépôt** :

   | Secret | D'où vient la valeur |
   |---|---|
   | `PARTNER_CENTER_TENANT_ID` | ID de locataire (tenant) de l'annuaire Entra ID : page de l'application Entra dans Partner Center, ou Account settings > **Tenants** |
   | `PARTNER_CENTER_CLIENT_ID` | ID client (application) de l'application Entra créée à l'étape 1 |
   | `PARTNER_CENTER_CLIENT_SECRET` | la clé créée à l'étape 1 (visible une seule fois) |
   | `PARTNER_CENTER_SELLER_ID` | Account settings > **Legal info** > **Developer** > **Seller ID** |

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

Pour l'installer comme le Store l'installerait et l'essayer avant une soumission : `npm run essai:store` ([étape 2](#2-essayer-le-paquet-avant-la-première-soumission)).

Sur un poste sans mode développeur ni droits d'administrateur, electron-builder signale en décompressant ses outils qu'il ne peut pas créer deux liens symboliques (« Cannot create symbolic link », fichiers macOS inutiles ici) : l'avertissement est sans effet, le paquet est construit.

Les images de `build/appx/` et de `logos/` se régénèrent depuis l'icône de l'application si elle change : `powershell -ExecutionPolicy Bypass -File scripts/generer-images-store.ps1`. Les captures d'écran : `npm run captures`.

## Annexe : essayer le paquet sans le script

La marche à suivre manuelle de l'[étape 2](#2-essayer-le-paquet-avant-la-première-soumission), vérifiée le 2026-10-12, que `npm run essai:store` automatise. Elle se distingue du script sur deux points : le certificat passe par un fichier `.pfx` protégé par un mot de passe, et tout se fait dans une fenêtre PowerShell administrateur.

1. **Construire le paquet** : GitHub > Actions > « Paquet du Microsoft Store » > **Run workflow** sur `main` (cocher « essai » si l'identité n'est pas encore remplie). Télécharger l'artefact `paquet-microsoft-store` (un zip qui contient le `.appx`), depuis la page de l'exécution ou en ligne de commande : `gh run download <id de l'exécution> -n paquet-microsoft-store -D "$HOME\Downloads\paquet-store"`. En local, sous Windows : `npm run dist:store` (ou `npm run dist:store -- --essai`), paquet dans `dist/`. Le paquet d'origine part tel quel dans Partner Center : n'essayer qu'une copie.
2. **Préparer l'essai.**
   - La démo web installée comme application avec Edge porte le même nom dans le menu Démarrer : la désinstaller (`edge://apps`) ou savoir la distinguer (son éditeur est « Microsoft Edge ») avant de commencer.
   - Pour simuler un **nouvel utilisateur**, mettre de côté le dossier de données de la version classique, application et client d'IA fermés. Sur un poste qui a eu la version classique, les fichiers déjà présents dans `%APPDATA%\simulateur-independant-fr` sont modifiés sur place par le paquet, sans redirection ([ADR 013](../adr/013-serveur-mcp-dans-la-version-du-microsoft-store.md), décision) : l'essai ne testerait pas la redirection.

     ```powershell
     Rename-Item "$env:APPDATA\simulateur-independant-fr" "simulateur-independant-fr.classique"
     ```

     Si `%APPDATA%\electron-vite-template` existe (données d'avant la version 0.10), l'application y reprend la session au premier lancement (`src/backend/ancien-dossier-de-donnees.ts`) et affiche la fenêtre « Sauvegardes converties » : c'est normal.
3. **Signer une copie du paquet** (PowerShell **administrateur**). Le sujet du certificat est le champ `publisher` de [`build/store/identite.json`](../../build/store/identite.json) (ici `CN=82BAFE86-DEBC-4123-9C53-FF6F4E086825` ; à adapter si l'identité change) :

   ```powershell
   $cert = New-SelfSignedCertificate -Type Custom -Subject "CN=82BAFE86-DEBC-4123-9C53-FF6F4E086825" -KeyUsage DigitalSignature -FriendlyName "Essai paquet Simulateur" -CertStoreLocation "Cert:\CurrentUser\My" -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")
   $mdp = ConvertTo-SecureString "essai" -Force -AsPlainText
   Export-PfxCertificate -Cert $cert -FilePath "$env:TEMP\essai-store.pfx" -Password $mdp
   Export-Certificate -Cert $cert -FilePath "$env:TEMP\essai-store.cer"
   Import-Certificate -FilePath "$env:TEMP\essai-store.cer" -CertStoreLocation Cert:\LocalMachine\TrustedPeople
   ```

   Puis signer une copie (le nom du fichier est à adapter) :

   ```powershell
   $paquet = "$HOME\Downloads\paquet-store\Simulateur-Independant-FR-0.11.0-store-x64.appx"
   $copie = "$HOME\Downloads\paquet-store\essai-signe.appx"
   Copy-Item $paquet $copie
   signtool sign /fd SHA256 /f "$env:TEMP\essai-store.pfx" /p essai $copie
   ```

   Il faut un `signtool` **récent**. Celui du cache d'electron-builder (`%LOCALAPPDATA%\electron-builder\Cache\winCodeSign-2.6.0\…\windows-10\x64\signtool.exe`) est trop ancien : il répond « SignTool Error: A required function is not present ». Deux sources :
   - le SDK Windows : `winget install Microsoft.WindowsSDK.10.0.26100` (déjà cité pour le Windows App Certification Kit, plus bas) ;
   - ou le paquet NuGet officiel `Microsoft.Windows.SDK.BuildTools` (un zip d'environ 22 Mo) : télécharger `https://www.nuget.org/api/v2/package/Microsoft.Windows.SDK.BuildTools/10.0.26100.4188`, le renommer en `.zip` et le décompresser ; `signtool.exe` est dans `bin\10.0.26100.0\x64\`. Vérifier sa signature avec `Get-AuthenticodeSignature <chemin>\signtool.exe` : le signataire doit être Microsoft.
4. **Installer la copie signée**, sans droits d'administrateur :

   ```powershell
   Add-AppxPackage $copie
   Get-AppxPackage *SimulateurInd* | Select-Object InstallLocation, SignatureKind
   ```

   `InstallLocation` doit être sous `C:\Program Files\WindowsApps\` et `SignatureKind` valoir `Developer`.
5. **Essayer l'application et le serveur MCP** comme à l'étape 2 ([Essayer l'application](#essayer-lapplication), [Essayer le serveur MCP avec Claude Desktop](#essayer-le-serveur-mcp-avec-claude-desktop)). Sans le script, le serveur se vérifie par la commande de la fenêtre « Utiliser avec une IA (MCP) » de l'application, qui doit écrire « Serveur MCP du simulateur 0.11.0 prêt ; données lues dans … » (Ctrl+C pour l'arrêter) : la lancer dans une **nouvelle** fenêtre PowerShell, et fermer cette fenêtre ensuite, car la variable `ELECTRON_RUN_AS_NODE` y reste active.
6. **Désinstaller et nettoyer** (PowerShell administrateur) :

   ```powershell
   Get-AppxPackage *SimulateurInd* | Remove-AppxPackage
   Rename-Item "$env:APPDATA\simulateur-independant-fr.classique" "simulateur-independant-fr"
   Get-ChildItem Cert:\LocalMachine\TrustedPeople, Cert:\CurrentUser\My | Where-Object Subject -eq "CN=82BAFE86-DEBC-4123-9C53-FF6F4E086825" | Remove-Item
   Remove-Item "$env:TEMP\essai-store.pfx", "$env:TEMP\essai-store.cer", $copie -ErrorAction SilentlyContinue
   ```

   L'entrée du serveur dans Claude Desktop peut rester : la configuration est la même après l'installation depuis le Store.
