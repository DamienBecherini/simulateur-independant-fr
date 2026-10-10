// src/lib/regles-affichees.ts
// Les règles qu'un texte de l'interface ou d'un export cite pour une année : taux, seuils, cotisations du salaire.

import { PREMIERE_ANNEE_DES_REGLES, reglesDeLAnnee, reglesPubliees, type ReglesFiscales } from "@/backend/logic/regles"

/**
 * Les règles de l'année affichée ou exportée : celles avec lesquelles l'année est simulée (les dernières connues
 * au-delà). Une année d'avant les premières règles n'est pas simulée, mais ses fiches restent modifiables : les textes
 * prennent alors les règles de la première année connue, les plus proches.
 */
export function reglesDeLAnneeAffichee(annee: number): ReglesFiscales {
  return reglesDeLAnnee(annee).regles ?? reglesPubliees(PREMIERE_ANNEE_DES_REGLES)
}
