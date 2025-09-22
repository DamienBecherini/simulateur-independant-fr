# Roadmap de Développement Détaillée v2.1
- **Dernière mise à jour :** 22/09/2025

## **État Actuel du Projet**
La base technique de l'application est maintenant complète, stable et robuste. Le système de gestion des données (session de travail, sauvegardes multiples, import/export) est fonctionnel et l'expérience utilisateur a été grandement améliorée (splash screen, interface peaufinée). Le projet est prêt à accueillir ses fonctionnalités métier principales.

---

### **Phase 1 : Socle Technique & Transplantation de la Logique [Terminé ✅]**

**Objectif :** Intégrer notre logique de calcul existante dans le nouveau projet et la rendre accessible.

*   **Action 1.1 :** Logique de calcul et fichier de configuration intégrés. `[✅]`
*   **Action 1.2 :** Fichiers de logique convertis en modules ES (`.ts` avec `import`/`export`). `[✅]`
*   **Action 1.3 :** Le pont de communication (IPC) entre le frontend et le backend est entièrement fonctionnel, sécurisé et typé. `[✅]`

### **Phase 2 : Le Gestionnaire d'Entités [Terminé ✅]**

**Objectif :** Construire l'interface permettant à l'utilisateur de créer et configurer les acteurs de sa simulation.

*   **Action 2.1 :** Le composant `EntitiesManager.tsx` est créé et fonctionnel. `[✅]`
*   **Action 2.2 :** Les fonctionnalités CRUD (Créer, Lire, Mettre à jour, Supprimer) sont implémentées. `[✅]`
*   **Action 2.3 :** La modale de configuration des entités est fonctionnelle. `[✅]`
*   **Action 2.4 (Bonus) :** Ajout du réagencement des entités par glisser-déposer (Drag & Drop). `[✅]`
*   **Action 2.5 (Bonus) :** Ajout d'un système de verrouillage pour empêcher la suppression accidentelle. `[✅]`

### **Phase 2.5 : Expérience Utilisateur & Gestion de Données [Terminé ✅]**

**Objectif :** Assurer une expérience utilisateur professionnelle et mettre en place un système de sauvegarde robuste inspiré de la V1.

*   **Action 2.5.1 :** Élimination de l'écran blanc au démarrage via un **splash screen** de chargement. `[✅]`
*   **Action 2.5.2 :** Mise en place d'un système de **sauvegarde par "slots"** permettant de conserver plusieurs simulations distinctes. `[✅]`
*   **Action 2.5.3 :** **Séparation de la session de travail** (sauvegardée automatiquement) des slots de sauvegarde (gérés manuellement). `[✅]`
*   **Action 2.5.4 :** Implémentation de l'**import/export** contextuel pour des simulations uniques. `[✅]`
*   **Action 2.5.5 :** Implémentation de la **persistance de l'ordre des sauvegardes** via les préférences utilisateur. `[✅]`
*   **Action 2.5.6 :** Peaufinage de l'interface : **interrupteur de thème** personnalisé, alignement des boutons et icônes. `[✅]`

### **Phase 3 : La Grille de Saisie Mensuelle [À FAIRE ⏳]**

**Objectif :** Permettre à l'utilisateur de saisir ses flux financiers mois par mois.

1.  **Action 3.1 :** Créer le composant React `MonthlyGrid.tsx`.
2.  **Action 3.2 :** Afficher un tableau de 12 colonnes (mois) et des lignes pour les revenus/dépenses.
3.  **Action 3.3 :** Implémenter la modale d'ajout de flux, qui permettra de saisir un montant, un type, et de l'associer à une entité existante via une liste déroulante.

### **Phase 4 : Le Moteur de Méta-Simulation (v1) [Planifié 🗓️]**

**Objectif :** Faire fonctionner le calcul de bout en bout pour un scénario simple (1 personne + 1 société).

1.  **Action 4.1 :** Développer la fonction `runSimulation` dans `main.ts`. Elle lira l'état complet (entités, grille), agrégera les données annuelles, et orchestrera les appels aux modules de calcul.
2.  **Action 4.2 :** Créer un composant `Results.tsx` qui affiche un premier tableau de résultats synthétiques.

### **Phase 5 : L'Optimisation Visuelle (Rémunération/Dividendes) [Planifié 🗓️]**

**Objectif :** Implémenter la fonctionnalité interactive d'arbitrage pour les sociétés à l'IS.

1.  **Action 5.1 :** Créer un composant `DividendSlider.tsx`.
2.  **Action 5.2 :** Mettre en place la logique bi-directionnelle : le curseur met à jour la répartition Rémunération/Dividendes dans les résultats, et la modification manuelle d'une rémunération dans la grille met à jour le curseur.

### **Phase 6 : La Simulation de Couple [Planifié 🗓️]**

**Objectif :** Gérer la fiscalité du foyer et permettre la comparaison stratégique Mariage/PACS vs. Union libre.

1.  **Action 6.1 :** Adapter l'interface pour gérer un mode "Couple".
2.  **Action 6.2 :** Étoffer le moteur de simulation pour qu'il exécute deux calculs en parallèle.
3.  **Action 6.3 :** Créer une vue de résultats comparative dédiée.

### **Phase 7 : Le Comparateur Stratégique (Entité "???") [Planifié 🗓️]**

**Objectif :** Réintégrer la fonctionnalité phare de la v1 de manière élégante.

1.  **Action 7.1 :** Permettre la création d'une entité spéciale de type "Projet" ou "???".
2.  **Action 7.2 :** Le moteur de simulation exécutera les calculs pour tous les statuts compatibles.
3.  **Action 7.3 :** Afficher le tableau comparatif initial.

### **Phase 8 : Scénarios Avancés & Qualité de Vie [Planifié 🗓️]**

**Objectif :** Couvrir les cas d'usages les plus courants pour les créateurs d'entreprise.

1.  **Action 8.1 :** Intégrer la gestion de l'**ACRE**, du **VFL** et de l'**ARE**.
2.  **Action 8.2 :** Gérer le **prorata temporis** pour les débuts d'activité.
3.  **Action 8.3 :** Ajouter des profils-types pour pré-remplir la simulation.

### **Phase 9 : Finalisation & Distribution [Planifié 🗓️]**

**Objectif :** Préparer l'application pour une diffusion publique.

1.  **Action 9.1 :** Polissage de l'interface, gestion des erreurs, ajout d'infobulles.
2.  **Action 9.2 :** Utiliser `electron-builder` pour créer les installeurs.
3.  **Action 9.3 :** Rédiger un `README.md` complet pour le dépôt GitHub.