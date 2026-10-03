# Guide du Développeur - Simulateur Indépendant FR

Ce document est destiné aux développeurs travaillant sur le projet. Il a pour but d'expliquer l'architecture interne, les flux de données et les concepts clés pour faciliter la maintenance et l'ajout de nouvelles fonctionnalités.

Pour la justification des choix techniques, veuillez vous référer aux **Architectural Decision Records (ADRs)** dans le dossier `/documentation/adr`.

## Philosophie Générale

Le projet repose sur quelques principes forts :

1.  **Séparation Stricte des Préoccupations :** La logique de l'interface (UI), la logique métier (calculs) et la logique système (accès aux fichiers) sont clairement séparées dans des modules distincts.
2.  **Zod comme Source de Vérité :** Les schémas Zod dans `src/types.ts` ne sont pas de simples validateurs. Ils sont la définition canonique de nos structures de données. Tous les types TypeScript en découlent, garantissant une cohérence parfaite. (Voir ADR-005).
3.  **Sécurité par Conception :** La communication entre l'UI et le système est minimale et explicitement définie via une API sécurisée. (Voir ADR-003).
4.  **État Côté Client Maîtrisé :** L'état de l'application est géré par un hook React sur-mesure pour répondre précisément aux besoins du projet (Undo/Redo, sauvegarde décalée). (Voir ADR-004).

---

## 1. Le Modèle de Données Central (`SessionState`)

Le cœur de l'application est l'objet `SessionState`, défini dans `src/types.ts`. Il ne s'agit pas d'une simple structure de données, mais d'un **graphe** qui modélise la réalité de l'utilisateur.

- **`entities` (les Nœuds) :** Un tableau contenant tous les acteurs de la simulation. Chaque entité peut être une `Person`, une `Company` ou une `MicroEntreprise`. C'est là que sont stockées les propriétés intrinsèques (nom, statut juridique, parts fiscales, etc.).

- **`relationships` (les Arêtes) :** Un tableau décrivant les liens entre les entités. Une relation est un simple objet `{ fromId, toId, type }`. C'est ce tableau qui donne son sens au graphe et qui sera utilisé par le moteur de simulation pour router les flux financiers (ex: la "Rémunération" d'une SASU devient un revenu pour la personne qui a la relation "Président").

- **`monthlyData` (les Données) :** Une grille de 12 mois où chaque mois contient un tableau de `FinancialFlow`. Chaque flux est rattaché à une `entityId` et possède un `type` qui définit son traitement fiscal et social.

---

## 2. Architecture en Deux Processus (Electron)

Comme toute application Electron, le simulateur est divisé en deux processus distincts. Comprendre leur rôle est fondamental.

### Le Backend (Processus Main)

- **Rôle :** C'est le cœur de l'application, invisible pour l'utilisateur. Il a accès à toutes les API de Node.js. Il gère la logique "système" et la logique "métier" lourde.
- **Fichiers Clés :**
  - `src/backend/main.ts` : Point d'entrée du processus. Il crée la fenêtre, initialise les "handlers" IPC et gère le cycle de vie de l'application. C'est ici que se trouve la logique de lecture/écriture des fichiers de sauvegarde.
  - `src/backend/logic/` : Ce dossier contient les **moteurs de calcul purs**. Chaque fichier (`calculsSASU.ts`, `calculsIR.ts`, etc.) est une fonction pure qui prend des entrées et retourne des résultats, sans effet de bord.
  - `src/backend/logic/data-sanitizer.ts` : Module de sécurité crucial qui valide et nettoie toutes les données entrantes pour assurer la pérennité des sauvegardes.

### Le Frontend (Processus Renderer)

- **Rôle :** C'est l'interface utilisateur visible, qui s'exécute dans une fenêtre Chromium. Elle n'a **aucun accès** direct aux API Node.js.
- **Fichiers Clés :**
  - `src/ui/App.tsx` : Le composant racine de l'application React. Il orchestre l'affichage de tous les autres composants.
  - `src/ui/hooks/useSessionManager.ts` : Le "cerveau" de l'état de l'application. Il gère l'état actuel (`currentSession`), l'historique pour l'undo/redo, et la logique de sauvegarde décalée. C'est le principal point d'interaction pour les composants qui veulent modifier l'état.
  - `src/ui/components/` : Contient tous les composants React réutilisables qui constituent l'interface.

---

## 3. Le Flux de Données Complet (Le Cycle de Vie d'une Action)

Pour bien comprendre comment les pièces s'emboîtent, suivons une action simple : **la sauvegarde manuelle de la session**.

1.  **UI (Composant) :** L'utilisateur clique sur le bouton "Sauvegarder" dans `SettingsSheet.tsx`.
2.  **Appel de la Logique Client :** Le `onClick` du bouton appelle la fonction `handleSave()`. Cette fonction utilise les données de `currentSession` pour créer un `SaveSlot`.
3.  **Appel de l'API IPC :** `handleSave()` appelle ensuite une fonction du service `SessionService.saveAllSlots(updatedSlots)`.
4.  **Pont Sécurisé :** `SessionService` appelle `window.api.saveSlots(slots)`. Cette fonction n'existe pas nativement ; elle est exposée de manière sécurisée par le script de preload.
5.  **Script de `preload` :** Le fichier `src/backend/preload.cts` reçoit l'appel et le relaie au processus Main via `ipcRenderer.invoke('saveSlots', slots)`.
6.  **Handler IPC (Backend) :** Dans `src/backend/main.ts`, le handler `ipcMain.handle('saveSlots', ...)` est déclenché.
7.  **Logique Système (Backend) :** Ce handler exécute la fonction `writeSlotsToFile(slots)`, qui utilise `fs.writeFile` de Node.js pour écrire les données sur le disque.
8.  **Retour d'Information (Feedback) :** Après l'écriture, le handler envoie une notification de succès au frontend via `mainWindow.webContents.send('show-notification', ...)`, qui sera interceptée par `NotificationProvider.tsx` pour afficher un toast.

Ce flux garantit que le code de l'interface (Renderer) ne manipule jamais directement les fichiers, préservant ainsi la sécurité et la stabilité de l'application.

---

## 4. Points d'Intérêt Spécifiques du Code

- **`src/lib/entity-factory.ts` :** Pour créer une nouvelle entité, utilisez toujours les fonctions de cette "factory". Elle garantit que chaque nouvelle entité est créée avec une structure valide et des valeurs par défaut cohérentes (ID unique, avatar par défaut, etc.).

- **`src/lib/graph-logic.ts` :** Contient la logique pure pour interroger le graphe. Par exemple, `getAvailableRelationships` permet de savoir quels types de liens on peut créer entre deux entités, en tenant compte des liens déjà existants.

- **`src/lib/business-logic.ts` :** Contient la logique métier qui doit s'exécuter côté client. Par exemple, `sanitizeFlowsAfterRelationshipChange` est utilisé pour nettoyer les flux financiers qui deviennent invalides après la suppression d'une relation (ex: supprimer les flux de "Rémunération" si la relation "Président" est supprimée).
