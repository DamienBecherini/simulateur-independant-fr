// src/backend/logic/calculsEI.ts

import { avertissementCotisationsMinimales, calculerCotisationsTNS, type CotisationsTNS } from "./cotisationsTNS.js"
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
  /** Détail des cotisations de l'entrepreneur, travailleur non salarié. */
  cotisationsTNS: CotisationsTNS
  /** Bénéfice après cotisations : ce que l'entrepreneur encaisse (négatif en cas de déficit). */
  revenuNet: number
  /** Bénéfice imposable à l'IR : le revenu net, augmenté de la CSG non déductible et de la CRDS. */
  revenuImposable: number
  warnings: string[]
}

/**
 * Entreprise individuelle au régime réel, imposée à l'impôt sur le revenu : tout le bénéfice revient à
 * l'entrepreneur, travailleur non salarié. Ses cotisations se calculent sur le bénéfice avant cotisations ;
 * elles sont déductibles du bénéfice imposable, sauf la CSG non déductible et la CRDS. En cas de déficit,
 * seules les cotisations minimales sont dues, et le déficit vient en déduction des autres revenus du foyer.
 */
export function calculerEI({ chiffreAffaires, chargesDeductibles }: EntreesEI, regles: ReglesFiscales = reglesEnVigueur): ResultatEI {
  const beneficeAvantCotisations = chiffreAffaires - chargesDeductibles
  const cotisationsTNS = calculerCotisationsTNS(beneficeAvantCotisations, regles.TNS)
  const revenuNet = beneficeAvantCotisations - cotisationsTNS.total

  const warnings = avertissementCotisationsMinimales(cotisationsTNS, "des indépendants")
  if (revenuNet < 0) {
    warnings.push(`L'entreprise est déficitaire de ${euros(-revenuNet)}, cotisations comprises : le déficit est imputé sur les autres revenus du foyer ; son report sur les années suivantes n'est pas modélisé.`)
  }
  return {
    chiffreAffaires,
    chargesDeductibles,
    cotisationsSociales: cotisationsTNS.total,
    cotisationsTNS,
    revenuNet,
    revenuImposable: revenuNet + cotisationsTNS.partNonDeductible,
    warnings
  }
}
