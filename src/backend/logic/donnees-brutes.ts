// src/backend/logic/donnees-brutes.ts
// Lecture prudente d'un fichier encore non validé (session, sauvegardes, réglages du comparateur) : un objet JSON
// quelconque, dont on teste la forme avant d'en lire un champ. Partagé par la conversion, le nettoyage et la fusion.

/** Un objet JSON lu tel quel, avant tout schéma. */
export type DonneesBrutes = Record<string, unknown>

/** Vrai pour un objet JSON (ni `null`, ni un tableau). */
export function estObjet(valeur: unknown): valeur is DonneesBrutes {
  return typeof valeur === "object" && valeur !== null && !Array.isArray(valeur)
}
