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

#### **Phase 5.5 : Corrections & Améliorations de l'UX [Terminé ✅]**

**Objectif :** Résoudre les problèmes fonctionnels et les bugs identifiés lors de l'utilisation de la grille et de la gestion des sauvegardes pour rendre l'expérience fluide et complète.

1.  **Action 5.5.1 : Logique des Dépenses Clarifiée :** [✅]
    - La distinction a été faite entre les **charges déductibles** (pour les sociétés à l'IS) et les **dépenses non déductibles**, qui sont maintenant correctement disponibles pour les personnes physiques et les micro-entreprises, rendant la simulation de trésorerie possible pour tous les statuts.
2.  **Action 5.5.2 : Agrégation Visuelle des Flux :** [✅]
    - Les flux de même type saisis dans un même mois sont désormais **fusionnés en une seule barre visuelle** dans la grille, dont la hauteur représente la somme des montants.
3.  **Action 5.5.3 : Logique de Sauvegarde Corrigée :** [✅]
    - Renommer une session charge une intention de **"Sauvegarder sous..."**. Le système propose maintenant de créer une nouvelle sauvegarde au lieu de chercher à écraser un ancien slot, ce qui rend le comportement plus intuitif et sécurisé.

---

### **Phase 6 : Le Moteur de Méta-Simulation v2 [À FAIRE 🎯 - NOUVELLE PRIORITÉ]**

**Objectif :** Remplacer le prototype de calcul par un moteur de simulation robuste capable de produire un rapport détaillé et pédagogique. Le principe fondamental est de **distinguer systématiquement les flux de trésorerie réels (ce qu'il reste dans la poche) des assiettes fiscales et sociales (ce qui sert de base aux calculs administratifs)**.

1.  **Action 6.1 : Refondre la Structure des Résultats (`SimulationOutput`) :**

    - **Problème :** La structure de retour actuelle est trop simple et fusionne des concepts différents (ex: `netProfit` pour une micro-entreprise est ambigu).
    - **Plan d'action :**
      - Modifier les types dans `src/types.ts`. L'interface `SimulationOutput` et ses sous-interfaces (`CompanyResult`, `PersonResult`) doivent être enrichies pour contenir tous les détails nécessaires à un rapport complet.
      - **Pour `CompanyResult` (spécifiquement pour la Micro-Entreprise) :** Ajouter des champs pour le `totalCA`, le détail du CA par catégorie (`caBic`, `caBnc`, `caVente`), le détail des cotisations sociales (`cotisationsBic`, `cotisationsBnc`, etc.), le `revenuImposableApresAbattement`, et un `resultatNetTresorerie` (CA - Cotisations - Dépenses réelles).
      - **Pour `PersonResult` :** Ajouter des champs pour le `totalRevenuImposable` (qui inclut les salaires ET le revenu imposable des activités), et conserver un `netInPocket` qui représentera le flux de trésorerie final.

2.  **Action 6.2 : Mettre à Jour les Modules de Calcul Individuels :**

    - **Problème :** Les fonctions comme `simulerMicroEntreprise` retournent un résultat trop simple.
    - **Plan d'action :**
      - Modifier chaque module de calcul dans `src/backend/logic/` (`calculsAE.ts`, `calculsSASU.ts`, etc.) pour qu'ils retournent la nouvelle structure de résultat détaillée définie à l'étape 6.1.
      - Le calcul pour la micro-entreprise devra explicitement calculer et retourner séparément les cotisations sociales, le revenu imposable après abattement forfaitaire, et le résultat net de trésorerie.

3.  **Action 6.3 : Réécrire l'Orchestrateur de Simulation (`simulationOrchestrator.ts`) :**

    - **Problème :** L'orchestrateur actuel ne gère pas correctement la propagation des revenus et le calcul au niveau du foyer.
    - **Plan d'action :** La fonction `runSimulation` devra suivre une logique stricte :
      1.  **Calculer les résultats individuels** pour chaque activité (société, micro) en appelant les modules mis à jour.
      2.  **Identifier les foyers fiscaux** en se basant sur les relations "Marié(e)" / "PACSé(e)".
      3.  **Agréger les revenus IMPOSABLES** pour chaque foyer. Cela signifie cumuler les salaires des personnes et le **`revenuImposableApresAbattement`** de leurs activités (et non le CA !).
      4.  **Calculer l'Impôt sur le Revenu (IR)** pour chaque foyer en se basant sur le total des revenus imposables et la somme des parts fiscales.
      5.  **Calculer le "Net dans la Poche" final** au niveau du foyer. Ce calcul se base sur la trésorerie réelle : (Total des salaires + Total des `resultatNetTresorerie` des activités) - (IR du foyer).

4.  **Action 6.4 : Mettre à Jour le Composant d'Affichage (`Results.tsx`) :**
    - **Problème :** Le composant affiche actuellement un simple JSON brut.
    - **Plan d'action :**
      - Modifier le composant pour qu'il consomme la nouvelle structure de données `SimulationOutput`.
      - Présenter les résultats de manière hiérarchisée et claire, en séparant bien les résultats par entité, et en affichant les détails clés (détail du CA, de l'URSSAF, de l'impôt, etc.).

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

### **Phase 11 : Le Canvas de Modélisation Interactif [Planifié 🗓️]**

**Objectif :** Remplacer la gestion des acteurs, actuellement une liste verticale, par un canvas de modélisation libre. Cette refonte a pour but de représenter visuellement et spatialement le graphe des relations, transformant l'interface en un véritable outil de "mind mapping" financier et structurel.

1.  **Problématique : La Limite de la Liste Verticale**

    - **Manque de clarté :** Avec plusieurs entités et relations croisées, la liste actuelle devient difficile à lire. Il est impossible de visualiser la structure globale du montage (qui est lié à qui) d'un seul coup d'œil.
    - **Redondance de l'information :** Une relation (ex: "Marié(e)") est affichée sur les deux fiches personnes, créant une répétition inutile.
    - **Encombrement :** Comme souligné, les fiches prennent beaucoup de place en hauteur, ce qui rend la gestion de plus de 4 ou 5 entités peu pratique.
    - **Statique et non-intuitive :** L'interface ne reflète pas la nature dynamique et interconnectée d'un graphe. L'utilisateur ne peut pas organiser spatialement les acteurs d'une manière qui correspond à sa propre carte mentale.

2.  **Plan d'action : Implémentation d'un Éditeur de Graphe**
    - **Action 8.1 : Intégrer une bibliothèque de graphes.** Remplacer la bibliothèque de tri `dnd-kit` par une solution spécialisée comme **`React Flow`**. Cette bibliothèque fournit la base technique pour le canvas, le zoom, le déplacement des nœuds et le tracé des arêtes.
    - **Action 8.2 : Transformer les entités en "Nœuds" déplaçables.**
      - Chaque entité (`Person`, `Company`, etc.) deviendra un "nœud" flottant sur le canvas.
      - L'utilisateur pourra glisser-déposer chaque nœud pour le positionner librement, lui permettant d'organiser son espace de travail.
      - La fiche de l'entité sera allégée au maximum (avatar, nom, type, boutons d'action) pour un affichage compact. Le bouton "Supprimer" sera remplacé par une icône Corbeille.
    - **Action 8.3 : Transformer les relations en "Arêtes" visuelles.**
      - Les relations ne seront plus affichées dans les fiches, mais comme des flèches ou des lignes connectant les nœuds. Le type de relation ("Président", "Marié(e)") sera affiché comme une étiquette sur la ligne.
      - L'ensemble du montage deviendra instantanément lisible.
    - **Action 8.4 : Permettre la création de relations interactives.** Implémenter la fonctionnalité phare : l'utilisateur pourra cliquer sur le bord d'un nœud, étirer une ligne jusqu'à un autre nœud, et à la connexion, une modale s'ouvrira pour lui permettre de choisir le type de relation à créer.
    - **Action 8.5 : Assurer la persistance des positions.** La position (x, y) de chaque nœud sur le canvas sera sauvegardée avec l'entité. Ainsi, lorsque l'utilisateur recharge sa simulation, sa mise en page personnalisée est restaurée.

Notes supplémentaires :

Ajouter une option qui permet d'ajouter un certain pourcentage (on doit pouvoir régler des dixiemes d'unité) de taxe Urssaf supplémentaires pour les auto entreprenneur avec comme légende : Formation obligatoire, Taxe CMA / Frais de Chambre Consulaire, etc. Une nouvelle ligne devra apparaitre dans le détail des calculs des taxes.
