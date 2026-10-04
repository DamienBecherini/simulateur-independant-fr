// src/backend/logic/calculsSASU.ts

import { calculerResultatSociete, type EntreesSociete, type ResultatSociete } from "./calculsSociete.js"
import { reglesEnVigueur, type ReglesFiscales } from "./regles.js"

/**
 * SASU à l'IS : le président est assimilé salarié. Ses cotisations (salariales et patronales)
 * sont approchées par un ratio entre le coût total pour la société et le net versé.
 * Les dividendes supportent les prélèvements sociaux, jamais de cotisations.
 */
export function calculerSASU(entrees: EntreesSociete, regles: ReglesFiscales = reglesEnVigueur): ResultatSociete {
  const cotisationsRemuneration = entrees.remunerationNette * (regles.SASU.ratioCoutTotalSurNet - 1)
  return calculerResultatSociete(entrees, cotisationsRemuneration, regles.IS)
}
