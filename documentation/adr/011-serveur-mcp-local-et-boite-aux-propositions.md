# ADR-011: Serveur MCP local et boîte aux propositions

- **Date :** 2026-10-06
- **Statut :** Accepté

## Contexte

L'étape 2 de la phase 16 relie les outils de l'[ADR 010](./010-outils-pour-les-clients-d-ia.md) à un client d'IA de bureau (Claude Desktop, LM Studio…) par le protocole MCP. Le client lance le serveur lui-même, sur l'entrée et la sortie standard, avec la commande que l'utilisateur a mise dans sa configuration. Quatre questions :

1. **Avec quoi lancer le serveur**, sur un poste où Node.js n'est en général pas installé ?
2. **Quelle session il lit** : l'application garde la session en mémoire et l'enregistre une seconde après chaque modification.
3. **Comment une proposition est validée** : la règle « l'IA propose, l'utilisateur valide » (feuille de route) exige que rien ne change sans un geste de l'utilisateur, et qu'une application s'annule en une étape. L'ADR 010 prévoyait que le serveur écrive la nouvelle session et que l'application la recharge.
4. **Comment ne rien exposer d'autre** : une facture lue par l'IA peut contenir des instructions piégées.

## Décision

### Lancer le serveur avec l'exécutable de l'application

Le serveur (`src/backend/mcp/serveur.ts`, SDK officiel `@modelcontextprotocol/sdk`, version figée) est **empaqueté en un seul fichier** par esbuild (`scripts/empaqueter-serveur-mcp.mjs` → `dist-electron/mcp/serveur-mcp.mjs`, environ 900 Ko, SDK, Zod et moteur compris), à chaque `npm run transpile:electron`. electron-builder le copie **hors de l'archive asar** (`extraResources` → `resources/mcp/serveur-mcp.mjs`) et l'exclut de l'archive.

Il se lance avec **l'exécutable de l'application en mode Node** : `ELECTRON_RUN_AS_NODE=1 <exécutable> serveur-mcp.mjs --donnees <dossier>`. La configuration à copier, avec les chemins réels de l'installation (`app.getPath("exe")`, `process.resourcesPath`, `app.getPath("userData")`), est donnée dans les paramètres de l'application.

### Lire la session enregistrée, ne jamais l'écrire

Le serveur lit, à chaque appel, `sessionState.json` dans le dossier passé par `--donnees` (aucune recherche de dossier : sans ce paramètre, il refuse de démarrer), avec la lecture de l'application (conversion de format, nettoyage), sans rien réécrire. Chaque réponse dit quand le fichier a été enregistré ; la session étant enregistrée une seconde après chaque modification (sauvegarde différée existante) et à la fermeture, cela suffit, sans nouveau canal entre l'application et le serveur. Un test vérifie que la session affichée et la session relue dans le fichier ont la même empreinte (simulation d'exemple et montages types) : sinon toute proposition paraîtrait périmée.

### La boîte aux propositions

- Les outils `proposer_…` ne déposent rien : ils rendent la proposition au modèle, qui peut la compléter (`suiteDe`). Déposer à chaque appel ouvrirait une fenêtre par étape d'une proposition en construction.
- `appliquer_proposition` change de sens dans l'application de bureau : il **envoie** la proposition. Le serveur la valide en entier sur la session enregistrée (avec `executerOutil`, donc les mêmes vérifications et le refus d'une proposition périmée), puis l'écrit dans `propositions/<horodatage>-<aléa>.json` (nom provisoire puis renommage, pour ne jamais être lu à moitié écrit) : `{ format, version, creeeLe, proposition }`. Sa description et son schéma de sortie publiés (`envoyee`, `fichier`, récapitulatif, aperçu) le disent au modèle.
- Le **process principal** surveille ce dossier, et lui seul (`fs.watch`, relecture du dossier groupée sur 100 ms, et une relecture au démarrage). Un fichier n'est transmis à l'interface que s'il porte un nom simple (`[A-Za-z0-9_-]{1,100}.json`), est un fichier ordinaire (`lstat` : pas un lien), ne dépasse pas 512 Ko et suit le format, la proposition validée par le schéma complet de la couche d'outils (`PropositionSchema` : opérations, limites, clés inconnues refusées). Les autres sont journalisés et supprimés. L'interface ne peut retirer qu'un fichier de la liste transmise.
- L'**interface** relit chaque proposition sur la session affichée (`relireLaProposition`) : empreinte, application à une copie, récapitulatif, résumé, doublons probables et effet sur le net de chaque année recalculés, sans rien croire du fichier hormis ses opérations. « Appliquer » remplace la session par `setCurrentSession`, comme toute modification : **une étape d'annulation**. « Refuser » et « Retirer » (proposition périmée ou refusée) suppriment le fichier ; « Plus tard » le garde. Rien ne s'affiche avant le chargement de la session.

### Alternatives écartées

- **Exiger Node.js** (`"command": "node"`) : une installation de plus pour l'utilisateur, une version à surveiller, et un serveur qui ne suit pas la version de l'application.
- **Charger le serveur depuis l'archive asar** (`app.asar/dist-electron/...`) : le mode Node d'Electron lit l'asar, mais le serveur aurait besoin du SDK MCP et de ses dépendances (Express, Hono, Ajv… pour les transports HTTP inutiles ici) dans l'archive, que la liste `files` limite volontairement à Zod. Un fichier unique, hors de l'archive, se lit aussi à la main pour le dépannage.
- **Un exécutable autonome** (Node SEA, pkg) : une soixantaine de Mo de plus par système, à signer à part.
- **Le serveur écrit la nouvelle session** (prévu par l'ADR 010), l'application la recharge : la modification aurait lieu avant tout geste de l'utilisateur (seul le client d'IA demande éventuellement l'accord, et pas tous), l'application ouverte écraserait le fichier à sa prochaine sauvegarde, et l'annulation demanderait une copie de la session précédente gérée à deux endroits.
- **Un canal direct** (socket local, serveur HTTP dans l'application) : la proposition arriverait sans fichier, mais il faudrait authentifier le serveur MCP auprès de l'application et ouvrir un port local ; un dossier du profil de l'utilisateur, déjà protégé par le système, suffit.
- **Lire la session en mémoire de l'application** (par ce canal) : plus fraîche d'une seconde, au prix du même canal ; et le serveur devrait fonctionner application fermée pour les questions de lecture.

## Conséquences

- **Positives :**
  - Rien à installer en plus de l'application ; la configuration se copie depuis ses paramètres.
  - Le serveur ne peut pas modifier la simulation : il n'écrit que dans la boîte aux propositions, et ce qu'il y dépose est revalidé deux fois (process principal, interface) avant d'être montré, puis appliqué par le chemin ordinaire de l'historique.
  - Une instruction piégée dans un document ne peut au pire que faire afficher une proposition, que l'utilisateur relit et refuse.
  - Le même `appliquer_proposition` servira à l'assistant intégré (étape 3), qui appliquera directement la proposition acceptée dans la page.
  - L'archive de l'application ne grossit pas ; le serveur empaqueté ajoute environ 900 Ko hors de l'archive.
- **Négatives ou Compromis :**
  - Une modification faite dans l'application moins d'une seconde avant une lecture n'est pas vue ; une proposition construite dessus sera refusée comme périmée, et le modèle devra relire.
  - L'application doit être ouverte pour qu'une proposition soit appliquée ; sinon elle attend le prochain démarrage.
  - `ELECTRON_RUN_AS_NODE` doit rester permis : si l'application active un jour les « fuses » d'Electron pour durcir l'exécutable (`RunAsNode` désactivé), il faudra un autre lanceur.
  - Sous Linux, le chemin d'une AppImage change à chaque lancement : le paquet `.deb` est recommandé pour le serveur MCP.
  - `fs.watch` peut manquer des événements sur certains systèmes de fichiers (dossier réseau) ; la boîte est de toute façon relue au démarrage.

## Addendum (2026-10-06) : réponses en un seul texte, liste d'outils allégée

### Contexte

Chaque réponse du serveur rendait le résultat deux fois : en JSON dans le texte, et en contenu structuré (`structuredContent`), avec un schéma de sortie par outil dans `tools/list`. MCP demande le texte pour les clients qui ignorent le contenu structuré ; un client qui donne les deux au modèle lui fait lire chaque résultat deux fois. Les schémas de sortie pesaient 19 Ko des 55 Ko de la liste d'outils.

### Décision

- **Un seul texte par réponse** : le résumé en français, puis, à la ligne, le JSON du résultat. Plus de contenu structuré ni de schéma de sortie, `appliquer_proposition` compris. Le texte est le seul canal que tous les clients donnent au modèle ; il porte donc tout.
- **Annotations réduites à ce qui vaut** : `readOnlyHint` et `openWorldHint` pour les outils qui n'écrivent rien ; `appliquer_proposition` garde `destructiveHint: false` et devient `idempotentHint: true`, puisqu'une proposition identique qui attend déjà n'est pas redéposée. Le titre n'est plus répété dans les annotations.
- **`rafraichir_proposition`** (ADR 010, addendum) s'exécute comme un outil de proposition : il ne dépose rien, et son résumé dit combien d'opérations ne s'appliquent plus. La règle 4 des consignes y renvoie quand une proposition est refusée comme périmée.
- `tools/list` passe de 55 à 32 Ko (16 outils au lieu de 15) ; un test en borne la taille.

### Conséquences

- **Positives :** moins de texte par échange et par réponse, quel que soit le client ; une proposition périmée se reconstruit sans tout reproposer.
- **Négatives ou Compromis :** un client qui exploiterait le contenu structuré (affichage, validation) doit lire le JSON à la dernière ligne du texte.

## Addendum (2026-10-10) : `McpServer` au lieu de `Server`

### Contexte

Le SDK MCP (1.32) déclare dépréciée la classe bas niveau `Server`, avec laquelle le serveur était construit, au profit de `McpServer`. La voie ordinaire de `McpServer`, `registerTool`, attend un schéma Zod par outil : il en tire lui-même le schéma JSON publié et valide les arguments avant d'appeler l'outil. Essayée avec les schémas Zod du catalogue, elle change ce que voit le client d'IA : chaque schéma d'entrée reçoit `$schema` (brouillon 7 : 52 caractères de plus par outil, le reste du schéma étant identique), chaque outil un champ `execution`, les capacités annoncent `listChanged`, et des arguments invalides sont refusés par le SDK avec un message en anglais au lieu de l'explication en français de l'outil.

### Décision

- Le serveur est un `McpServer` (nom, titre, version, consignes inchangés). Les deux requêtes des outils, `tools/list` et `tools/call`, restent traitées par le serveur sous-jacent (`serveur.server.setRequestHandler`), comme le SDK le prévoit pour un usage avancé : la liste publiée reste `outilsPublies()`, tirée du catalogue, et `appelerOutil` ne change pas.
- `registerTool` n'est pas utilisé : il dupliquerait la conversion des schémas déjà faite par le catalogue (ADR 010) et en changerait le résultat.

### Conséquences

- **Positives :** plus d'API dépréciée ; `initialize` et `tools/list` rendent exactement les mêmes réponses qu'avant (vérifié sur le serveur empaqueté) ; le catalogue reste la seule source des schémas.
- **Négatives ou Compromis :** le serveur se passe des aides de haut niveau de `McpServer` (outils enregistrés un par un, notification de liste modifiée). Ne pas mélanger les deux voies : un `registerTool` ajouté échouerait, le SDK refusant de traiter `tools/list` et `tools/call` deux fois.
