# **Cahier des Charges & Roadmap Stratégique v2.0**

- **Projet :** Simulateur Indépendant FR
- **Date de référence :** 21/09/2025
- **Mission :** Devenir l'assistant prévisionnel de référence pour les indépendants et les foyers en France, permettant de simuler des scénarios financiers, juridiques et fiscaux complexes de manière simple et pédagogique.

---

## **Partie I : Vision & Principes Fondamentaux**

1.  **De Comparateur à Simulateur Opérationnel :** L'outil passe d'un simple comparateur de statuts à un véritable bac à sable (`sandbox`) financier, capable de modéliser des carrières et des foyers complexes mois par mois.
2.  **Architecture "Lego" :** Le cœur du système est basé sur des briques fondamentales (Personnes, Sociétés) que l'utilisateur peut créer, lier et configurer pour refléter sa réalité.
3.  **Confidentialité Absolue :** L'application reste 100% hors-ligne. Aucune donnée ne quitte la machine de l'utilisateur.
4.  **Pédagogie Interactive :** Les résultats ne sont pas juste des chiffres. Des outils visuels (graphiques, curseurs) aident l'utilisateur à comprendre les mécanismes d'optimisation.
5.  **Maintenabilité :** Tous les taux, seuils et barèmes légaux sont externalisés dans un fichier de configuration unique pour faciliter les mises à jour annuelles.

---

## **Partie II : Architecture & Stack Technique**

- **Application de Bureau :** **Electron** pour une distribution multi-plateforme (Windows, macOS, Linux) et un fonctionnement hors-ligne.
- **Interface Utilisateur (Frontend) :**
  - **Framework :** **React** pour une gestion d'état complexe et une interface modulaire à base de composants.
  - **Langage :** **TypeScript** pour la robustesse, la sécurité des types et une meilleure expérience de développement.
  - **Build Tool :** **Vite** pour un développement quasi-instantané.
  - **Styling :** **TailwindCSS** et **ShadCN/UI** pour construire rapidement une interface moderne, responsive et accessible.
- **Processus Principal (Backend) :** **Node.js** (via Electron) pour gérer la logique métier, les calculs et la persistance des données.

---

## **Partie III : Modèle de Données Central**

L'état de l'application (`appState`) ne sera plus un simple formulaire, mais un graphe d'objets structuré comme suit :

1.  **`entities` (Tableau d'objets) :** La liste de tous les acteurs de la simulation.
    - **Type `person` :** Représente une personne physique. Propriétés : nom, parts fiscales, droits ARE (montant, durée), etc.
    - **Type `company` :** Représente une personne morale. Propriétés : nom, statut juridique (SASU, EURL...), capital social, etc.
2.  **`relationships` (Tableau d'objets) :** Décrit les liens entre les entités.
    - Exemple : `{ from: 'person-id-1', to: 'company-id-1', type: 'Gérant' }`, `{ from: 'person-id-1', to: 'person-id-2', type: 'Marié(e)' }`.
3.  **`monthlyGrid` (Tableau de 12 objets) :** Le cœur de la saisie. Chaque objet représente un mois et contient des tableaux de flux financiers.
    - Chaque flux (revenu, dépense, salaire) est un objet avec un libellé, un montant, un type, et surtout, l'**`entityId`** auquel il est rattaché.
