# Roadmap de Développement Détaillée v3.0

- **Dernière mise à jour :** 04/10/2026

## **État Actuel du Projet**

Le socle (graphe d'entités, grille visuelle, persistance validée par Zod) et une première version du moteur de méta-simulation sont en place. La priorité est maintenant la **fiabilité des chiffres** : tests automatisés, intégration continue, puis refonte du moteur autour d'un calcul unique par foyer fiscal. Les fonctionnalités d'analyse (comparateur, arbitrage) viennent ensuite, sur cette base.

> **Changement d'ordre par rapport à la v2.2 :** le comparateur de statuts passe avant l'arbitrage rémunération / dividendes, et la gestion des foyers fiscaux est intégrée à la refonte du moteur.

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

### **Phase 5.5 : Corrections & Améliorations de l'UX [Terminé ✅]**

- **Types de dépenses clarifiés :** `expense` (« Dépense (non déductible) ») pour les personnes et les micro-entreprises, `deductible_expense` réservé aux sociétés à l'IS.
- **Barres agrégées par type de flux** dans la grille : deux flux du même type dans un mois donnent une seule barre.
- **Sauvegarde « Écraser vs. Créer » :** renommer une session chargée crée une nouvelle sauvegarde au lieu d'écraser l'ancienne (`loadedSlotId`).

---

### **Phase 6 : Le Moteur de Méta-Simulation v1 [Terminé ✅]**

- `runMetaSimulation` (`src/backend/logic/simulation-engine.ts`) : agrégation annuelle des flux par entité, regroupement des foyers fiscaux (Union-Find sur les relations Marié(e) / PACSé(e), demi-parts des enfants), routage de la rémunération du dirigeant vers la personne liée, appel des modules SASU / EURL / micro-entreprise, impôt sur le revenu par foyer.
- `ResultsPanel` : résultats par entité et synthèse par foyer, avec avertissements explicites.
- **Limites connues de cette v1** (traitées en Phase 7) : l'impôt sur le revenu est estimé à la fois dans chaque module d'activité et au niveau du foyer ; les dividendes saisis dans la grille sont ignorés (100 % du bénéfice est supposé distribué) ; le capital social des EURL n'est pas saisi.

---

### **Phase 6.5 : Qualité & Intégration Continue [En cours 🎯]**

**Objectif :** pouvoir modifier le moteur sans régression.

1.  **Tests unitaires (Vitest)** sur les modules de calcul, le moteur, le sanitizer et la logique de graphe.
2.  **Garde-fous :** seuil de couverture bloquant, plafond de complexité par fonction (ESLint), tests de mutation (Stryker) sur le moteur.
3.  **GitHub Actions :** lint, vérification des types, tests et build à chaque push.

---

### **Phase 6.6 : Saisie Rapide des Flux [En cours 🎯]**

**Objectif :** réduire le nombre de clics pour saisir et corriger des flux.

1.  **Édition en ligne :** chaque flux se modifie directement dans la liste du mois (type, libellé, montant) ; une ligne vide en bas permet d'ajouter ; saisie enchaînée au clavier. La seconde fenêtre d'édition disparaît.
2.  **Libellés de flux centralisés** dans `src/lib/flow-constants.ts`.
3.  **Part du net dans le CA** affichée pour chaque activité dans les résultats.

---

### **Phase 7 : Refonte du Moteur — Un Calcul Unique par Foyer [Planifié 🗓️ - PROCHAINE ÉTAPE]**

**Objectif :** des résultats cohérents entre eux, avec un vrai « net du foyer après impôts ». Intègre l'ancienne Phase 8 (couples et foyers fiscaux).

1.  **Chaîne de calcul en un seul sens :** les activités produisent des revenus (rémunération nette, dividendes, bénéfice micro) → ces revenus sont routés vers les personnes → l'impôt sur le revenu est calculé **une seule fois** par foyer, sur l'ensemble de ses revenus. Les modules SASU / EURL / micro ne calculent plus d'IR.
2.  **Dividendes :** prise en compte du flux « versement de dividendes » saisi dans la grille, réparti entre associés ; le bénéfice non distribué reste dans la société.
3.  **Modèle de données :** capital social pour les sociétés ; plusieurs dirigeants et associés.
4.  **Impôt sur le revenu :** barème entièrement lu depuis `config.json` (plus de coefficients dans le code), abattement de 10 % sur les salaires, parts des enfants selon leur rang, barème de l'année mis à jour.
5.  **Résultats :** net après impôts par personne et par foyer ; recalcul automatique à chaque modification (plus de bouton à cliquer).
6.  **À décider :** brancher l'EI au réel (`calculsEI.ts`) ou le retirer ; implémenter le versionnage des sauvegardes prévu au cahier des charges.

---

### **Phase 8 : Le Comparateur Stratégique (Entité « ??? ») [Planifié 🗓️]**

- **Objectif :** réintégrer la fonctionnalité phare de la v1 : pour une même activité, comparer SASU, EURL et micro-entreprise (net du foyer, impôts, cotisations) en relançant le moteur une fois par statut.

---

### **Phase 9 : L'Optimisation Visuelle (Rémunération / Dividendes) [Planifié 🗓️]**

- **Objectif :** arbitrage interactif entre rémunération et dividendes pour les sociétés à l'IS, intégré au comparateur.

---

### **Phase 10 : Scénarios Avancés & Finalisation [Planifié 🗓️]**

- **Objectif :** prorata temporis (activité démarrée en cours d'année), finalisation de l'ACRE et du versement libératoire (déjà pris en compte pour la micro-entreprise), distribution de l'application (exécutables Windows / macOS / Linux).
