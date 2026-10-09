// src/backend/regles/index.ts

import type { ReglesFiscales } from "../logic/regles.js"
import regles2024 from "./2024.json" with { type: "json" }
import regles2025 from "./2025.json" with { type: "json" }
import regles2026 from "./2026.json" with { type: "json" }

/*
 * Les fichiers de règles, un par année (convention : ADR 007), tous de la même forme (vérifiée par regles.test.ts).
 * Ajouter une année : écrire `<année>.json` et l'ajouter à cette liste ; rien d'autre dans le code ne nomme une année.
 *
 * La liste est écrite à la main plutôt que lue dans le dossier : le même moteur tourne sous Node (Electron, serveur MCP
 * empaqueté par esbuild) et dans la page (Vite), et un import statique est la seule forme que tous comprennent. Un
 * test vérifie que chaque fichier du dossier figure dans la liste.
 */
export const FICHIERS_DE_REGLES: readonly ReglesFiscales[] = [regles2024, regles2025, regles2026]

/**
 * L'année en cours du simulateur : la dernière dont un fichier de règles existe. C'est l'année d'une nouvelle session
 * et celle qu'annoncent la démo et ses textes ; elle avance d'elle-même quand le fichier d'une année plus récente est
 * ajouté. Les calculs, eux, prennent toujours les règles de l'année simulée (`reglesDeLAnnee`), jamais celles-ci.
 */
export const ANNEE_COURANTE = Math.max(...FICHIERS_DE_REGLES.map(regles => regles.annee))
