// src/backend/logic/calculsAE.ts

import { euros } from "./format.js"
import { reglesEnVigueur, type ReglesFiscales, type TauxMicro } from "./regles.js"

export interface EntreesMicro {
  caVente: number
  caServicesBic: number
  caServicesBnc: number
  beneficieACRE: boolean
  opteVFL: boolean
}

export interface ResultatMicro {
  chiffreAffaires: number
  cotisationsSociales: number
  /** Revenu soumis au barème de l'IR (nul si le versement libératoire est choisi). */
  revenuImposable: number
  /** Impôt sur le revenu payé avec les cotisations, en pourcentage du chiffre d'affaires. */
  versementLiberatoire: number
  warnings: string[]
}

type ReglesMicro = ReglesFiscales["microEntreprise"]

/** Applique un taux par nature d'activité au chiffre d'affaires correspondant. */
function appliquerTaux({ caVente, caServicesBic, caServicesBnc }: EntreesMicro, taux: TauxMicro): number {
  return caVente * taux.venteBic + caServicesBic * taux.servicesBic + caServicesBnc * taux.servicesBnc
}

/**
 * Une activité mixte doit respecter deux plafonds : le chiffre d'affaires total sous le plafond
 * de la vente, et sa part de prestations de services sous le plafond des services.
 */
function verifierPlafonds(entrees: EntreesMicro, plafonds: ReglesMicro["plafonds"]): string[] {
  const caServices = entrees.caServicesBic + entrees.caServicesBnc
  const caTotal = entrees.caVente + caServices
  const depassements: string[] = []
  if (caServices > plafonds.services) depassements.push(`prestations de services ${euros(caServices)} pour un plafond de ${euros(plafonds.services)}`)
  if (caTotal > plafonds.vente) depassements.push(`chiffre d'affaires total ${euros(caTotal)} pour un plafond de ${euros(plafonds.vente)}`)
  if (depassements.length === 0) return []
  return [`Plafond du régime micro dépassé (${depassements.join(" ; ")}) : le régime n'est conservé que si le dépassement ne se répète pas deux années de suite.`]
}

/** Revenu imposable après abattement forfaitaire, celui-ci ne pouvant être inférieur à un minimum par nature d'activité exercée. */
function calculerRevenuImposable(entrees: EntreesMicro, abattement: ReglesMicro["abattement"]): number {
  const chiffreAffaires = entrees.caVente + entrees.caServicesBic + entrees.caServicesBnc
  const naturesExercees = [entrees.caVente, entrees.caServicesBic, entrees.caServicesBnc].filter(ca => ca > 0).length
  const abattementApplique = Math.max(appliquerTaux(entrees, abattement), abattement.minimum * naturesExercees)
  return Math.max(0, chiffreAffaires - abattementApplique)
}

/**
 * Micro-entreprise : cotisations sociales en pourcentage du chiffre d'affaires (réduites avec l'ACRE),
 * puis soit un revenu imposable après abattement forfaitaire, soit le versement libératoire de l'impôt.
 */
export function calculerMicro(entrees: EntreesMicro, regles: ReglesFiscales = reglesEnVigueur): ResultatMicro {
  const micro = regles.microEntreprise
  const warnings = verifierPlafonds(entrees, micro.plafonds)

  if (entrees.opteVFL) {
    warnings.push(`Versement libératoire : l'option n'est ouverte que si le revenu fiscal de référence du foyer (année N-2) ne dépasse pas ${euros(micro.versementLiberatoire.plafondRfrParPart)} par part. Le simulateur ne vérifie pas cette condition.`)
  }

  const cotisationsPleinTaux = appliquerTaux(entrees, micro.cotisations)

  return {
    chiffreAffaires: entrees.caVente + entrees.caServicesBic + entrees.caServicesBnc,
    cotisationsSociales: entrees.beneficieACRE ? cotisationsPleinTaux * (1 - micro.reductionACRE) : cotisationsPleinTaux,
    revenuImposable: entrees.opteVFL ? 0 : calculerRevenuImposable(entrees, micro.abattement),
    versementLiberatoire: entrees.opteVFL ? appliquerTaux(entrees, micro.versementLiberatoire.taux) : 0,
    warnings
  }
}
