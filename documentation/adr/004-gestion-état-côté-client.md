# ADR-004: Gestion de l'État Côté Client (Hook Personnalisé)

- **Date :** 2025-11-08
- **Statut :** Accepté

## Contexte

Une application React complexe comme ce simulateur nécessite une stratégie de gestion de l'état ("state management") claire. Les besoins spécifiques du projet incluent :

1.  La possibilité d'annuler et de rétablir des actions (Undo/Redo).
2.  Un mécanisme de sauvegarde automatique qui ne se déclenche pas à chaque modification de l'état (pour des raisons de performance), mais après un court délai d'inactivité (debounce).

## Décision

Plutôt que d'intégrer une bibliothèque de gestion d'état externe (comme Redux, Zustand, etc.), la décision a été prise de développer un **hook React personnalisé, `useSessionManager`**.

Ce hook centralise toute la logique de l'état de la session et implémente les fonctionnalités requises de manière sur-mesure :

1.  **Historique pour Undo/Redo :** Le hook maintient un état interne `{ past: [], present: SessionState, future: [] }`. Chaque modification de l'état par l'utilisateur pousse l'état précédent dans `past` et vide `future`. Les fonctions `undo` et `redo` naviguent simplement dans cet historique.
2.  **Sauvegarde Décalée :** Pour éviter que l'auto-sauvegarde ne se déclenche sur un `undo` ou un `redo`, le hook gère un état séparé, `sessionForSaving`. Cet état n'est mis à jour que lors des actions directes de l'utilisateur. C'est cet état qui est observé par le hook `useDebouncedSave` pour déclencher l'écriture sur le disque.

## Conséquences

- **Positives :**

  - **Zéro Dépendance Externe :** L'application reste légère et n'est pas liée à l'écosystème ou aux futures évolutions d'une bibliothèque tierce.
  - **Solution Ciblée :** Le code est minimaliste et fait exactement ce dont le projet a besoin, sans aucune complexité superflue.
  - **Contrôle Total :** La logique est entièrement maîtrisée, facile à comprendre dans le contexte du projet et simple à modifier si de nouveaux besoins spécifiques émergent.

- **Négatives ou Compromis :**
  - **Absence d'Outils de Débogage Avancés :** Nous renonçons aux outils spécialisés comme les Redux DevTools, qui permettent de voyager dans le temps et d'inspecter l'état. Le débogage se fait avec les outils standards de React.
  - **Ré-implémentation d'un Pattern Connu :** La logique de l'historique est un problème déjà résolu par de nombreuses bibliothèques. Nous la ré-implémentons ici, ce qui est un choix conscient en faveur de la simplicité et de l'autonomie.
  - **Moins Adapté à une Très Grande Complexité :** Si l'état de l'application devait grandir de manière exponentielle avec de nombreuses logiques asynchrones complexes, cette solution pourrait devenir plus difficile à maintenir qu'une bibliothèque structurée.

## Mise à jour (2026-10-10) : le mécanisme du point 2 a été remplacé

Le point 2 de la décision ne décrit plus le code ; il est gardé pour l'histoire. Ce qui est vrai aujourd'hui (`src/ui/hooks/useSessionManager.ts`, `useDebouncedSave.ts`) :

- Il n'y a pas d'état `sessionForSaving`. La sauvegarde automatique observe `history.present` : annuler ou rétablir enregistre aussi la session affichée (le fichier suit l'écran).
- Rien n'est enregistré avant la fin du chargement (`isLoaded`), ni pour la session tout juste chargée : la session vierge provisoire ne peut pas remplacer celle du disque (ADR 005, « Robustesse de l'écriture », point 6).
- À la fermeture de la fenêtre (`beforeunload`), la session et les préférences sont enregistrées de façon synchrone (`saveCurrentSessionSync`), pour ne pas perdre la dernière seconde.
- Les réglages du comparateur sont dans la session mais hors de l'historique d'annulation (`setComparateur`, ADR 009) ; l'année affichée est un état de l'interface (ADR 008) ; les préférences (zoom, sauvegarde chargée, sections ouvertes) ont leur propre sauvegarde différée (ADR 002).
