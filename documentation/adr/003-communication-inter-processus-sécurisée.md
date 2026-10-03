# ADR-003: Communication Inter-Processus (IPC) Sécurisée

- **Date :** 2025-11-08
- **Statut :** Accepté

## Contexte

Dans une application Electron, il existe deux processus principaux : le processus "Main" (qui a accès à toutes les API de Node.js, comme le système de fichiers `fs`) et le processus "Renderer" (qui exécute l'interface utilisateur dans un environnement de type navigateur). Pour des raisons de sécurité, il est impératif d'isoler le Renderer et de ne pas lui donner un accès direct aux API de Node.js.

Cependant, l'interface utilisateur a besoin de déclencher des actions dans le processus Main (par exemple, "sauvegarde ce fichier" ou "lis-moi ce fichier"). Il faut donc un canal de communication sécurisé entre ces deux mondes.

## Décision

Nous avons choisi d'implémenter la communication IPC en utilisant le pattern recommandé par l'équipe d'Electron : le **`contextBridge`** associé à un **script de `preload`**.

1.  Un script `preload.cts` est exécuté dans un contexte qui a accès à la fois au `window` du Renderer et aux API de Node.js.
2.  Ce script utilise `contextBridge.exposeInMainWorld` pour exposer une API sur-mesure et sécurisée sur l'objet `window` du Renderer (sous `window.api`).
3.  Cette API est le seul et unique point de contact entre le frontend et le backend. Elle est fortement typée via un type partagé (`EventPayloadMapping`) pour garantir la cohérence des appels.
4.  Toute la logique sensible (manipulation de fichiers, affichage de boîtes de dialogue système) réside dans le processus Main et est exposée uniquement via des "handlers" IPC (`ipcMain.handle`).

## Conséquences

- **Positives :**

  - **Sécurité Maximale :** Le Renderer est "sandboxé". Il ne peut absolument pas accéder à des modules Node.js dangereux. La surface d'attaque est réduite au strict minimum défini par notre API.
  - **Contrat d'API Clair :** La communication est centralisée et explicitement définie. Le type `EventPayloadMapping` sert de documentation vivante et prévient les erreurs d'intégration entre le front et le back.
  - **Maintenabilité :** La séparation des préoccupations est très claire. Le code de l'UI ne se soucie pas de _comment_ un fichier est sauvegardé, il ne fait qu'appeler `window.api.saveCurrentSession(...)`.

- **Négatives ou Compromis :**
  - **Configuration Initiale :** Cette approche requiert une configuration un peu plus verbeuse qu'une solution non sécurisée (`nodeIntegration: true`). Il faut créer le script `preload`, définir les types, et configurer le `webPreferences` du `BrowserWindow`. C'est un coût initial jugé indispensable pour la sécurité.
