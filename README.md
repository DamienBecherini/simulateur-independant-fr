# Simulateur Indépendant FR (Proof of Concept)

[![CI](https://github.com/DamienBecherini/simulateur-independant-fr/actions/workflows/ci.yml/badge.svg)](https://github.com/DamienBecherini/simulateur-independant-fr/actions/workflows/ci.yml)

Application desktop hors-ligne (Electron / React / TypeScript) conçue comme un bac à sable financier, juridique et fiscal pour les indépendants : on modélise personnes, sociétés et micro-entreprises, leurs liens et leurs flux mensuels, puis on compare les statuts (SASU, EURL, micro-entreprise) et l'impôt du foyer.

*Projet personnel, né d'un besoin d'entrepreneur, partagé dans le cadre de processus de recrutement pour montrer mes standards de code et ma vision produit. Ce n'est pas un logiciel de conseil fiscal : les résultats illustrent l'ingénierie, ils n'ont pas été validés par un expert-comptable.*

## ✨ Fonctionnalités

- **Modélisation par graphe** : entités (personnes, sociétés, micro-entreprises) reliées par des relations (Marié(e), PACSé(e), Enfant, Président, Gérant…).
- **Grille annuelle visuelle** : saisie des flux mois par mois, légende numérotée et couleurs personnalisables.
- **Simulation par foyer** : chaque activité (SASU, EURL, entreprise individuelle au réel, micro-entreprise) calcule ses cotisations et ce qu'elle verse ; l'impôt sur le revenu est ensuite calculé une seule fois par foyer fiscal (quotient familial plafonné, décote, dividendes au forfait ou au barème). Les résultats se recalculent à chaque modification.
- **Comparateur de statuts** : pour une activité, net dans la poche, taux de prélèvement, frais de fonctionnement détaillés et note de protection sociale (trimestres de retraite validés) en SASU, EURL, EI au réel et micro-entreprise (avec et sans versement libératoire) ; pour un couple en union libre, effet d'un mariage ou d'un PACS sur l'impôt.
- **Scénarios** : sauvegardes nommées, chargement, import / export JSON.
- **Pérennité des données** : validation Zod et réparation automatique des sessions à l'ouverture.
- **Confort d'édition** : undo / redo (Ctrl+Z / Ctrl+Y, Cmd+Shift+Z), sauvegarde automatique, glisser-déposer, zoom.
- **100 % hors-ligne** : aucune donnée ne quitte la machine.

## 📖 Documentation

- [Cahier des charges & architecture globale](./Cahier%20des%20charges.md)
- [Roadmap itérative](./Roadmap.md)
- [Guide développeur](./documentation/GUIDE_DEVELOPPEUR.md)
- [Décisions d'architecture (ADR)](./documentation/adr/)

## 🛠️ Stack technique

- **Application :** Electron (process principal Node.js, IPC typé via `contextBridge`).
- **Interface :** React 19, hooks maison (historique undo/redo, sauvegarde debounced).
- **Typage & validation :** TypeScript strict, Zod comme source de vérité unique.
- **Design system :** Tailwind CSS v4, ShadCN/UI, Lucide, dnd-kit.
- **Build :** Vite, electron-builder.

## ✨ Points d'intérêt dans le code

- `src/backend/logic/simulation-engine.ts` : moteur de simulation à sens unique (activités → revenus des personnes → impôt du foyer).
- `src/backend/logic/foyers.ts` : regroupement des foyers fiscaux par union-find (couples, enfants rattachés, parts).
- `src/backend/logic/regles.ts` + `src/backend/config.json` : toutes les règles fiscales de l'année, typées et sourcées, hors du code.
- `src/backend/logic/data-sanitizer.ts` : validation et réparation des sessions (relations et flux orphelins).
- `src/backend/util.ts` + `src/backend/preload.cts` : contrat IPC typé de bout en bout, sans `any` sur la surface exposée.
- `src/types.ts` : schémas Zod et types dérivés.
- `src/ui/hooks/useSessionManager.ts` : état de session, historique, sauvegarde asynchrone.
- `src/lib/business-logic.ts` : nettoyage du graphe lors de la rupture d'une relation.

## 🤖 Workflow « AI-first » (context engineering)

Le projet est développé avec des assistants IA, sous relecture humaine. Pour leur donner une vue d'ensemble sans polluer leur fenêtre de contexte :

- **`npm run concat`** exécute `concat_code.cjs`, qui applique les règles d'inclusion / exclusion de `.concatrc.json`.
- Le résultat est un dump propre et optimisé en tokens de toute la base de code, prêt pour une revue d'architecture globale par un LLM à grande fenêtre de contexte.

## 🚀 Démarrage rapide

Prérequis : Node.js 22 ou supérieur, npm.

```sh
git clone https://github.com/DamienBecherini/simulateur-independant-fr.git
cd simulateur-independant-fr
npm install
npm run dev
```

`npm run dev` lance Vite et Electron avec rechargement à chaud. Pour un exécutable : `npm run dist:win`, `npm run dist:mac` ou `npm run dist:linux`.

## ✅ Qualité

```sh
npm test               # rapide : tests de la logique et des composants (Vitest)
npm run test:watch     # tests en mode interactif
npm run test:coverage  # tests + couverture (v8), rapport dans coverage/
npm run test:e2e       # compile l'application, puis tests de bout en bout (Playwright + Electron), fenêtres masquées
npm run test:e2e:visible  # les mêmes, fenêtres affichées pour suivre les tests
npm run test:all       # tout : tests avec couverture, puis tests de bout en bout
npm run lint           # ESLint, dont la complexité cyclomatique
npm run test:mutation  # tests de mutation (Stryker), rapport dans reports/mutation/
```

- **Tests** : fichiers `*.test.ts` placés à côté du code testé ; le moteur est testé avec des règles fictives aux chiffres ronds (`src/backend/logic/testing/`), pour que les montants attendus se vérifient de tête et ne dépendent pas du barème de l'année.
- **Cas de référence 2026** : `src/backend/logic/references/` fait tourner le moteur avec les règles réelles de `config.json` sur une soixantaine de situations (micro-entreprise, SASU, EURL, EI, salaires, familles, comparateur), dont chaque montant attendu est dérivé à la main des règles officielles ; ils échouent explicitement si `config.json` change d'année.
- **Tests de composants** : fichiers `*.test.tsx` (React Testing Library, user-event, jsdom) qui rejouent les parcours de saisie au clavier, la fenêtre des flux, les cartes d'entités, les résultats et l'historique d'annulation ; `window.api` y est simulé (`src/ui/testing/`).
- **Tests de bout en bout** (optionnels) : fichiers `e2e/*.e2e.ts`, où Playwright pilote l'application Electron compilée (création d'entités, saisie dans la grille, résultats, historique, sauvegarde automatique, conversion d'un ancien format, sauvegardes nommées). Chaque test lance l'application sur un dossier de données temporaire (`--user-data-dir`), sans toucher aux vraies données ; aucun navigateur à télécharger. En intégration continue, ils tournent sur `main` et à la demande.
- **Couverture** : seuil bloquant de 90 % (instructions, branches, fonctions, lignes) sur `src/backend/logic/` et `src/lib/`.
- **Complexité** : règle ESLint `complexity` plafonnée à 15 sur `src/`, sans exception.
- **Mutation** : Stryker sur `src/backend/logic/` (score d'environ 86 %), lancé chaque semaine et à la demande ; nécessite Node.js 22 ou supérieur.
- **Intégration continue** : GitHub Actions exécute lint, vérification des types, tests avec couverture et build à chaque push et pull request.

## 🗂️ Structure du projet

- `documentation/` : guide développeur et ADR.
- `src/backend/` : process principal Electron (logique métier, calculs fiscaux, accès fichiers, IPC).
- `src/ui/` : application React (composants, hooks, interface).
- `src/lib/` : fonctions utilitaires et logique pure partagée.
- `src/types.ts` : schémas Zod et types centraux.

## ⚠️ Limites connues

- POC : les résultats illustrent l'ingénierie, ils n'ont pas été validés par un expert-comptable.
- Les cotisations des travailleurs non salariés (gérant d'EURL, entrepreneur individuel au réel) sont calculées ligne à ligne selon le barème 2026 des artisans, commerçants et professions libérales non réglementées (assiette unique abattue de 26 %, assiettes minimales) ; ne sont pas modélisés les professions libérales réglementées, la contribution des artisans à la formation (0,29 %), le décalage entre cotisations provisionnelles et régularisation, ni la CSG déductible sur les dividendes soumis à cotisations. Celles du président de SASU restent approchées par un ratio moyen entre coût total et net.
- La note de protection sociale du comparateur est indicative : elle combine le régime et les trimestres de retraite validés.
- Non modélisés : réductions et crédits d'impôt, résidence alternée, report des déficits, TVA, répartition du capital entre associés (dividendes partagés à parts égales).
