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

/**
 * Abattement d'une fraction du chiffre d'affaires : son taux, sans descendre sous le minimum,
 * ni dépasser le chiffre d'affaires de la fraction.
 */
function abattementDeLaFraction(chiffreAffaires: number, taux: number, minimum: number): number {
  if (chiffreAffaires <= 0) return 0
  return Math.min(chiffreAffaires, Math.max(chiffreAffaires * taux, minimum))
}

/** Revenu imposable après abattement forfaitaire, calculé séparément pour chaque nature d'activité exercée. */
function calculerRevenuImposable(entrees: EntreesMicro, abattement: ReglesMicro["abattement"]): number {
  const fractions: [number, number][] = [
    [entrees.caVente, abattement.venteBic],
    [entrees.caServicesBic, abattement.servicesBic],
    [entrees.caServicesBnc, abattement.servicesBnc]
  ]
  return fractions.reduce((revenu, [chiffreAffaires, taux]) => revenu + chiffreAffaires - abattementDeLaFraction(chiffreAffaires, taux, abattement.minimum), 0)
}

/**
 * Seuil de revenu fiscal de référence N-2 qui ouvre le versement libératoire : un montant par part,
 * majoré de 50 % par demi-part (et de 25 % par quart de part), soit ce montant multiplié par le nombre de parts.
 */
export function plafondRfrVersementLiberatoire(partsFiscales: number, regles: ReglesFiscales = reglesEnVigueur): number {
  return regles.microEntreprise.versementLiberatoire.plafondRfrParPart * partsFiscales
}

/**
 * Micro-entreprise : cotisations sociales en pourcentage du chiffre d'affaires (réduites avec l'ACRE),
 * puis soit un revenu imposable après abattement forfaitaire, soit le versement libératoire de l'impôt.
 */
export function calculerMicro(entrees: EntreesMicro, regles: ReglesFiscales = reglesEnVigueur): ResultatMicro {
  const micro = regles.microEntreprise
  const warnings = verifierPlafonds(entrees, micro.plafonds)

  const cotisationsPleinTaux = appliquerTaux(entrees, micro.cotisations)

  return {
    chiffreAffaires: entrees.caVente + entrees.caServicesBic + entrees.caServicesBnc,
    cotisationsSociales: entrees.beneficieACRE ? cotisationsPleinTaux * (1 - micro.reductionACRE) : cotisationsPleinTaux,
    revenuImposable: entrees.opteVFL ? 0 : calculerRevenuImposable(entrees, micro.abattement),
    versementLiberatoire: entrees.opteVFL ? appliquerTaux(entrees, micro.versementLiberatoire.taux) : 0,
    warnings
  }
}
