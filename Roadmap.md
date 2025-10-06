# Roadmap de Développement Détaillée v2.2
- **Dernière mise à jour :** 22/09/2025

## **État Actuel du Projet**
La base technique et l'UX de base sont fonctionnelles. Une première version d'un système de nettoyage de données a été implémentée, mais nécessite d'être pérennisée pour garantir une robustesse à toute épreuve. La priorité est désormais de consolider ces fondations avant d'ajouter de nouvelles fonctionnalités de simulation.
---

### **Phase 1 & 2.5 : Socle Technique & UX de Base [Terminé ✅]**

*   Logique de calcul, IPC, gestion des entités (CRUD, D&D), et système de sauvegarde/import/export sont en place.

---

### **Phase 3 : Les Fondations du Graphe [Terminé ✅]**

**Objectif :** Mettre en place la structure de données et l'interface utilisateur pour gérer un graphe d'entités et de relations, la nouvelle pierre angulaire du simulateur.

1.  **Action 3.1 :** Mettre à jour le modèle de données central dans `types.d.ts` pour inclure les `relationships`, le type `Avatar`, et des `flowType` plus précis pour les flux financiers.
2.  **Action 3.2 :** Adapter le backend (`main.ts`) et l'état principal du frontend (`App.tsx`) pour initialiser, sauvegarder et charger ce nouveau modèle de données complet (`entities`, `relationships`, `monthlyData`).
3.  **Action 3.3 :** Faire évoluer `EditEntityModal.tsx` pour permettre la sélection d'un avatar (icône/couleur) pour chaque entité.
4.  **Action 3.4 :** Créer l'interface de gestion des relations. Cela pourrait être une nouvelle modale ou une section dans le `EntitiesManager` permettant de créer un lien (`Président`, `Gérant`, etc.) entre une personne et une société.


### **Phase 4 : Robustesse, Pérennité & Feedback Utilisateur [À FAIRE 🎯 - NOUVELLE PRIORITÉ]**

**Objectif :** Rendre l'application "pare-balles" en matière de gestion de données et améliorer la communication avec l'utilisateur.

1.  **Action 4.1 : Intégration de Zod comme Source de Vérité :**
    *   Remplacer toutes les interfaces manuelles dans `types.d.ts` par des schémas de validation Zod (`PersonSchema`, `SessionSchema`, etc.).
    *   Déduire les types TypeScript de ces schémas (`type Person = z.infer<...>`).
    *   Refondre `data-sanitizer.ts` pour qu'il utilise `Schema.safeParse()` au lieu de la logique de validation manuelle. Utiliser `.default()` dans les schémas pour réparer automatiquement les données incomplètes.

2.  **Action 4.2 : Versionnage des Sauvegardes :**
    *   Ajouter un champ `appVersion: string` dans le schéma de la `SessionState`.
    *   Mettre à jour les fonctions de sauvegarde pour injecter la version actuelle de l'application (depuis `package.json`).
    *   Adapter le sanitizer pour qu'il vérifie ce champ de version, lui permettant de rejeter les formats trop anciens ou d'appliquer des logiques de migration spécifiques à l'avenir.

3.  **Action 4.3 : Implémentation du Système de Notifications (Sonner) :**
    *   Installer la bibliothèque `sonner`.
    *   Créer un `NotificationProvider` React avec un contexte pour rendre la fonctionnalité de notification accessible globalement.
    *   Créer le pont de communication IPC (`onShowNotification`) entre le backend et le frontend pour permettre au processus principal de déclencher des toasts.

4.  **Action 4.4 : Utilisation des Notifications Contextuelles :**
    *   Connecter le système de notifications aux rapports du `data-sanitizer` pour informer l'utilisateur de manière non-intrusive lorsque des sauvegardes sont ignorées ou réparées.
    *   Ajouter des toasts de confirmation pour les actions clés (ex: "Sauvegarde réussie", "Simulation importée avec succès").


### **Phase 5 : La Grille de Saisie Contextuelle [Planifié 🗓️]**

**Objectif :** Remplacer la saisie de test par une expérience utilisateur intelligente et guidée, basée sur le graphe.

1.  **Action 5.1 :** Créer le composant `EditFlowModal.tsx`. Cette modale permettra d'ajouter ou de modifier un flux financier.
2.  **Action 5.2 :** Implémenter la logique contextuelle dans la modale :
    -   L'utilisateur choisit d'abord l'entité source (ex: "Ma SASU").
    -   Une deuxième liste déroulante s'affiche avec les types de flux pertinents pour une société (Chiffre d'Affaires, Dépense, Rémunération...).
    -   L'utilisateur choisit l'entité source "Moi-même", la liste propose alors "ARE", "Salaire Tiers", "Autre Revenu Imposable", etc.
3.  **Action 5.3 :** Mettre à jour `MonthlyGrid.tsx` pour afficher les flux saisis de manière détaillée (par exemple, en cliquant sur une case pour voir le détail des flux du mois) et pour appeler la modale `EditFlowModal.tsx`.

### **Phase 6 : Le Moteur de Méta-Simulation v2 [Planifié 🗓️]**

**Objectif :** Orchestrer les calculs en interprétant le graphe d'entités et la grille de flux.

1.  **Action 6.1 :** Refondre la fonction `runSimulation` dans `main.ts`. Cette fonction devra :
    -   Agréger les 12 mois de flux de `monthlyData` pour chaque entité afin d'obtenir les totaux annuels (CA total, charges totales, rémunération totale...).
    -   Utiliser le tableau `relationships` pour router les flux (ex: la "Rémunération" de la SASU devient un revenu pour la personne qui a la relation "Président").
    -   Préparer l'objet `SimulationInputs` pour chaque module de calcul (`simulerSASU`, `simulerEURL`...) avec les données agrégées.
    -   Calculer l'impôt sur le revenu au niveau du foyer fiscal.
2.  **Action 6.2 :** Créer un composant `Results.tsx` qui affiche un premier tableau de résultats synthétiques (Net dans la poche par personne, impôts...).

### **Phase 7 : L'Optimisation Visuelle (Rémunération/Dividendes) [Planifié 🗓️]**

*   **Objectif :** Implémenter la fonctionnalité interactive d'arbitrage pour les sociétés à l'IS (reprise de l'ancienne Phase 5).

### **Phase 8 : La Simulation de Couple & Foyers Fiscaux [Planifié 🗓️]**

*   **Objectif :** Gérer la fiscalité du foyer en utilisant les relations de type "Marié(e)" / "PACSé(e)" pour regrouper les revenus avant le calcul de l'IR.

### **Phase 9 : Le Comparateur Stratégique (Entité "???") [Planifié 🗓️]**

*   **Objectif :** Réintégrer la fonctionnalité phare de la v1 en s'appuyant sur le nouveau moteur.

### **Phase 10 : Scénarios Avancés & Finalisation [Planifié 🗓️]**

*   **Objectif :** Intégrer la gestion de l'ACRE, du VFL, du prorata temporis, et préparer la distribution de l'application.