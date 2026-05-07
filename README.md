# Simulateur Indépendant FR (Proof of Concept)

Application Desktop (React / Electron / TypeScript) conçue comme un bac à sable financier, juridique et fiscal pour les indépendants. 

*Ce dépôt est un extrait de mon travail, partagé dans le cadre d'un processus de recrutement pour démontrer mes standards de code Frontend et ma vision Produit.*

## 📖 Documentation Produit & Technique
Pour comprendre la vision et l'architecture du projet, je vous invite à lire les documents fondateurs :
- [1. Cahier des charges & Architecture Globale](./Cahier%20des%20charges.md)
- [2. Roadmap Itérative](./Roadmap.md)

## 🛠️ Stack Technique Principale
- **UI & State :** React 19, Custom Hooks (Undo/Redo, Debounce).
- **Typage & Validation :** TypeScript strict, Zod (Single Source of Truth).
- **Design System :** TailwindCSS v4, ShadCN/UI, Lucide Icons, dnd-kit (Drag&Drop).
- **Build :** Vite, Electron-Builder.

## ✨ Points d'intérêts dans le code
- `src/types.ts` : Modélisation des données via Zod.
- `src/ui/hooks/useSessionManager.ts` : Gestion complexe de l'état (Historique, Undo/Redo, Sauvegarde asynchrone).
- `src/lib/business-logic.ts` : Algorithmique de nettoyage du graphe lors de la rupture de relations entre entités.