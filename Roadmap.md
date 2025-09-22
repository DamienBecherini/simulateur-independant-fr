# Roadmap de Développement Détaillée v2.2
- **Dernière mise à jour :** 22/09/2025

## **État Actuel du Projet**
La base technique (Electron/React/TS), le système de gestion de données (session/slots), et l'UX de base (gestionnaire d'entités simple, splash screen) sont fonctionnels et robustes. Le projet est prêt à intégrer sa logique de modélisation avancée.

---

### **Phase 1 & 2.5 : Socle Technique & UX de Base [Terminé ✅]**

*   Logique de calcul, IPC, gestion des entités (CRUD, D&D), et système de sauvegarde/import/export sont en place.

---

### **Phase 3 : Les Fondations du Graphe [À FAIRE ⏳]**

**Objectif :** Mettre en place la structure de données et l'interface utilisateur pour gérer un graphe d'entités et de relations, la nouvelle pierre angulaire du simulateur.

1.  **Action 3.1 :** Mettre à jour le modèle de données central dans `types.d.ts` pour inclure les `relationships`, le type `Avatar`, et des `flowType` plus précis pour les flux financiers.
2.  **Action 3.2 :** Adapter le backend (`main.ts`) et l'état principal du frontend (`App.tsx`) pour initialiser, sauvegarder et charger ce nouveau modèle de données complet (`entities`, `relationships`, `monthlyData`).
3.  **Action 3.3 :** Faire évoluer `EditEntityModal.tsx` pour permettre la sélection d'un avatar (icône/couleur) pour chaque entité.
4.  **Action 3.4 :** Créer l'interface de gestion des relations. Cela pourrait être une nouvelle modale ou une section dans le `EntitiesManager` permettant de créer un lien (`Président`, `Gérant`, etc.) entre une personne et une société.

### **Phase 4 : La Grille de Saisie Contextuelle [Planifié 🗓️]**

**Objectif :** Remplacer la saisie de test par une expérience utilisateur intelligente et guidée, basée sur le graphe.

1.  **Action 4.1 :** Créer le composant `EditFlowModal.tsx`. Cette modale permettra d'ajouter ou de modifier un flux financier.
2.  **Action 4.2 :** Implémenter la logique contextuelle dans la modale :
    -   L'utilisateur choisit d'abord l'entité source (ex: "Ma SASU").
    -   Une deuxième liste déroulante s'affiche avec les types de flux pertinents pour une société (Chiffre d'Affaires, Dépense, Rémunération...).
    -   L'utilisateur choisit l'entité source "Moi-même", la liste propose alors "ARE", "Salaire Tiers", "Autre Revenu Imposable", etc.
3.  **Action 4.3 :** Mettre à jour `MonthlyGrid.tsx` pour afficher les flux saisis de manière détaillée (par exemple, en cliquant sur une case pour voir le détail des flux du mois) et pour appeler la modale `EditFlowModal.tsx`.

### **Phase 5 : Le Moteur de Méta-Simulation v2 [Planifié 🗓️]**

**Objectif :** Orchestrer les calculs en interprétant le graphe d'entités et la grille de flux.

1.  **Action 5.1 :** Refondre la fonction `runSimulation` dans `main.ts`. Cette fonction devra :
    -   Agréger les 12 mois de flux de `monthlyData` pour chaque entité afin d'obtenir les totaux annuels (CA total, charges totales, rémunération totale...).
    -   Utiliser le tableau `relationships` pour router les flux (ex: la "Rémunération" de la SASU devient un revenu pour la personne qui a la relation "Président").
    -   Préparer l'objet `SimulationInputs` pour chaque module de calcul (`simulerSASU`, `simulerEURL`...) avec les données agrégées.
    -   Calculer l'impôt sur le revenu au niveau du foyer fiscal.
2.  **Action 5.2 :** Créer un composant `Results.tsx` qui affiche un premier tableau de résultats synthétiques (Net dans la poche par personne, impôts...).

### **Phase 6 : L'Optimisation Visuelle (Rémunération/Dividendes) [Planifié 🗓️]**

*   **Objectif :** Implémenter la fonctionnalité interactive d'arbitrage pour les sociétés à l'IS (reprise de l'ancienne Phase 5).

### **Phase 7 : La Simulation de Couple & Foyers Fiscaux [Planifié 🗓️]**

*   **Objectif :** Gérer la fiscalité du foyer en utilisant les relations de type "Marié(e)" / "PACSé(e)" pour regrouper les revenus avant le calcul de l'IR.

### **Phase 8 : Le Comparateur Stratégique (Entité "???") [Planifié 🗓️]**

*   **Objectif :** Réintégrer la fonctionnalité phare de la v1 en s'appuyant sur le nouveau moteur.

### **Phase 9 : Scénarios Avancés & Finalisation [Planifié 🗓️]**

*   **Objectif :** Intégrer la gestion de l'ACRE, du VFL, du prorata temporis, et préparer la distribution de l'application.