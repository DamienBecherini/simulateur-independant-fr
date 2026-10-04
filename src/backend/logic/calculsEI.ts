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
 * un taux sur le revenu net), au moins égales aux cotisations minimales. Un déficit vient en déduction des autres revenus du foyer.
 */
export function calculerEI({ chiffreAffaires, chargesDeductibles }: EntreesEI, regles: ReglesFiscales = reglesEnVigueur): ResultatEI {
  const beneficeAvantCotisations = chiffreAffaires - chargesDeductibles
  const minimum = regles.TNS.cotisationsMinimales
  const proportionnelles = beneficeAvantCotisations > 0 ? beneficeAvantCotisations - beneficeAvantCotisations / (1 + regles.TNS.tauxCotisationsSurRevenuNet) : 0
  const cotisationsSociales = Math.max(proportionnelles, minimum)
  const revenuNet = beneficeAvantCotisations - cotisationsSociales

  const warnings: string[] = []
  if (proportionnelles < minimum) {
    warnings.push(`Cotisations minimales des indépendants appliquées (${euros(minimum)} par an) : elles sont dues même sans revenu, et valident 3 trimestres de retraite.`)
  }
  if (revenuNet < 0) {
    warnings.push(`L'entreprise est déficitaire de ${euros(-revenuNet)}, cotisations comprises : le déficit est imputé sur les autres revenus du foyer ; son report sur les années suivantes n'est pas modélisé.`)
  }
  return { chiffreAffaires, chargesDeductibles, cotisationsSociales, revenuNet, warnings }
}
