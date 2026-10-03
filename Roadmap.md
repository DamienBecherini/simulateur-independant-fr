# Roadmap de Développement Détaillée v2.2

- **Dernière mise à jour :** 09/11/2025

## **État Actuel du Projet**

## La base technique et l'UX de base sont fonctionnelles. Le projet a été rendu "pare-balles" grâce à l'intégration de schémas de validation (Zod) et d'un système de feedback utilisateur non-intrusif. Les fondations sont maintenant extrêmement solides pour construire les fonctionnalités de simulation.

### **Phase 1 & 2.5 : Socle Technique & UX de Base [Terminé ✅]**

- Logique de calcul, IPC, gestion des entités (CRUD, D&D), et système de sauvegarde/import/export sont en place.

---

### **Phase 3 : Les Fondations du Graphe [Terminé ✅]**

- Le modèle de données et l'interface utilisateur permettent de gérer un graphe d'entités et de relations (création, édition, suppression).

---

### **Phase 4 : Robustesse, Pérennité & Feedback Utilisateur [Terminé ✅]**

**Objectif :** Rendre l'application "pare-balles" en matière de gestion de données et améliorer la communication avec l'utilisateur.

1.  **Action 4.1 à 4.4 : Intégration de la validation Zod et des notifications :** [✅]
    - Intégration de **Zod** comme "source de vérité" pour tous les types de données, garantissant une cohérence parfaite entre le code et la structure des sauvegardes.
    - Mise en place d'un **"data sanitizer"** qui valide et répare automatiquement les fichiers importés ou chargés, assurant la pérennité des données de l'utilisateur sur le long terme.
    - Implémentation d'un système de **notifications** (toasts via "Sonner") pour informer l'utilisateur des actions en arrière-plan (sauvegarde réussie, import avec corrections, etc.).

---

### **Phase 5 : La Grille Visuelle Interactive [Terminé ✅]**

**Objectif :** Transformer la grille de saisie numérique en un tableau de bord visuel qui offre un aperçu instantané de la composition et de la comparaison des flux financiers pour chaque entité.

1.  **Action 5.1 à 5.4 : Implémentation de la Grille Visuelle :** [✅]
    - Le composant `CellChartDisplay` affiche des barres verticales pour les gains et dépenses.
    - L'échelle est unifiée par ligne d'entité pour permettre une comparaison visuelle juste.
    - La légende des flux (`FlowLegend`) est dynamique et assigne un numéro unique à chaque type de flux.
    - Les numéros de la légende sont reportés au-dessus des barres dans la grille pour une identification claire et accessible.

---

### **Phase 5.5 : Corrections & Améliorations de l'UX [À FAIRE 🎯 - NOUVELLE PRIORITÉ]**

**Objectif :** Résoudre les problèmes fonctionnels et les bugs identifiés lors de l'utilisation de la grille et de la gestion des sauvegardes pour rendre l'expérience fluide et complète.

1.  **Action 5.5.1 : Enrichir et Clarifier les Types de Dépenses Disponibles :**

    - **Problème :** Les types de flux de dépenses disponibles sont trop restrictifs. Il est impossible pour une personne physique ou une micro-entreprise d'enregistrer une sortie d'argent, ce qui bloque la simulation de leur trésorerie réelle.

    - **Clarification (suite à l'analyse) :** Une distinction sémantique cruciale doit être faite. Le régime de la micro-entreprise étant forfaitaire, ses dépenses réelles ne sont **pas déductibles** de son assiette fiscale (contrairement à une société à l'IS). Le type `deductible_expense` est donc sémantiquement incorrect pour ce statut. Il faut utiliser le type `expense` pour représenter une sortie de trésorerie sans avantage fiscal, à la fois pour les personnes et les micro-entreprises.

    - **Plan d'action :**

      - **Étape 1 (Clarification) :** Renommer le libellé du type de flux `expense` de `"Dépense (Test)"` à `"Dépense (non déductible)"` dans les dictionnaires de l'interface (`flowTypeLabels`) pour le rendre non ambigu pour l'utilisateur.
      - **Étape 2 (Logique) :** Mettre à jour la logique du composant `src/ui/components/EditFlowModal.tsx`. Le `useMemo` qui calcule `availableFlowTypes` doit être modifié pour inclure :
        - `expense` (Dépense non déductible) pour les entités de type `Person`.
        - `expense` (Dépense non déductible) pour les entités de type `MicroEntreprise`.
        - `deductible_expense` (Charge déductible) doit rester disponible **uniquement** pour les entités de type `Company` (SASU/EURL).

    - **Résultat attendu :** L'utilisateur est guidé vers le bon type de saisie en fonction du statut juridique, rendant la simulation plus précise et pédagogique.

2.  **Action 5.5.2 : Agréger les Barres par Type de Flux :**

    - **Problème :** Si un utilisateur ajoute deux gains du même type (ex: deux salaires) dans le même mois, la grille affiche actuellement deux barres distinctes côte à côte. Le comportement attendu est que ces deux montants soient additionnés et représentés par une seule barre plus haute.
    - **Plan d'action :** Refondre la logique d'agrégation dans le `useMemo` du composant `src/ui/components/MonthlyGrid.tsx`. Pour chaque cellule, au lieu d'itérer sur les flux et de créer un segment par flux, il faudra d'abord regrouper les flux par `type`, sommer leurs `amount`, puis créer un seul `FlowSegment` par type.

3.  **Action 5.5.3 : Corriger la Logique de Sauvegarde "Écraser vs. Créer" :**
    - **Problème :** Si on charge un slot, qu'on modifie le nom de la session dans le panneau latéral, puis qu'on clique sur "Sauvegarder", le système propose d'écraser un ancien slot qui porterait ce nouveau nom, au lieu de créer un nouveau slot. Renommer une session devrait "casser" le lien avec son slot d'origine et indiquer une intention de "Sauvegarder sous...".
    - **Plan d'action :**
      - **Étape 1 :** Dans le hook `useSessionManager`, ajouter un état pour mémoriser l'ID du slot qui a été chargé (ex: `loadedSlotId: string | null`). Cet ID est mis à jour lors d'un `handleLoadSlot` et réinitialisé à `null` lors d'un `handleResetSession` ou d'un import.
      - **Étape 2 :** Dans `SettingsSheet.tsx`, la logique de la fonction `handleSave` doit être modifiée. Au lieu de juste chercher un slot par son nom, elle devra vérifier si `loadedSlotId` existe ET si le `currentSession.name` n'a pas changé. Si le nom a changé ou s'il n'y a pas de `loadedSlotId`, la sauvegarde doit être traitée comme une création de nouveau slot (en vérifiant les conflits de nom comme maintenant).

---

### **Phase 6 : Le Moteur de Méta-Simulation v2 [Planifié 🗓️]**

**Objectif :** Orchestrer les calculs en interprétant le graphe d'entités et la grille de flux.

1.  **Action 6.1 :** Refondre la fonction `runSimulation` dans `main.ts`. Cette fonction devra :
    - Agréger les 12 mois de flux de `monthlyData` pour chaque entité afin d'obtenir les totaux annuels (CA total, charges totales, rémunération totale...).
    - Utiliser le tableau `relationships` pour router les flux (ex: la "Rémunération" de la SASU devient un revenu pour la personne qui a la relation "Président").
    - Préparer l'objet `SimulationInputs` pour chaque module de calcul (`simulerSASU`, `simulerEURL`...) avec les données agrégées.
    - Calculer l'impôt sur le revenu au niveau du foyer fiscal.
2.  **Action 6.2 :** Créer un composant `Results.tsx` qui affiche un premier tableau de résultats synthétiques (Net dans la poche par personne, impôts...).

---

### **Phase 7 : L'Optimisation Visuelle (Rémunération/Dividendes) [Planifié 🗓️]**

- **Objectif :** Implémenter la fonctionnalité interactive d'arbitrage pour les sociétés à l'IS (reprise de l'ancienne Phase 5).

---

### **Phase 8 : La Simulation de Couple & Foyers Fiscaux [Planifié 🗓️]**

- **Objectif :** Gérer la fiscalité du foyer en utilisant les relations de type "Marié(e)" / "PACSé(e)" pour regrouper les revenus avant le calcul de l'IR.

---

### **Phase 9 : Le Comparateur Stratégique (Entité "???") [Planifié 🗓️]**

- **Objectif :** Réintégrer la fonctionnalité phare de la v1 en s'appuyant sur le nouveau moteur.

---

### **Phase 10 : Scénarios Avancés & Finalisation [Planifié 🗓️]**

- **Objectif :** Intégrer la gestion de l'ACRE, du VFL, du prorata temporis, et préparer la distribution de l'application.
