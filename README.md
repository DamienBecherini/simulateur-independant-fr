# Simulateur Indépendant FR (Proof of Concept)

Application Desktop (React / Electron / TypeScript) conçue comme un bac à sable financier, juridique et fiscal pour les indépendants. 

*Ce dépôt est un extrait de mon travail, partagé dans le cadre d'un processus de recrutement pour démontrer mes standards de code Frontend et ma vision Produit.*

## 📖 Documentation Produit & Technique
Pour comprendre la vision et l'architecture du projet, je vous invite à lire les documents fondateurs :
- [1. Cahier des charges & Architecture Globale](./Cahier%20des%20charges.md)
- [2. Roadmap Itérative](./Roadmap.md)

## 🤖 DevX & "AI-First" Workflow (Context Engineering)
Ce projet est développé avec une méthodologie augmentée par l'IA. Pour maximiser la pertinence des LLMs (Google AI Studio, Cursor) sans polluer leur fenêtre de contexte, j'ai développé mon propre outil d'injection de contexte :
- **`npm run concat`** : Exécute le script `concat_code.cjs` qui lit les règles d'inclusion/exclusion strictes dans `.concatrc.json`.
- **Résultat :** Cela génère un dump instantané, propre et "token-optimized" de l'intégralité de la base de code (~35 000 tokens actuels), prêt à être ingéré par un LLM à grande fenêtre de contexte (1M+ tokens) pour des revues d'architecture globales ou la génération de PRD complexes.

## 🛠️ Stack Technique Principale
- **UI & State :** React 19, Custom Hooks (Undo/Redo, Debounce).
- **Typage & Validation :** TypeScript strict, Zod (Single Source of Truth).
- **Design System :** TailwindCSS v4, ShadCN/UI, Lucide Icons, dnd-kit (Drag&Drop).
- **Build :** Vite, Electron-Builder.

## ✨ Points d'intérêts dans le code
- `src/types.ts` : Modélisation des données via Zod.
- `src/ui/hooks/useSessionManager.ts` : Gestion complexe de l'état (Historique, Undo/Redo, Sauvegarde asynchrone).
- `src/lib/business-logic.ts` : Algorithmique de nettoyage du graphe lors de la rupture de relations entre entités.