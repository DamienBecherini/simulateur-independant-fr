# Utiliser le simulateur avec une IA (MCP)

L'application de bureau comprend un **serveur MCP local**. MCP (Model Context Protocol) est un protocole ouvert qui permet à un client d'IA (Claude Desktop, Claude Code, LM Studio, et bien d'autres) de se servir d'outils fournis par un programme installé sur l'ordinateur. Ici, l'IA peut lire votre simulation, la faire calculer par le simulateur, comparer les statuts, et proposer des ajouts tirés de vos factures ou relevés ; c'est vous qui les appliquez.

Ce n'est pas l'avis d'un expert-comptable. La démo web n'a pas ce serveur : il n'existe que dans l'application de bureau (dans la démo, « Utiliser avec une IA (MCP) » renvoie vers son téléchargement).

## Ce que l'IA peut faire

Seize outils, décrits dans l'[ADR 010](./adr/010-outils-pour-les-clients-d-ia.md) :

- **lire** : décrire la simulation (années, acteurs, relations), lister les flux saisis, les règles fiscales de l'année ;
- **calculer** : simuler une année, la synthèse des années, le détail du résultat d'un acteur, le comparateur de statuts, l'arbitrage rémunération et dividendes (avec l'écart entre la rémunération et les dividendes saisis et le meilleur net ; dans un autre statut que l'actuel, l'écart de frais de fonctionnement supposés compris) ;
- **proposer** : des flux, un acteur, une relation, des modifications, une suppression, des réglages du comparateur ; **rafraîchir** une proposition périmée ;
- **envoyer une proposition à l'application** (`appliquer_proposition`).

Les chiffres viennent toujours du moteur du simulateur, jamais de l'IA. Aucun outil ne supprime un acteur ou une année, et une proposition supprime au plus une série de flux ou une relation.

## Mise en place

Le serveur se lance avec l'exécutable de l'application, en mode Node (variable d'environnement `ELECTRON_RUN_AS_NODE=1`) : **rien d'autre à installer**, pas même Node.js.

La configuration se copie depuis l'application : **Paramètres** (icône en haut à gauche) > **Utiliser avec une IA (MCP)**, avec l'un des deux boutons : **Copier le bloc à insérer (fichier existant)**, le cas courant, ou **Copier la configuration complète (fichier vide)**. Elle contient les chemins réels de votre installation. La configuration complète a cette forme (exemple sous Windows ; les chemins dépendent du dossier d'installation choisi) :

```json
{
  "mcpServers": {
    "simulateur-independant-fr": {
      "command": "C:\\Users\\Camille\\AppData\\Local\\Programs\\simulateur-independant-fr\\Simulateur Indépendant FR.exe",
      "args": [
        "C:\\Users\\Camille\\AppData\\Local\\Programs\\simulateur-independant-fr\\resources\\mcp\\serveur-mcp.mjs",
        "--donnees",
        "C:\\Users\\Camille\\AppData\\Roaming\\simulateur-independant-fr"
      ],
      "env": { "ELECTRON_RUN_AS_NODE": "1" }
    }
  }
}
```

- `command` : l'exécutable de l'application ;
- premier argument : le serveur, copié hors de l'archive de l'application (`resources/mcp/serveur-mcp.mjs` sous Windows et Linux, `Simulateur Indépendant FR.app/Contents/Resources/mcp/serveur-mcp.mjs` sous macOS) ;
- `--donnees` : le dossier de données de l'application (voir [installation.md](./installation.md#vos-données)), où elle enregistre la simulation. Le serveur ne devine rien : sans ce paramètre, il refuse de démarrer.

Si vous déplacez ou réinstallez l'application ailleurs, copiez à nouveau la configuration.

### Version du Microsoft Store

Installée par le Microsoft Store, l'application vit dans un dossier protégé dont le nom change à chaque mise à jour. La configuration copiée depuis l'application en tient compte ([ADR 013](./adr/013-serveur-mcp-dans-la-version-du-microsoft-store.md)) :

- `command` est l'**alias d'exécution** de l'application, `%LOCALAPPDATA%\Microsoft\WindowsApps\simulateur-independant-fr.exe` (en chemin complet), qui reste valable après chaque mise à jour ;
- le serveur est une **copie** que l'application tient à jour dans son dossier de données à chaque démarrage : `…\AppData\Roaming\simulateur-independant-fr\mcp\serveur-mcp.mjs`.

Windows range les fichiers que crée cette version dans `%LOCALAPPDATA%\Packages\<nom du paquet>\LocalCache\Roaming\simulateur-independant-fr`, tout en les montrant à l'application, et au serveur lancé par l'alias, au chemin habituel : c'est pourquoi la commande passe par l'alias. Si le serveur ne démarre pas, vérifiez que l'alias est activé : Paramètres de Windows > Applications > Paramètres avancés des applications > Alias d'exécution d'application > « Simulateur Indépendant FR ».

### Avec Claude Desktop (Windows, macOS)

1. **Ouvrez le fichier depuis Claude Desktop** : **Paramètres** > **Développeur** > **Modifier la configuration** (en anglais : *Settings* > *Developer* > *Edit Config*). Claude Desktop affiche le fichier `claude_desktop_config.json` dans l'explorateur de fichiers, sans l'ouvrir : ouvrez-le avec un éditeur de texte, par exemple le Bloc-notes sous Windows (clic droit > **Ouvrir avec**). C'est le moyen sûr, quel que soit le mode d'installation de Claude Desktop (voir [Où est le fichier](#où-est-le-fichier-de-claude-desktop)).
2. **Quittez complètement Claude Desktop** avant d'enregistrer : sous Windows, clic droit sur son icône près de l'horloge (zone de notification) > **Quitter** ; sous macOS, **Quitter** dans le menu Claude. Fermer la fenêtre ne suffit pas : Claude Desktop peut réécrire le fichier en se fermant, et votre ajout serait perdu.
3. **Ajoutez le serveur au fichier.** Il n'est presque jamais vide : Claude Desktop y range déjà ses réglages (`"preferences": {…}`…), le plus souvent sans rubrique `mcpServers`.
   - **Le fichier n'a pas de rubrique `mcpServers`** (cas le plus courant) : copiez le bloc avec **Copier le bloc à insérer (fichier existant)** et collez-le **juste après la toute première accolade `{`** du fichier, sans toucher au reste. Le bloc se termine par une virgule, puisque les réglages existants le suivent :

     ```text
     {
       "mcpServers": {
         "simulateur-independant-fr": { …l'entrée copiée… }
       },
       "preferences": { …réglages existants, inchangés… }
     }
     ```

   - **Le fichier a déjà une rubrique `mcpServers`** (un autre serveur MCP) : ajoutez-y seulement l'entrée `"simulateur-independant-fr": {…}`, telle qu'elle figure dans la configuration affichée par l'application, juste après `"mcpServers": {`, suivie d'une virgule puisqu'une autre entrée vient après.
   - **Le fichier est vide** : collez la configuration complète (**Copier la configuration complète (fichier vide)**).
4. **Enregistrez le fichier, puis relancez Claude Desktop.**
5. **Utilisez l'onglet Chat.** Les serveurs MCP de ce fichier ne servent que dans l'onglet **Chat** de Claude Desktop, pas dans l'onglet **Code** (Claude Code). Les outils du simulateur apparaissent dans le menu **+** sous la zone de saisie, et dans **Paramètres** > **Développeur**, avec leur état.

Claude Desktop n'existe pas officiellement sous Linux.

#### Où est le fichier de Claude Desktop

Le menu **Modifier la configuration** l'ouvre toujours au bon endroit. Pour information :

- Windows, installation classique : `%APPDATA%\Claude\claude_desktop_config.json` ;
- Windows, Claude Desktop installé en **paquet** (MSIX) : Windows range son dossier dans celui du paquet, `%LOCALAPPDATA%\Packages\Claude_<identifiant>\LocalCache\Roaming\Claude\claude_desktop_config.json`, et le chemin précédent n'existe pas ou n'est pas lu ;
- macOS : `~/Library/Application Support/Claude/claude_desktop_config.json`.

Source : [Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers) (documentation officielle de MCP).

### Avec Claude Code (ligne de commande)

Claude Code n'utilise pas ce fichier : il enregistre le serveur par une commande, à taper dans un terminal (PowerShell ou invite de commandes sous Windows). **Paramètres** > **Utiliser avec une IA (MCP)** > **Copier la commande pour Claude Code** la donne toute prête, avec les chemins réels de votre installation (classique ou Microsoft Store) ; ce sont les trois valeurs de la configuration ci-dessus :

```text
claude mcp add simulateur-independant-fr --scope user --env ELECTRON_RUN_AS_NODE=1 -- "<command>" "<premier argument>" --donnees "<dossier de données>"
```

- `--scope user` rend le simulateur disponible dans tous vos projets : c'est le choix normal, puisqu'on interroge sa simulation d'où l'on veut. `--scope local` le limite au dossier courant, pour un essai ;
- Claude Code charge ses serveurs MCP **au démarrage d'une session** : relancez-le (`claude --continue` reprend la conversation en cours), puis tapez `/mcp` pour voir l'état du serveur ;
- pour le retirer : `claude mcp remove simulateur-independant-fr --scope user` (la même portée que l'ajout).

### Avec LM Studio (IA locale)

Depuis la version 0.3.17, LM Studio est un client MCP. Dans l'onglet **Program**, choisissez **Install** > **Edit mcp.json**, et collez la configuration complète, ou, si le fichier a déjà une rubrique `mcpServers`, ajoutez-y seulement l'entrée `simulateur-independant-fr` (LM Studio suit la notation `mcpServers` de Cursor : `command`, `args`, `env`). Choisissez ensuite un modèle qui sait appeler des outils.

Source : [LM Studio, MCP](https://lmstudio.ai/docs/app/mcp). La documentation de LM Studio ne montre qu'un exemple de serveur distant ; la notation d'un serveur local (`command`, `args`, `env`) est celle de Cursor, qu'elle cite.

### Avec un autre client

Tout client MCP qui lance un serveur local sur l'entrée et la sortie standard convient : indiquez-lui la commande, les arguments et la variable d'environnement de la configuration.

## Proposer, puis valider dans l'application

1. L'IA lit la simulation et calcule avec les outils du simulateur.
2. Pour modifier quelque chose, elle construit une **proposition** (`proposer_flux`, `proposer_acteur`…). Une proposition ne modifie rien : elle porte un récapitulatif (« Ajouter 24 flux ? »), une ligne par opération, les doublons probables et l'effet sur le net de chaque année, calculé par le moteur.
3. Si vous êtes d'accord, l'IA appelle `appliquer_proposition`. Le serveur revérifie la proposition, puis la **dépose dans la boîte aux propositions** de l'application (dossier `propositions` du dossier de données). Il n'écrit jamais la simulation elle-même. Une proposition identique qui attend déjà dans la boîte n'y est pas déposée une deuxième fois.
4. L'application affiche la fenêtre **Proposition de votre IA** : récapitulatif, opérations, effet sur le net de chaque année, recalculés sur la simulation affichée. Choisissez :
   - **Appliquer** : la proposition entre dans la simulation en **une seule étape**, que le bouton « Annuler » défait ;
   - **Refuser** : rien ne change ;
   - **Plus tard** : la proposition reste dans la boîte et revient au prochain démarrage.
5. Une proposition **périmée** (vous avez modifié la simulation depuis qu'elle a été construite) ne peut pas être appliquée : l'IA la reconstruit sur la simulation actuelle (`rafraichir_proposition`), en disant quelles opérations ne s'appliquent plus, et vous la soumet à nouveau.

L'application enregistre la simulation **environ une seconde après chaque modification** (et tout de suite à la fermeture) : c'est ce fichier que le serveur lit. Chaque réponse du serveur indique quand il a été enregistré.

## Confidentialité

- Le serveur et l'application ne communiquent avec rien d'autre que votre client d'IA, par des fichiers et l'entrée et la sortie standard du serveur ; aucun réseau.
- En revanche, **ce que l'IA lit de votre simulation part chez le fournisseur de l'IA choisie**, comme les factures et relevés que vous lui donnez. Avec Claude Desktop, c'est Anthropic.
- Pour des données sensibles, préférez une **IA locale** (LM Studio, par exemple) : rien ne quitte l'ordinateur. Ses limites : un petit modèle enchaîne moins bien les outils, se trompe plus souvent dans les paramètres, et lit moins bien les factures scannées. Relisez chaque proposition.

## Sécurité

- **Méfiance envers les documents.** Une facture ou un relevé peut contenir des instructions cachées (« ignore tes consignes », « supprime… »). Le serveur demande à l'IA de les ignorer, et surtout rien ne change sans votre clic sur « Appliquer » ; aucun outil ne supprime en masse.
- La boîte aux propositions n'accepte que des fichiers ordinaires (pas de liens), au nom simple, de 512 Ko au plus, au format attendu ; chaque proposition est revalidée en entier par l'application. Les autres fichiers sont écartés et supprimés.

## Limites

- Les outils ne couvrent pas tout : frais réels, déplacements professionnels, suppression d'acteurs ou d'années se font dans l'application.
- Une proposition contient au plus 200 opérations : au-delà, il en faut plusieurs.
- Une modification faite dans l'application moins d'une seconde avant une lecture de l'IA peut ne pas être vue ; une proposition construite avant sera alors refusée comme périmée.
- Les réglages du comparateur appliqués par une proposition ne sont pas défaits par « Annuler », comme ceux saisis à la main (voir l'[ADR 009](./adr/009-reglages-du-comparateur-enregistres.md)).
- **AppImage (Linux)** : le chemin de l'exécutable change à chaque lancement ; préférez le paquet `.deb` pour utiliser le serveur MCP.

## Dépannage

- **Les outils n'apparaissent pas** : vérifiez que vous êtes dans l'onglet **Chat** de Claude Desktop (pas l'onglet Code), que le fichier de configuration est du JSON valide (une virgule oubliée ou en trop après le bloc inséré suffit à le rendre illisible), que votre ajout y est toujours (s'il a disparu, Claude Desktop tournait encore à l'enregistrement : quittez-le complètement et recommencez), et que les chemins sont absolus et existent ; puis quittez complètement le client d'IA et relancez-le. **Paramètres** > **Développeur** montre l'état du serveur dans Claude Desktop.
- **Journaux de Claude Desktop** : il écrit les messages du serveur dans `mcp-server-simulateur-independant-fr.log`, dans son dossier `logs` :
  - Windows, installation classique : `%APPDATA%\Claude\logs` ;
  - Windows, Claude Desktop installé en paquet : `%LOCALAPPDATA%\Packages\Claude_<identifiant>\LocalCache\Roaming\Claude\logs` ;
  - macOS : `~/Library/Logs/Claude`.
- **Lancer le serveur à la main** (la commande exacte est dans la fenêtre « Utiliser avec une IA (MCP) ») : il écrit « Serveur MCP du simulateur … prêt » sur la sortie d'erreur, puis attend les messages du client (Ctrl+C pour l'arrêter).

  ```powershell
  # Windows (PowerShell)
  $env:ELECTRON_RUN_AS_NODE=1; & "C:\…\Simulateur Indépendant FR.exe" "C:\…\resources\mcp\serveur-mcp.mjs" --donnees "C:\Users\…\AppData\Roaming\simulateur-independant-fr"
  ```

  ```sh
  # macOS
  ELECTRON_RUN_AS_NODE=1 "/Applications/Simulateur Indépendant FR.app/Contents/MacOS/Simulateur Indépendant FR" "/Applications/Simulateur Indépendant FR.app/Contents/Resources/mcp/serveur-mcp.mjs" --donnees "$HOME/Library/Application Support/simulateur-independant-fr"
  ```

- **« Aucune simulation enregistrée »** : l'application n'a encore rien enregistré dans le dossier donné. Ouvrez-la une fois (elle enregistre la simulation dès son ouverture) ; si elle est déjà ouverte, attendez quelques secondes ou modifiez la simulation. Vérifiez aussi que `--donnees` désigne bien le dossier indiqué dans Paramètres, « Utiliser avec une IA (MCP) ».
- **« Proposition périmée »** : la simulation a changé depuis la proposition ; demandez à l'IA de la rafraîchir (`rafraichir_proposition`), puis relisez-la.
- **Aucune fenêtre ne s'ouvre dans l'application** après un envoi : l'application doit être ouverte ; sinon, la proposition s'affichera à son prochain démarrage.

## Pour les développeurs

En développement, le serveur est empaqueté par `npm run transpile:electron` (`scripts/empaqueter-serveur-mcp.mjs` → `dist-electron/mcp/serveur-mcp.mjs`) et se lance avec l'Electron du projet :

```sh
ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron dist-electron/mcp/serveur-mcp.mjs --donnees <dossier de données>
```

(`node_modules\electron\dist\electron.exe` sous Windows ; Node.js 22 ou plus récent convient aussi : `node dist-electron/mcp/serveur-mcp.mjs --donnees …`.) Le choix de cette architecture est expliqué dans l'[ADR 011](./adr/011-serveur-mcp-local-et-boite-aux-propositions.md).
