# Roadmap de Développement Détaillée v2.2
- **Dernière mise à jour :** 22/09/2025

## **État Actuel du Projet**
La base technique et l'UX de base sont fonctionnelles. Le projet a été rendu "pare-balles" grâce à l'intégration de schémas de validation (Zod) et d'un système de feedback utilisateur non-intrusif. Les fondations sont maintenant extrêmement solides pour construire les fonctionnalités de simulation.
---

### **Phase 1 & 2.5 : Socle Technique & UX de Base [Terminé ✅]**

*   Logique de calcul, IPC, gestion des entités (CRUD, D&D), et système de sauvegarde/import/export sont en place.

---

### **Phase 3 : Les Fondations du Graphe [Terminé ✅]**

*   Le modèle de données et l'interface utilisateur permettent de gérer un graphe d'entités et de relations (création, édition, suppression).

---


### **Phase 4 : Robustesse, Pérennité & Feedback Utilisateur [Terminé ✅]**

**Objectif :** Rendre l'application "pare-balles" en matière de gestion de données et améliorer la communication avec l'utilisateur.

1.  **Action 4.1 : Intégration de Zod comme Source de Vérité :** [✅]
    *   Toutes les interfaces de données ont été remplacées par des schémas Zod.
    *   Les types TypeScript sont désormais inférés automatiquement à partir de ces schémas.
    *   `data-sanitizer.ts` a été refondu pour utiliser `Schema.safeParse()` et les `.default()`.

2.  **Action 4.2 : Versionnage des Sauvegardes :** [✅]
    *   Le champ `appVersion` est ajouté au schéma `SessionState`.
    *   Les fonctions de sauvegarde injectent la version actuelle depuis `package.json`.

3.  **Action 4.3 : Implémentation du Système de Notifications (Sonner) :** [✅]
    *   La bibliothèque `sonner` a été installée et configurée.
    *   Un `NotificationProvider` a été créé.
    *   Le pont IPC `onShowNotification` est fonctionnel, avec une fonction de nettoyage pour éviter les doublons.

4.  **Action 4.4 : Utilisation des Notifications Contextuelles :** [✅]
    *   Les notifications sont utilisées lors de l'import de fichiers (avec ou sans correction).
    *   Des toasts de confirmation sont ajoutés pour les sauvegardes manuelles.

### **Phase 5 : La Grille de Saisie Contextuelle [À FAIRE 🎯 - NOUVELLE PRIORITÉ]**

**Objectif :** Remplacer la saisie de test par une expérience utilisateur intelligente et guidée, basée sur le graphe.

1.  **Action 5.1 :** Créer le composant `EditFlowModal.tsx`. Cette modale permettra d'ajouter ou de modifier un flux financier.
2.  **Action 5.2 :** Implémenter la logique contextuelle dans la modale :
    -   L'utilisateur choisit d'abord l'entité source (ex: "Ma SASU").
    -   Une deuxième liste déroulante s'affiche avec les types de flux pertinents pour une société (Chiffre d'Affaires, Dépense, Rémunération...).
    -   Si l'utilisateur choisit l'entité source "Moi-même", la liste propose alors "ARE", "Salaire Tiers", "Autre Revenu Imposable", etc.
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