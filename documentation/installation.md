# Installer l'application de bureau

L'application se télécharge depuis la page des versions du dépôt : **[dernière version](https://github.com/DamienBecherini/simulateur-independant-fr/releases/latest)**. Elle fonctionne entièrement hors ligne : aucune donnée ne quitte votre ordinateur.

Pour essayer sans rien installer, la [démo en ligne](https://damienbecherini.github.io/simulateur-independant-fr/) propose la même interface dans le navigateur.

| Votre système | Fichier à télécharger |
|---|---|
| Windows 10 ou 11 | `Simulateur-Independant-FR-<version>-win-x64.exe` (installateur) ou `…-win-x64.zip` (sans installation) |
| Mac Apple Silicon (M1 et suivants) | `Simulateur-Independant-FR-<version>-mac-arm64.dmg` |
| Mac Intel | `Simulateur-Independant-FR-<version>-mac-x64.dmg` |
| Linux | `….AppImage` (toutes distributions) ou `….deb` (Debian, Ubuntu et dérivées) |

Pour savoir si votre Mac est Apple Silicon ou Intel : menu Pomme > « À propos de ce Mac », ligne « Puce » (Apple Silicon) ou « Processeur » (Intel).

## Pourquoi un avertissement s'affiche

L'application n'est pas signée par un certificat payant d'éditeur de logiciels : c'est un projet personnel et gratuit. Windows et macOS ne connaissent donc pas son auteur et affichent un avertissement au premier lancement. Cela ne signifie pas que le fichier est dangereux, mais seulement qu'il n'est pas identifié.

Pour vous assurer que le fichier est bien celui publié sur GitHub, comparez son empreinte avec celle du fichier `SHA256SUMS.txt` de la même version :

- Windows (PowerShell) : `Get-FileHash .\Simulateur-Independant-FR-<version>-win-x64.exe`
- macOS : `shasum -a 256 Simulateur-Independant-FR-<version>-mac-arm64.dmg`
- Linux : `sha256sum Simulateur-Independant-FR-<version>-linux-*.AppImage`

Le code source de chaque version est public, et les exécutables sont construits par GitHub Actions à partir de ce code (workflow « Publication des exécutables »).

## Windows

**Installateur (`.exe`)**

1. Lancez le fichier téléchargé.
2. Si Windows affiche « Windows a protégé votre ordinateur » (SmartScreen), cliquez sur **Informations complémentaires**, puis sur **Exécuter quand même**.
3. Choisissez le dossier d'installation. L'installation se fait pour votre compte seulement, sans droits d'administrateur. Un raccourci est créé dans le menu Démarrer et sur le bureau.

Pour désinstaller : Paramètres > Applications > Applications installées > « Simulateur Indépendant FR » > Désinstaller. Vos simulations sont conservées dans `%APPDATA%\simulateur-independant-fr`.

**Archive (`.zip`)**

Extrayez l'archive dans un dossier (clic droit > « Extraire tout »), puis lancez `Simulateur Indépendant FR.exe`. Le même avertissement SmartScreen peut s'afficher.

**Contrôle intelligent des applications.** Si ce réglage de Windows 11 est activé (Sécurité Windows > Contrôle des applications et du navigateur), il peut bloquer l'application sans proposer de la lancer quand même, car elle n'est pas signée. Il n'existe alors pas d'autre solution que de désactiver ce contrôle, ce que nous ne vous recommandons pas de faire pour cette seule application : utilisez plutôt la [démo en ligne](https://damienbecherini.github.io/simulateur-independant-fr/).

## macOS

1. Ouvrez le fichier `.dmg` et faites glisser « Simulateur Indépendant FR » dans le dossier **Applications**.
2. Lancez l'application depuis le dossier Applications. macOS indique qu'il ne peut pas vérifier le développeur et propose seulement de la placer dans la corbeille : cliquez sur **Terminé** (ou **OK**).
3. Ouvrez **Réglages Système > Confidentialité et sécurité**, descendez jusqu'au message sur « Simulateur Indépendant FR » et cliquez sur **Ouvrir quand même**, puis confirmez avec votre mot de passe.

Sur macOS 14 (Sonoma) et versions antérieures, il suffit de faire un **clic droit** (ou Ctrl + clic) sur l'application dans le dossier Applications, puis de choisir **Ouvrir** et de confirmer.

Ces étapes ne sont nécessaires qu'au premier lancement. Si macOS indique que l'application est « endommagée », ouvrez le Terminal et retirez l'attribut de quarantaine posé au téléchargement :

```sh
xattr -dr com.apple.quarantine "/Applications/Simulateur Indépendant FR.app"
```

## Linux

**AppImage**

Rendez le fichier exécutable, puis lancez-le :

```sh
chmod +x Simulateur-Independant-FR-*.AppImage
./Simulateur-Independant-FR-*.AppImage
```

On peut aussi passer par le gestionnaire de fichiers : clic droit > Propriétés > Permissions > « Autoriser l'exécution du fichier comme un programme ».

Sur Ubuntu 22.04 et suivantes, si rien ne se passe ou qu'un message parle de FUSE, installez la bibliothèque manquante : `sudo apt install libfuse2` (`libfuse2t64` sur Ubuntu 24.04 et suivantes).

**Paquet deb**

```sh
sudo apt install ./Simulateur-Independant-FR-*.deb
```

L'application apparaît ensuite dans le menu des applications (catégorie Bureautique).

## Vos données

Les simulations, sauvegardes et préférences sont enregistrées dans le dossier de données de l'application, jamais envoyées ailleurs :

- Windows : `%APPDATA%\simulateur-independant-fr`
- macOS : `~/Library/Application Support/simulateur-independant-fr`
- Linux : `~/.config/simulateur-independant-fr`

Un client d'IA de bureau (Claude Desktop, LM Studio…) peut lire ce dossier par le serveur MCP de l'application, si vous l'y avez relié : voir [Utiliser le simulateur avec une IA](./utiliser-avec-une-ia.md). Les propositions qu'il dépose y attendent, dans le dossier `propositions`, que vous les appliquiez ou les refusiez.

Une mise à jour de l'application les reprend telles quelles ; les fichiers d'un ancien format sont convertis à l'ouverture, et l'original est copié à côté.

L'application ne se met pas à jour toute seule : pour passer à une nouvelle version, téléchargez-la et installez-la par-dessus l'ancienne.
