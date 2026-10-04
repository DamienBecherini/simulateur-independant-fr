# Roadmap de Développement Détaillée v3.0

- **Dernière mise à jour :** 04/10/2026

## **État Actuel du Projet**

Le socle (graphe d'entités, grille visuelle, persistance validée par Zod), les tests automatisés avec intégration continue et le moteur de simulation par foyer fiscal sont en place. La prochaine étape est le **comparateur de statuts**, qui s'appuie sur ce moteur.

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
- **Limites de cette v1** (corrigées en Phase 7) : l'impôt sur le revenu est estimé à la fois dans chaque module d'activité et au niveau du foyer ; les dividendes saisis dans la grille sont ignorés (100 % du bénéfice est supposé distribué) ; le capital social des EURL n'est pas saisi.

---

### **Phase 6.5 : Qualité & Intégration Continue [Terminé ✅]**

**Objectif :** pouvoir modifier le moteur sans régression.

1.  **Tests unitaires (Vitest)** sur les modules de calcul, le moteur, le sanitizer et la logique de graphe.
2.  **Garde-fous :** seuil de couverture bloquant, plafond de complexité par fonction (ESLint), tests de mutation (Stryker) sur le moteur.
3.  **GitHub Actions :** lint, vérification des types, tests et build à chaque push.

---

### **Phase 6.6 : Saisie Rapide des Flux [Terminé ✅]**

**Objectif :** réduire le nombre de clics pour saisir et corriger des flux.

1.  **Édition en ligne :** chaque flux se modifie directement dans la liste du mois (type, libellé, montant) ; une ligne vide en bas permet d'ajouter ; saisie enchaînée au clavier. La seconde fenêtre d'édition disparaît.
2.  **Libellés de flux centralisés** dans `src/lib/flow-constants.ts`.
3.  **Part du net dans le CA** affichée pour chaque activité dans les résultats.

---

### **Phase 7 : Refonte du Moteur — Un Calcul Unique par Foyer [Terminé ✅]**

**Objectif :** des résultats cohérents entre eux, avec un vrai « net du foyer après impôts ». Intègre l'ancienne Phase 8 (couples et foyers fiscaux).

- **Chaîne de calcul en un seul sens :** les activités produisent des revenus (rémunération, dividendes, bénéfices) → ces revenus sont versés aux personnes → l'impôt sur le revenu est calculé **une seule fois** par foyer. Les modules SASU / EURL / micro / EI ne calculent plus d'impôt sur le revenu.
- **Dividendes :** seuls les dividendes saisis dans la grille sont distribués (plafonnés au bénéfice disponible), le reste est conservé dans la société ; imposition au forfait ou au barème, selon le plus favorable ; pour l'EURL, cotisations sociales au-delà de 10 % du capital social (nouveau champ).
- **Impôt sur le revenu :** barème entièrement lu depuis `config.json`, abattement de 10 % sur les salaires, plafonnement du quotient familial, décote, parts des enfants selon leur rang.
- **Foyers :** les enfants sont rattachés au foyer de leurs parents (la relation « Enfant » va du parent vers l'enfant).
- **Entreprise individuelle au réel :** nouveau statut d'activité, branché sur le moteur.
- **Règles 2026 :** barèmes et taux mis à jour et sourcés (service-public, impots.gouv).
- **Résultats :** net après impôts par foyer, détail par activité, recalcul automatique à chaque modification.
- **Robustesse :** le chargement écarte les éléments invalides un par un au lieu de réinitialiser la session ; identifiants uniques (UUID).

**Reporté :** le versionnage des sauvegardes prévu au cahier des charges (voir « Travaux transverses »).

---

### **Phase 8 : Le Comparateur Stratégique (Entité « ??? ») [Planifié 🗓️ - PROCHAINE ÉTAPE]**

- **Objectif :** réintégrer la fonctionnalité phare de la v1 : pour une même activité, comparer SASU, EURL, entreprise individuelle au réel et micro-entreprise (net du foyer, impôts, cotisations) en relançant le moteur une fois par statut.

---

### **Phase 9 : L'Optimisation Visuelle (Rémunération / Dividendes) [Planifié 🗓️]**

- **Objectif :** arbitrage interactif entre rémunération et dividendes pour les sociétés à l'IS, intégré au comparateur.

---

### **Phase 10 : Scénarios Avancés & Finalisation [Planifié 🗓️]**

- **Objectif :** compléter le modèle pour les situations moins courantes, puis distribuer l'application.

1.  **Prorata temporis :** activité démarrée en cours d'année.
2.  **ACRE :** distinguer la réduction de 50 % et celle de 25 % (micro-entreprises créées à partir du 01/07/2026).
3.  **Répartition du capital :** part de chaque associé dans une société à plusieurs associés. Aujourd'hui, les dividendes, l'impôt sur les sociétés et le bénéfice conservé sont partagés à parts égales.
4.  **Compte courant d'associé :** solde par société, flux d'apport et de remboursement (non imposés), intérêts versés (déductibles pour la société dans une limite, imposés chez l'associé), et prise en compte du solde dans le seuil des 10 % du capital des EURL.
5.  **Distribution :** exécutables Windows / macOS / Linux.

---

### **Travaux transverses [À faire 🧰]**

Tâches sans phase attitrée, à traiter entre deux fonctionnalités.

1.  **Dépendances :** analyser les vulnérabilités signalées par `npm audit` (44 à l'installation), distinguer celles qui touchent l'application livrée de celles des outils de développement, et corriger ce qui peut l'être sans casser le build.
2.  **Versionnage des sauvegardes :** numéro de version du format dans chaque fichier et migrations d'une version à la suivante, comme prévu au cahier des charges.
3.  **Tests de l'interface :** tests de composants sur les parcours de saisie (flux, acteurs, relations, salaires).
4.  **Import :** quand seuls des flux sont écartés à l'import, la notification renvoie vers une fenêtre de confirmation qui ne s'ouvre pas.
