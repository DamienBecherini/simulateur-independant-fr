# Roadmap de Développement Détaillée

### **Phase 1 : Socle Technique & Transplantation de la Logique**

**Objectif :** Intégrer notre logique de calcul existante dans le nouveau projet et la rendre accessible.

1.  **Action 1.1 :** Copier les fichiers `calculs*.js` et `config.json` de l'ancien projet dans la nouvelle structure (`src/electron/...`).
2.  **Action 1.2 :** Adapter les fichiers de calcul pour utiliser `import`/`export` (ESM) et les convertir progressivement en TypeScript pour bénéficier du typage.
3.  **Action 1.3 :** Modifier le `preload.ts` et le `main.ts` pour exposer une fonction de test simple `window.api.runTestSimulation()` qui prouve que le frontend peut appeler le backend et recevoir un résultat de calcul.

### **Phase 2 : Le Gestionnaire d'Entités**

**Objectif :** Construire l'interface permettant à l'utilisateur de créer et configurer les acteurs de sa simulation.

1.  **Action 2.1 :** Créer le composant React `EntitiesManager.tsx`.
2.  **Action 2.2 :** Implémenter les fonctionnalités CRUD (Créer, Lire, Mettre à jour, Supprimer) pour les personnes et les sociétés.
3.  **Action 2.3 :** Développer la modale de configuration pour chaque type d'entité (saisie du capital social pour une société, des parts fiscales pour une personne, etc.). L'état est persisté via l'API Electron.

### **Phase 3 : La Grille de Saisie Mensuelle**

**Objectif :** Permettre à l'utilisateur de saisir ses flux financiers mois par mois.

1.  **Action 3.1 :** Créer le composant React `MonthlyGrid.tsx`.
2.  **Action 3.2 :** Afficher un tableau de 12 colonnes (mois) et des lignes pour les revenus/dépenses.
3.  **Action 3.3 :** Implémenter la modale d'ajout de flux, qui permettra de saisir un montant, un type, et de l'associer à une entité existante via une liste déroulante.

### **Phase 4 : Le Moteur de Méta-Simulation (v1)**

**Objectif :** Faire fonctionner le calcul de bout en bout pour un scénario simple (1 personne + 1 société).

1.  **Action 4.1 :** Développer la fonction `runSimulation` dans `main.ts`. Elle lira l'état complet (entités, grille), agrégera les données annuelles, et orchestrera les appels aux modules de calcul.
2.  **Action 4.2 :** Créer un composant `Results.tsx` qui affiche un premier tableau de résultats synthétiques.

### **Phase 5 : L'Optimisation Visuelle (Rémunération/Dividendes)**

**Objectif :** Implémenter la fonctionnalité interactive d'arbitrage pour les sociétés à l'IS.

1.  **Action 5.1 :** Créer un composant `DividendSlider.tsx`.
2.  **Action 5.2 :** Mettre en place la logique bi-directionnelle : le curseur met à jour la répartition Rémunération/Dividendes dans les résultats, et la modification manuelle d'une rémunération dans la grille met à jour le curseur.

### **Phase 6 : La Simulation de Couple**

**Objectif :** Gérer la fiscalité du foyer et permettre la comparaison stratégique Mariage/PACS vs. Union libre.

1.  **Action 6.1 :** Adapter l'interface pour gérer un mode "Couple".
2.  **Action 6.2 :** Étoffer le moteur de simulation pour qu'il exécute deux calculs en parallèle :
    - **Scénario 1 :** Consolidation de tous les revenus imposables sur un seul foyer fiscal avec le nombre de parts total.
    - **Scénario 2 :** Calcul de deux impôts séparés, chacun avec ses propres revenus.
3.  **Action 6.3 :** Créer une vue de résultats comparative dédiée, mettant en évidence l'économie d'impôt.

### **Phase 7 : Le Comparateur Stratégique (Entité "???")**

**Objectif :** Réintégrer la fonctionnalité phare de la v1 de manière élégante.

1.  **Action 7.1 :** Permettre la création d'une entité spéciale de type "Projet" ou "???".
2.  **Action 7.2 :** Si cette entité est présente, le moteur de simulation exécutera les calculs pour tous les statuts compatibles (Micro, EI, SASU, EURL) en se basant sur les flux saisis pour cette entité.
3.  **Action 7.3 :** Afficher le tableau comparatif initial que les utilisateurs connaissent.

### **Phase 8 : Scénarios Avancés & Qualité de Vie**

**Objectif :** Couvrir les cas d'usages les plus courants pour les créateurs d'entreprise.

1.  **Action 8.1 :** Intégrer la gestion de l'**ACRE**, du **Versement Libératoire (VFL)** et de l'**ARE** (Aide au Retour à l'Emploi) dans l'interface et le moteur de calcul.
2.  **Action 8.2 :** Gérer le **prorata temporis** pour les débuts d'activité en cours d'année.
3.  **Action 8.3 :** Ajouter des profils-types pour pré-remplir la simulation et faciliter la prise en main.

### **Phase 9 : Finalisation & Distribution**

**Objectif :** Préparer l'application pour une diffusion publique.

1.  **Action 9.1 :** Polissage de l'interface, gestion des erreurs, ajout d'infobulles et de contenu pédagogique.
2.  **Action 9.2 :** Utiliser `electron-builder` pour créer les installeurs (`.exe`, `.dmg`, `.AppImage`).
3.  **Action 9.3 :** Rédiger un `README.md` complet pour le dépôt GitHub afin de lancer officiellement le projet en open-source.















25_09_21 : Plan d'Action Recommandé : La Feuille de Route v2.1

Votre nouveau code est un excellent point de départ, mais il reste un "squelette". La prochaine étape est d'y transplanter le "cerveau" (votre logique de calcul) et de commencer à construire la "peau" (l'interface React).

Voici la roadmap que je vous propose, directement inspirée de votre Roadmap.md mais adaptée à la nouvelle structure.

Phase 1 : Socle Technique & Transplantation de la Logique (Votre priorité absolue)

    Action 1.1 : Copier le Patrimoine Logique.

        Prenez les fichiers calculsAE.js, calculsEI.js, calculsEURL.js, calculsSASU.js, calculsIR.js de votre ancien projet.

        Copiez-les dans le nouveau projet, par exemple dans src/electron/logic/.

        Faites de même avec votre fichier config.json.

    Action 1.2 : Conversion Progressive en TypeScript.

        Renommez les fichiers en .ts.

        Commencez à typer les entrées (inputs) et les sorties de vos fonctions de simulation. C'est l'étape qui apportera le plus de robustesse.

    Action 1.3 : Établir le Pont de Communication.

        Modifiez src/electron/main.ts et src/electron/preload.cts pour exposer une fonction de test. Inspirez-vous de votre roadmap : window.api.runTestSimulation().

        Cette fonction, appelée depuis React, devra importer une de vos logiques de calcul (ex: simulerMicroEntreprise), l'exécuter avec des données en dur, et retourner le résultat.

        Dans votre composant src/ui/App.tsx, ajoutez un bouton qui appelle cette fonction et affiche le résultat dans la console ou à l'écran.

        Quand cette étape fonctionnera, 80% du risque technique de la migration sera levé.

Phase 2 : Reconstruction du Gestionnaire d'Entités en React

    Action 2.1 : Créer le composant EntitiesManager.tsx. Ce sera le composant principal de votre application pour le moment.

    Action 2.2 : Gérer l'état des entités. Utilisez le hook useState de React pour maintenir un tableau d'entités (personnes, sociétés).

    Action 2.3 : Construire l'interface. Utilisez les composants de ShadCN/UI (<Button>, <Dialog>, <Input>) pour implémenter les fonctionnalités CRUD (Créer, Lire, Mettre à jour, Supprimer) décrites dans votre roadmap. Chaque action (ex: cliquer sur "Ajouter une personne") mettra simplement à jour l'état local du composant.

Une fois ces deux phases terminées, vous aurez une base extrêmement solide pour dérouler le reste de votre roadmap (MonthlyGrid, DividendSlider, etc.) en construisant de nouveaux composants React les uns après les autres.
