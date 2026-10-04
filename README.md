# Simulateur Indépendant FR (Proof of Concept)

[![CI](https://github.com/DamienBecherini/simulateur-independant-fr/actions/workflows/ci.yml/badge.svg)](https://github.com/DamienBecherini/simulateur-independant-fr/actions/workflows/ci.yml)

Application desktop hors-ligne (Electron / React / TypeScript) conçue comme un bac à sable financier, juridique et fiscal pour les indépendants : on modélise personnes, sociétés et micro-entreprises, leurs liens et leurs flux mensuels, puis on compare les statuts (SASU, EURL, micro-entreprise) et l'impôt du foyer.

*Projet personnel, né d'un besoin d'entrepreneur, partagé dans le cadre de processus de recrutement pour montrer mes standards de code et ma vision produit. Ce n'est pas un logiciel de conseil fiscal : les résultats illustrent l'ingénierie, ils n'ont pas été validés par un expert-comptable.*

## ✨ Fonctionnalités

- **Modélisation par graphe** : entités (personnes, sociétés, micro-entreprises) reliées par des relations (Marié(e), PACSé(e), Enfant, Président, Gérant…).
- **Grille annuelle visuelle** : saisie des flux mois par mois, légende numérotée et couleurs personnalisables.
- **Méta-simulation** : agrégation des flux par entité, regroupement des foyers fiscaux, routage de la rémunération du dirigeant vers la personne liée, calcul par statut et impôt sur le revenu du foyer.
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

- `src/backend/logic/simulation-engine.ts` : moteur de méta-simulation (agrégation des flux, foyers fiscaux par Union-Find, routage de la rémunération du dirigeant).
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

Prérequis : Node.js 20 ou supérieur, npm.

```sh
git clone https://github.com/DamienBecherini/simulateur-independant-fr.git
cd simulateur-independant-fr
npm install
npm run dev
```

`npm run dev` lance Vite et Electron avec rechargement à chaud. Pour un exécutable : `npm run dist:win`, `npm run dist:mac` ou `npm run dist:linux`.

## ✅ Qualité

```sh
npm test               # tests unitaires (Vitest), exécution unique
npm run test:watch     # tests en mode interactif
npm run test:coverage  # tests + couverture (v8), rapport dans coverage/
npm run lint           # ESLint, dont la complexité cyclomatique
npm run test:mutation  # tests de mutation (Stryker), rapport dans reports/mutation/
```

- **Tests** : fichiers `*.test.ts` placés à côté du code testé ; les montants attendus sont calculés à la main à partir de `src/backend/config.json`.
- **Couverture** : seuil bloquant de 90 % (instructions, branches, fonctions, lignes) sur `src/backend/logic/` et `src/lib/`.
- **Complexité** : règle ESLint `complexity` plafonnée à 15 sur `src/`, avec deux exceptions commentées dans le moteur de méta-simulation.
- **Mutation** : Stryker sur `src/backend/logic/` (score d'environ 79 %), lancé chaque semaine et à la demande ; nécessite Node.js 22 ou supérieur.
- **Intégration continue** : GitHub Actions exécute lint, vérification des types, tests avec couverture et build à chaque push et pull request.

## 🗂️ Structure du projet

- `documentation/` : guide développeur et ADR.
- `src/backend/` : process principal Electron (logique métier, calculs fiscaux, accès fichiers, IPC).
- `src/ui/` : application React (composants, hooks, interface).
- `src/lib/` : fonctions utilitaires et logique pure partagée.
- `src/types.ts` : schémas Zod et types centraux.

## ⚠️ Limites connues

- POC : barèmes simplifiés, non validés par un expert-comptable.
- Le calcul « EI au réel » (`calculsEI.ts`) existe mais n'est pas encore branché au moteur.
- Les versements de dividendes saisis dans la grille ne sont pas encore pris en compte (un avertissement le signale).
