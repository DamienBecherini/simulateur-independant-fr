# **ADR-001: Choix de la Stack Technique Principale**

- **Date :** 2025-11-08
- **Statut :** Accepté

## **Contexte**

Le projet "Simulateur Indépendant FR" a des exigences fondamentales qui guident les choix technologiques :

1.  **Fonctionnement Hors-Ligne :** La confidentialité est absolue. L'application doit fonctionner comme un programme de bureau autonome, sans jamais envoyer de données utilisateur sur internet.
2.  **Distribution Multi-Plateforme :** L'application doit être facilement distribuable et installable sur les principaux systèmes d'exploitation (Windows, macOS, Linux).
3.  **Interface Utilisateur Riche :** Le concept de "bac à sable" basé sur un graphe d'entités, avec des interactions complexes (glisser-déposer, modales contextuelles, visualisations de données), nécessite une technologie front-end moderne et performante.
4.  **Fiabilité et Maintenabilité :** Le cœur du projet est la logique de calcul et la structure des données. La stack doit garantir la robustesse, la sécurité des types et la pérennité des données de l'utilisateur sur le long terme.
5.  **Efficacité de Développement :** L'outillage doit permettre un cycle de développement rapide, avec un rechargement quasi-instantané et une configuration simple des alias et des chemins.

## **Décision**

La stack technique suivante a été choisie pour répondre à ces exigences, en formant un écosystème cohérent où chaque composant a un rôle précis :

1.  **Framework Applicatif : Electron**

    - Pour créer une application de bureau multi-plateforme en utilisant des technologies web. Il répond directement aux besoins de fonctionnement hors-ligne et de distribution.

2.  **Interface Utilisateur (Frontend) : React + TypeScript**

    - **React** est choisi pour son modèle de composants, idéal pour construire une UI complexe et modulaire.
    - **TypeScript** est imposé pour la robustesse, la maintenabilité et la prévention des erreurs. Il permet de construire une base de code sûre, surtout pour un projet avec une logique métier complexe.

3.  **Processus Principal (Backend) : Node.js (via Electron)**

    - Le processus principal d'Electron, tournant sous Node.js, est utilisé pour toute la logique qui ne concerne pas l'affichage : calculs fiscaux et sociaux, gestion du cycle de vie de l'application, et surtout, l'accès sécurisé au système de fichiers pour la sauvegarde et le chargement des sessions.

4.  **Outillage de Build : Vite**

    - Vite est préféré à d'autres solutions (comme Webpack via Create React App) pour sa rapidité de développement exceptionnelle (HMR quasi-instantané) et sa configuration moderne.

5.  **Styling : TailwindCSS + ShadCN/UI**

    - **TailwindCSS** est utilisé pour un styling rapide et cohérent via des classes utilitaires.
    - **ShadCN/UI** est choisi comme bibliothèque de composants non stylisés. Cela offre des composants accessibles et fonctionnels (modales, boutons, etc.) tout en laissant un contrôle total sur leur apparence via Tailwind, ce qui permet de créer une interface moderne et personnalisée.

6.  **Validation des Données : Zod**
    - Zod est un choix architectural central. Il n'est pas seulement utilisé pour la validation, mais comme la **source de vérité unique** pour tous les schémas de données. Les types TypeScript sont inférés de Zod, garantissant une synchronisation parfaite entre la structure des données, leur validation et leur utilisation dans le code. C'est la pierre angulaire de la pérennité des sauvegardes utilisateur.

## **Conséquences**

- **Positives :**

  - **Écosystème Unifié :** L'ensemble du projet est développé en TypeScript/JavaScript, que ce soit pour le front-end, le back-end ou le build, ce qui simplifie les compétences requises.
  - **Haute Vélocité de Développement :** La combinaison Vite + React + TailwindCSS permet de développer et d'itérer sur l'interface utilisateur très rapidement.
  - **Robustesse "Pare-balles" :** L'utilisation de TypeScript et, surtout, de Zod comme "schéma-first" rend l'application extrêmement résiliente aux données invalides ou corrompues, un point essentiel pour la pérennité des sauvegardes.
  - **Expérience Utilisateur Moderne :** La stack permet de construire une application qui est à la fois esthétique, performante et agréable à utiliser.
  - **Portabilité Maximale :** Le choix d'Electron garantit que le simulateur peut toucher le plus grand nombre d'utilisateurs, quel que soit leur OS.

- **Négatives ou Compromis :**
  - **Taille de l'Application :** Les applications Electron embarquent une version de Chromium, ce qui les rend intrinsèquement plus lourdes (en termes de Mo sur le disque) que des applications natives. C'est le compromis accepté pour la portabilité et la facilité de développement.
  * **Consommation de Mémoire :** De même, la consommation de RAM peut être supérieure à celle d'une application native équivalente. Pour un simulateur dont l'usage est ponctuel et les calculs non-intensifs en continu, ce compromis est jugé tout à fait acceptable.
  * **Complexité de la Chaîne de Build :** L'interaction entre Vite (pour le front) et le processus de transpilation de TypeScript pour le backend Electron (`tsc`) ajoute une légère complexité à la configuration du build par rapport à une application web classique (visible dans les scripts de `package.json`).
