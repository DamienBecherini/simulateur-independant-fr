# **Cahier des Charges & Roadmap Stratégique v2.1**

- **Projet :** Simulateur Indépendant FR
- **Date de référence :** 22/09/2025
- **Mission :** Devenir l'assistant prévisionnel de référence pour les indépendants et les foyers en France, permettant de modéliser des scénarios financiers, juridiques et fiscaux complexes de manière simple et pédagogique.

---

## **Partie I : Vision & Principes Fondamentaux**

1.  **De Comparateur à Modélisateur de Scénarios :** L'outil évolue d'un simple comparateur vers un véritable bac à sable (`sandbox`) financier. L'utilisateur ne remplit plus un formulaire, il construit un modèle de sa réalité professionnelle et personnelle.
2.  **Architecture en Graphe :** Le cœur du système est un graphe d'objets. L'utilisateur crée des briques fondamentales (les "nœuds" : Personnes, Sociétés) et établit des liens entre elles (les "arêtes" : Gérant, Président, Salarié). C'est ce graphe qui permet au simulateur de comprendre les flux financiers.
3.  **Identification Visuelle :** Pour faciliter la navigation dans des simulations complexes, chaque entité est identifiable visuellement par un avatar (initiales pour les personnes, icônes pour les sociétés) et une couleur personnalisable.
4.  **Confidentialité Absolue :** L'application reste 100% hors-ligne. Aucune donnée ne quitte la machine de l'utilisateur.
5.  **Pédagogie Interactive & Saisie Contextuelle :** Les résultats sont visuels (graphiques, curseurs). La saisie des données est intelligente : l'interface propose des options pertinentes en fonction de l'entité sélectionnée (le Chiffre d'Affaires pour une société, l'ARE pour une personne).
6.  **Maintenabilité :** Tous les taux, seuils et barèmes légaux sont externalisés dans un fichier de configuration unique pour faciliter les mises à jour annuelles.

---

## **Partie II : Architecture & Stack Technique**

- **Application de Bureau :** **Electron** pour une distribution multi-plateforme et un fonctionnement hors-ligne.
- **Interface Utilisateur (Frontend) :**
  - **Framework :** **React** avec **TypeScript** pour la robustesse et la modularité.
  - **Build Tool :** **Vite** pour un développement quasi-instantané.
  - **Styling :** **TailwindCSS** et **ShadCN/UI** pour une interface moderne et accessible.
- **Processus Principal (Backend) :** **Node.js** (via Electron) pour gérer la logique métier, les calculs et la persistance des données.

---

## **Partie III : Modèle de Données Central**

L'état de l'application (`SessionState`) est structuré comme un graphe d'objets :

1.  **`entities` (Tableau de Nœuds) :** La liste de tous les acteurs de la simulation.
    - **Type `Person` :** Représente une personne physique. Propriétés : `id`, `name`, `fiscalParts`, `avatar: { type: 'initials', value: 'NP', color: '#3b82f6' }`.
    - **Type `Company` :** Représente une personne morale. Propriétés : `id`, `name`, `legalStatus`, `avatar: { type: 'icon', value: 'briefcase', color: '#ef4444' }`.
2.  **`relationships` (Tableau d'Arêtes) :** Décrit les liens entre les entités, qui sont la clé de la simulation.
    - **Structure :** `{ id, fromId, toId, type }`
    - **Exemples :** `{ fromId: 'person-1', toId: 'company-1', type: 'Président' }`, `{ fromId: 'person-2', toId: 'person-1', type: 'Marié(e)' }`.
3.  **`monthlyData` (Grille de Flux) :** Le tableau de 12 objets (mois) contenant les flux financiers.
    - Chaque flux est un objet avec un `id`, `label`, `amount`, et surtout, l'**`entityId`** auquel il est rattaché et un **`flowType`** précis (`ca_services`, `deductible_expense`, `director_remuneration`, `are`...) qui détermine son traitement fiscal et social.