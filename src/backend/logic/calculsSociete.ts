// src/backend/logic/calculsSociete.ts

import type { DetailCotisationsSalarie, EtatDeLaSociete, ReservesDeLaSociete } from "../../types.js"
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
  /** Capital social : la réserve légale en dépend. Absent : aucune réserve légale. */
  capitalSocial?: number
  /** Ce que la société a gardé des années précédentes (voir l'ADR 014). Absent : ni réserves ni déficit, réserve légale constituée. */
  etat?: EtatDeLaSociete
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
  /** Dividendes effectivement versés, plafonnés au bénéfice distribuable de l'année augmenté des réserves. */
  dividendesVerses: number
  /** Part des dividendes soumise aux prélèvements sociaux. */
  dividendesSoumisPS: number
  /** Cotisations sociales dues par le gérant sur la part des dividendes qui y est soumise (EURL). */
  cotisationsSurDividendes: number
  /**
   * Bénéfice après IS de l'année moins les dividendes versés : ce que les réserves gagnent dans l'année (négatif si la
   * société est déficitaire, ou si elle distribue plus que son bénéfice de l'année en puisant dans ses réserves).
   */
  resultatConserve: number
  /** Les réserves de la société, du 1er janvier au 31 décembre. */
  reserves: ReservesDeLaSociete
  /** EURL : détail des cotisations du gérant, travailleur non salarié, sur sa rémunération et ses dividendes. */
  cotisationsTNS?: CotisationsTNS
  /** SASU : bulletin de paie du président, assimilé salarié. */
  cotisationsPresident?: DetailCotisationsSalarie
  warnings: string[]
}

/** Impôt sur les sociétés : taux réduit jusqu'au plafond, taux normal au-delà. */
export function calculerIS(benefice: number, regles: Pick<ReglesFiscales["IS"], "tauxReduit" | "plafondTauxReduit" | "tauxNormal">): number {
  if (benefice <= 0) return 0
  const partTauxReduit = Math.min(benefice, regles.plafondTauxReduit)
  return partTauxReduit * regles.tauxReduit + (benefice - partTauxReduit) * regles.tauxNormal
}

/**
 * Déficit des années précédentes déduit du bénéfice de l'année (article 209 I du CGI) : au plus le plafond fixe, plus
 * une part du bénéfice qui le dépasse, sans dépasser le bénéfice ni le déficit reportable.
 */
export function deficitImputable(benefice: number, deficitReportable: number, regles: ReglesFiscales["IS"]["reportEnAvantDesDeficits"]): number {
  if (benefice <= 0 || deficitReportable <= 0) return 0
  const limite = regles.plafondFixe + Math.max(0, benefice - regles.plafondFixe) * regles.partAuDela
  return Math.min(deficitReportable, benefice, limite)
}

/**
 * Dotation à la réserve légale (article L232-10 du code de commerce) : une part du bénéfice de l'année diminué des
 * pertes antérieures, tant que la réserve n'atteint pas sa part du capital.
 */
export function dotationReserveLegale(beneficeNet: number, etat: EtatDeLaSociete, capitalSocial: number, regles: ReglesFiscales["reserveLegale"]): number {
  const base = beneficeNet + Math.min(0, etat.reserves)
  const manque = Math.max(0, capitalSocial * regles.plafondPartDuCapital - etat.reserveLegale)
  return base > 0 ? Math.min(base * regles.partDuBenefice, manque) : 0
}

/** Ni réserves ni déficit, réserve légale déjà constituée : une société qui existait avant la simulation. */
export function etatSansReserves(capitalSocial: number | undefined, regles: ReglesFiscales["reserveLegale"]): EtatDeLaSociete {
  return { reserves: 0, reserveLegale: (capitalSocial ?? 0) * regles.plafondPartDuCapital, deficitReportable: 0 }
}

/**
 * Tronc commun des sociétés à l'IS : la rémunération et ses cotisations sont des charges ; le bénéfice restant, après
 * imputation des déficits antérieurs, supporte l'IS ; une part du bénéfice après IS va à la réserve légale tant qu'elle
 * n'est pas constituée. Les dividendes saisis sont distribués dans la limite du bénéfice distribuable de l'année et des
 * réserves des années précédentes : l'IS a déjà été payé sur ces réserves, il n'est pas dû une seconde fois.
 */
export function calculerResultatSociete(entrees: EntreesSociete, cotisationsRemuneration: number, regles: Pick<ReglesFiscales, "IS" | "reserveLegale">): ResultatSociete {
  const { chiffreAffaires, chargesDeductibles, remunerationNette, dividendesDemandes } = entrees
  const auDebut = entrees.etat ?? etatSansReserves(entrees.capitalSocial, regles.reserveLegale)
  const warnings: string[] = []

  const beneficeAvantIS = chiffreAffaires - chargesDeductibles - remunerationNette - cotisationsRemuneration
  const deficitImpute = deficitImputable(beneficeAvantIS, auDebut.deficitReportable, regles.IS.reportEnAvantDesDeficits)
  const impotSocietes = calculerIS(beneficeAvantIS - deficitImpute, regles.IS)
  const beneficeNet = beneficeAvantIS - impotSocietes
  const dotation = dotationReserveLegale(beneficeNet, auDebut, entrees.capitalSocial ?? 0, regles.reserveLegale)
  // Ce que la société peut distribuer : le bénéfice de l'année après la réserve légale, et ses réserves ; des pertes
  // antérieures, s'il y en a, s'imputent d'abord.
  const disponibleAvantDividendes = beneficeNet - dotation + auDebut.reserves
  const distribuable = Math.max(0, disponibleAvantDividendes)
  const beneficeDistribuableDeLAnnee = Math.max(0, Math.min(distribuable, beneficeNet - dotation))
  const dividendesVerses = Math.min(dividendesDemandes, distribuable)

  if (beneficeAvantIS < 0) {
    warnings.push(`La société est déficitaire de ${euros(-beneficeAvantIS)} : les charges et la rémunération (cotisations comprises) dépassent le chiffre d'affaires.`)
  }
  // Tolérance d'un demi-euro : le comparateur demande exactement le bénéfice distribuable, aux arrondis près.
  if (dividendesDemandes > distribuable + 0.5) {
    const quoi = auDebut.reserves > 0 ? "au bénéfice distribuable de l'année augmenté des réserves" : "au bénéfice distribuable"
    warnings.push(`Dividendes saisis (${euros(dividendesDemandes)}) supérieurs ${quoi} (${euros(distribuable)}) : seul ce dernier est retenu.`)
  }

  const aLaFin: EtatDeLaSociete = {
    reserves: disponibleAvantDividendes - dividendesVerses,
    reserveLegale: auDebut.reserveLegale + dotation,
    deficitReportable: auDebut.deficitReportable - deficitImpute + Math.max(0, -beneficeAvantIS)
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
    resultatConserve: beneficeNet - dividendesVerses,
    reserves: {
      auDebut,
      aLaFin,
      deficitImpute,
      dotationReserveLegale: dotation,
      beneficeDistribuableDeLAnnee,
      distribuable,
      dividendesPrisSurLesReserves: Math.max(0, dividendesVerses - beneficeDistribuableDeLAnnee)
    },
    warnings
  }
}
