# ADR-013: Serveur MCP dans la version du Microsoft Store

- **Date :** 2026-10-06
- **Statut :** Proposé (à confirmer par l'essai sur un paquet installé, voir « À vérifier »)

## Contexte

Pour passer le Contrôle intelligent des applications (Smart App Control) de Windows 11 sans certificat de signature, l'application sera aussi distribuée par le **Microsoft Store**, en paquet MSIX/AppX construit par electron-builder (cible `appx`, voir [publier-sur-le-store.md](../microsoft-store/publier-sur-le-store.md)). Le Store signe le paquet.

Le serveur MCP local ([ADR 011](./011-serveur-mcp-local-et-boite-aux-propositions.md)) est lancé par un client d'IA (Claude Desktop, LM Studio…) avec la commande que l'application donne à copier : `ELECTRON_RUN_AS_NODE=1 <exécutable> <resources>/mcp/serveur-mcp.mjs --donnees <dossier de données>`. Une application de bureau empaquetée en MSIX change trois choses :

1. **Le dossier d'installation** est `C:\Program Files\WindowsApps\<nom>_<version>_x64__<éditeur>\app\`. Son nom **change à chaque mise à jour**, et le dossier est protégé : une configuration qui y renvoie casse à la première mise à jour.
2. **Les écritures dans `%APPDATA%` sont redirigées** (Windows 10 1903 et suivants) : un fichier **créé** par l'application dans `%APPDATA%\simulateur-independant-fr` est écrit en réalité dans `%LOCALAPPDATA%\Packages\<nom de famille du paquet>\LocalCache\Roaming\simulateur-independant-fr`. Les process du paquet voient les deux dossiers fusionnés au chemin habituel ; un process **hors du paquet** ne voit que le vrai `%APPDATA%`, donc ni la session enregistrée, ni la boîte aux propositions. Les fichiers qui existaient avant (une ancienne installation classique) sont modifiés sur place. Source : [Understanding how packaged desktop apps run on Windows](https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-behind-the-scenes).
3. **L'identité du paquet** n'est donnée qu'à un process lancé par une activation du paquet (menu Démarrer, alias d'exécution…), pas à l'exécutable lancé directement par son chemin.

## Décision

- Le paquet déclare un **alias d'exécution** (`windows.appExecutionAlias`, `build/store/extensions-appx.xml`) : `simulateur-independant-fr.exe`. Windows le crée dans `%LOCALAPPDATA%\Microsoft\WindowsApps\`, un chemin **stable** d'une version à l'autre, déjà dans le `PATH`. Un process lancé par l'alias reçoit l'identité du paquet, donc **la même vue du dossier de données que l'application**, et hérite des variables d'environnement (`ELECTRON_RUN_AS_NODE`) et de l'entrée et la sortie standard du client, comme les autres outils en ligne de commande du Store (Python, winget).
- Au démarrage, l'application de la version du Store **copie le serveur MCP** livré dans son dossier de données : `<dossier de données>\mcp\serveur-mcp.mjs` (`src/backend/copie-du-serveur-mcp.ts`), seulement s'il a changé, par un fichier temporaire renommé. Le chemin reste le même après une mise à jour ; la copie suit la version installée dès le premier lancement qui suit.
- La configuration donnée au client (`infosDeLInstallation`, `src/lib/configuration-mcp.ts`) devient, pour la version du Store (`process.windowsStore`) :

  ```json
  {
    "command": "C:\\Users\\Camille\\AppData\\Local\\Microsoft\\WindowsApps\\simulateur-independant-fr.exe",
    "args": ["C:\\Users\\Camille\\AppData\\Roaming\\simulateur-independant-fr\\mcp\\serveur-mcp.mjs", "--donnees", "C:\\Users\\Camille\\AppData\\Roaming\\simulateur-independant-fr"],
    "env": { "ELECTRON_RUN_AS_NODE": "1" }
  }
  ```

  Les chemins de `args` sont ceux que voit un process du paquet ; lancé par l'alias, le serveur les retrouve dans la vue fusionnée. La fenêtre « Utiliser avec une IA (MCP) » le dit, et rappelle où réactiver l'alias s'il a été désactivé (Paramètres > Applications > Paramètres avancés des applications > Alias d'exécution d'application).
- L'installation classique (NSIS, zip) ne change pas.

### Alternatives écartées

- **Le chemin réel de l'exécutable** (`app.getPath("exe")`) : il change à chaque mise à jour, et le process lancé ainsi, sans identité de paquet, ne voit pas les fichiers redirigés.
- **Désactiver la redirection** (`desktop6:FileSystemWriteVirtualization` à `disabled`, capacité restreinte `unvirtualizedResources`) : les données resteraient dans le vrai `%APPDATA%`, partagées avec l'installation classique, mais c'est une capacité restreinte de plus à justifier à la certification, et un manifeste personnalisé à maintenir (`appx.customManifestPath`). Gardée comme solution de repli.
- **Charger le serveur par `-e`** (`import()` d'un chemin calculé depuis `process.execPath`) : pas de copie, mais une commande illisible dans la configuration, et le serveur lirait des arguments décalés.
- **Pas de serveur MCP dans la version du Store** : possible si l'essai échoue (voir plus bas), au prix d'une fonction de moins que l'installation classique.

## Conséquences

- **Positives :**
  - La configuration copiée une fois reste valable après les mises à jour du Store.
  - Le serveur et l'application voient le même dossier de données, sans capacité restreinte de plus que `runFullTrust`.
  - Logique testée sans Windows (`configuration-mcp.test.ts`, `copie-du-serveur-mcp.test.ts`) ; la cohérence entre l'alias déclaré et celui de la configuration est vérifiée par `scripts/configuration-des-executables.test.mjs`.
- **Négatives ou compromis :**
  - Une copie du serveur (environ 1 Mo) dans le dossier de données ; entre une mise à jour et le lancement suivant de l'application, le client d'IA lance encore l'ancienne copie.
  - Les données de la version du Store ne sont pas visibles, pour leur partie redirigée, depuis l'explorateur au chemin `%APPDATA%` ; Windows supprime `LocalCache` à la désinstallation (signalé dans les mentions légales).
  - Un utilisateur peut désactiver l'alias dans les paramètres de Windows : le serveur ne démarre plus, la fenêtre l'explique.

## À vérifier

Rien de ce qui précède n'a encore été essayé sur un paquet installé : l'installer en local demande le mode développeur de Windows (marche à suivre dans [publier-sur-le-store.md](../microsoft-store/publier-sur-le-store.md#2-essayer-le-paquet-avant-la-première-soumission)). Points à confirmer avant la première soumission :

1. Claude Desktop lance le serveur par l'alias : les outils apparaissent, `ELECTRON_RUN_AS_NODE` est bien transmis, l'entrée et la sortie standard passent par l'alias.
2. Le serveur lit la session enregistrée par l'application (redirection commune).
3. Une proposition envoyée par l'IA s'affiche dans l'application ouverte (`fs.watch` sur le dossier redirigé) ; à défaut, au lancement suivant.
4. Après une mise à jour du paquet, la configuration copiée fonctionne toujours.

Si le point 1 ou 2 échoue : essayer la solution de repli (redirection désactivée), sinon retirer la section « Utiliser avec une IA » de la version du Store (`infosDuServeurMcp` renvoie `null` quand `process.windowsStore`) et le dire dans la fiche du Store, en gardant le serveur MCP pour l'installation classique.
