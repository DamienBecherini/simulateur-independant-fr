# Simulateur Indépendant FR

Simulateur Indépendant FR est une application de bureau conçue pour être l'assistant prévisionnel de référence pour les indépendants et les foyers en France. Elle permet de modéliser des scénarios financiers, juridiques et fiscaux complexes de manière simple, visuelle et 100% confidentielle.

## ✨ Fonctionnalités Clés

- **Modélisation par Graphe :** Construisez une représentation de votre réalité professionnelle et personnelle en créant des entités (Personnes, Sociétés) et des liens entre elles.
- **Saisie Visuelle :** Une grille annuelle interactive permet de visualiser la composition de vos revenus et dépenses mois par mois.
- **100% Hors-Ligne et Confidentiel :** Aucune donnée ne quitte votre machine. L'application fonctionne sans connexion internet.
- **Gestion de Scénarios :** Sauvegardez, chargez et comparez différentes simulations pour prendre les meilleures décisions.
- **Pérennité des Données :** Un système de validation et de réparation automatique garantit que vous pouvez ouvrir vos anciennes simulations même après une mise à jour de l'application.

## 🛠️ Stack Technique

- **Framework Applicatif :** Electron
- **Interface Utilisateur :** React + TypeScript
- **Outillage de Build :** Vite
- **Styling :** TailwindCSS + ShadCN/UI
- **Validation des Données :** Zod

## 🚀 Démarrage Rapide

### Prérequis

- Node.js (version 18 ou supérieure recommandée)
- npm (généralement inclus avec Node.js)

### Installation

1.  Clonez le dépôt sur votre machine locale :
    ```sh
    git clone [URL_DU_DEPOT]
    ```
2.  Naviguez dans le dossier du projet :
    ```sh
    cd simulateur-independant-fr
    ```
3.  Installez les dépendances :
    ```sh
    npm install
    ```

### Lancement en Mode Développement

Pour lancer l'application avec le rechargement à chaud pour le frontend et le backend :

```sh
npm run dev
```

### Structure du Projet

- `documentation/` : Contient la documentation de conception et d'architecture (ADRs).
- `src/` : Le code source de l'application.
  - `src/backend/` : Le code du processus Main d'Electron (logique métier, accès fichiers).
  - `src/ui/` : Le code de l'application React (composants, hooks, interface).
  - `src/lib/` : Fonctions utilitaires partagées ou logiques pures.
  - `src/types.ts` : Les définitions de types et schémas Zod centraux.
