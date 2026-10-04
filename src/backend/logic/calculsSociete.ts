// src/backend/logic/calculsSociete.ts

import type { DetailCotisationsSalarie } from "../../types.js"
import type { CotisationsTNS } from "./cotisationsTNS.js"
import { euros } from "./format.js"
import type { ReglesFiscales } from "./regles.js"

export interface EntreesSociete {
  chiffreAffaires: number
  chargesDeductibles: number
  /** Rémunération nette versée au dirigeant sur l'année. */
  remunerationNette: number
  /** Dividendes que l'utilisateur souhaite verser (flux saisis dans la grille). */
  dividendesDemandes: number
}

/** Résultat annuel d'une société à l'IS, avant toute imposition personnelle des bénéficiaires. */
export interface ResultatSociete {
  chiffreAffaires: number
  chargesDeductibles: number
  remunerationNette: number
  /** Rémunération imposée comme un salaire : la nette, augmentée de la CSG non déductible et de la CRDS du dirigeant. */
  remunerationImposable: number
  /** Cotisations sociales sur la rémunération, et sur les dividendes pour une EURL. */
  cotisationsSociales: number
  beneficeAvantIS: number
  impotSocietes: number
  /** Dividendes effectivement versés, plafonnés au bénéfice distribuable. */
  dividendesVerses: number
  /** Part des dividendes soumise aux prélèvements sociaux. */
  dividendesSoumisPS: number
  /** Cotisations sociales dues par le gérant sur la part des dividendes qui y est soumise (EURL). */
  cotisationsSurDividendes: number
  /** Bénéfice après IS qui reste dans la société (négatif si elle est déficitaire). */
  resultatConserve: number
  /** EURL : détail des cotisations du gérant, travailleur non salarié, sur sa rémunération et ses dividendes. */
  cotisationsTNS?: CotisationsTNS
  /** SASU : bulletin de paie du président, assimilé salarié. */
  cotisationsPresident?: DetailCotisationsSalarie
  warnings: string[]
}

/** Impôt sur les sociétés : taux réduit jusqu'au plafond, taux normal au-delà. */
export function calculerIS(benefice: number, regles: ReglesFiscales["IS"]): number {
  if (benefice <= 0) return 0
  const partTauxReduit = Math.min(benefice, regles.plafondTauxReduit)
  return partTauxReduit * regles.tauxReduit + (benefice - partTauxReduit) * regles.tauxNormal
}

/**
 * Tronc commun des sociétés à l'IS : la rémunération et ses cotisations sont des charges,
 * le bénéfice restant supporte l'IS, et seuls les dividendes saisis sont distribués.
 */
export function calculerResultatSociete(entrees: EntreesSociete, cotisationsRemuneration: number, regles: ReglesFiscales["IS"]): ResultatSociete {
  const { chiffreAffaires, chargesDeductibles, remunerationNette, dividendesDemandes } = entrees
  const warnings: string[] = []

  const beneficeAvantIS = chiffreAffaires - chargesDeductibles - remunerationNette - cotisationsRemuneration
  const impotSocietes = calculerIS(beneficeAvantIS, regles)
  const beneficeDistribuable = Math.max(0, beneficeAvantIS - impotSocietes)
  const dividendesVerses = Math.min(dividendesDemandes, beneficeDistribuable)

  if (beneficeAvantIS < 0) {
    warnings.push(`La société est déficitaire de ${euros(-beneficeAvantIS)} : les charges et la rémunération (cotisations comprises) dépassent le chiffre d'affaires.`)
  }
  // Tolérance d'un demi-euro : le comparateur demande exactement le bénéfice distribuable, aux arrondis près.
  if (dividendesDemandes > beneficeDistribuable + 0.5) {
    warnings.push(`Dividendes saisis (${euros(dividendesDemandes)}) supérieurs au bénéfice distribuable (${euros(beneficeDistribuable)}) : seul ce dernier est retenu.`)
  }

  return {
    chiffreAffaires,
    chargesDeductibles,
    remunerationNette,
    remunerationImposable: remunerationNette,
    cotisationsSociales: cotisationsRemuneration,
    beneficeAvantIS,
    impotSocietes,
    dividendesVerses,
    dividendesSoumisPS: dividendesVerses,
    cotisationsSurDividendes: 0,
    resultatConserve: beneficeAvantIS - impotSocietes - dividendesVerses,
    warnings
  }
}
