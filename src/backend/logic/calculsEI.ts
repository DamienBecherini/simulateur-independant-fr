// src/backend/logic/calculsEI.ts

import { euros } from "./format.js"
import { reglesEnVigueur, type ReglesFiscales } from "./regles.js"

export interface EntreesEI {
  chiffreAffaires: number
  chargesDeductibles: number
}

export interface ResultatEI {
  chiffreAffaires: number
  chargesDeductibles: number
  cotisationsSociales: number
  /** Bénéfice après cotisations : c'est à la fois ce que l'entrepreneur encaisse et ce qui est imposé à l'IR. */
  revenuNet: number
  warnings: string[]
}

/**
 * Entreprise individuelle au régime réel, imposée à l'impôt sur le revenu : tout le bénéfice
 * revient à l'entrepreneur, qui paie des cotisations de travailleur non salarié (approchées par
 * un taux sur le revenu net). Un déficit ne produit ni cotisations ni revenu imposable.
 */
export function calculerEI({ chiffreAffaires, chargesDeductibles }: EntreesEI, regles: ReglesFiscales = reglesEnVigueur): ResultatEI {
  const beneficeAvantCotisations = chiffreAffaires - chargesDeductibles

  if (beneficeAvantCotisations <= 0) {
    const warnings = beneficeAvantCotisations < 0 ? [`L'entreprise est déficitaire de ${euros(-beneficeAvantCotisations)} : les cotisations minimales et le report du déficit ne sont pas modélisés.`] : []
    return { chiffreAffaires, chargesDeductibles, cotisationsSociales: 0, revenuNet: beneficeAvantCotisations, warnings }
  }

  const revenuNet = beneficeAvantCotisations / (1 + regles.TNS.tauxCotisationsSurRevenuNet)
  return { chiffreAffaires, chargesDeductibles, cotisationsSociales: beneficeAvantCotisations - revenuNet, revenuNet, warnings: [] }
}
