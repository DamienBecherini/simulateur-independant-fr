// src/backend/logic/calculsAE.ts

import { euros } from "./format.js"
import { reglesEnVigueur, type ReglesFiscales, type TauxMicro } from "./regles.js"

export interface EntreesMicro {
  caVente: number
  caServicesBic: number
  caServicesBnc: number
  beneficieACRE: boolean
  /**
   * Avec l'ACRE et une date de création connue : le chiffre d'affaires des seuls mois couverts par l'aide, et sa réduction.
   * Absents, la réduction de l'année (reductionACRE) porte sur tout le chiffre d'affaires.
   */
  caSousACRE?: ChiffreAffairesMicro
  reductionACRE?: number
  /** Part des plafonds du régime qui s'applique : moins de 1 l'année de création (prorata des jours d'activité). */
  prorataPlafonds?: number
  opteVFL: boolean
}

/** Chiffre d'affaires d'une micro-entreprise, par nature d'activité. */
export type ChiffreAffairesMicro = Pick<EntreesMicro, "caVente" | "caServicesBic" | "caServicesBnc">

export interface ResultatMicro {
  chiffreAffaires: number
  cotisationsSociales: number
  /** Revenu soumis au barème de l'IR (nul si le versement libératoire est choisi). */
  revenuImposable: number
  /** Chiffre d'affaires après abattement, versement libératoire ou non : il entre dans le revenu fiscal de référence. */
  revenuApresAbattement: number
  /** Impôt sur le revenu payé avec les cotisations, en pourcentage du chiffre d'affaires. */
  versementLiberatoire: number
  warnings: string[]
}

type ReglesMicro = ReglesFiscales["microEntreprise"]

/** Applique un taux par nature d'activité au chiffre d'affaires correspondant. */
function appliquerTaux({ caVente, caServicesBic, caServicesBnc }: ChiffreAffairesMicro, taux: TauxMicro): number {
  return caVente * taux.venteBic + caServicesBic * taux.servicesBic + caServicesBnc * taux.servicesBnc
}

/**
 * Chiffre d'affaires au-delà des plafonds du régime : prestations de services au-delà du plafond des services,
 * ou chiffre d'affaires total au-delà de celui de la vente. Le régime est conservé si cela n'arrive qu'une année ;
 * deux années de suite, il prend fin au 1er janvier suivant (pas de seuil qui fasse sortir immédiatement). L'année de
 * création, les plafonds sont réduits au prorata des jours d'activité (`prorata`, voir dispositifs.ts).
 */
export function depassePlafondMicro(ca: ChiffreAffairesMicro, regles: ReglesFiscales = reglesEnVigueur, prorata = 1): boolean {
  const plafonds = plafondsAuProrata(regles.microEntreprise.plafonds, prorata)
  const services = ca.caServicesBic + ca.caServicesBnc
  return services > plafonds.services || ca.caVente + services > plafonds.vente
}

function plafondsAuProrata(plafonds: ReglesMicro["plafonds"], prorata: number): ReglesMicro["plafonds"] {
  return { services: plafonds.services * prorata, vente: plafonds.vente * prorata }
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
 * Franchise en base de TVA : comme pour les plafonds, les prestations de services sont comparées au seuil des services
 * et le chiffre d'affaires total à celui de la vente. Le seuil majoré fait perdre la franchise immédiatement,
 * le seuil de base seulement l'année suivante. La TVA n'est pas calculée : les montants saisis sont hors taxe.
 */
function verifierFranchiseTVA(entrees: EntreesMicro, seuils: ReglesFiscales["TVA"]): string[] {
  const caServices = entrees.caServicesBic + entrees.caServicesBnc
  const caTotal = entrees.caVente + caServices
  const depasse = (seuil: "franchiseBase" | "seuilMajore") => {
    const depassements: string[] = []
    if (caServices > seuils.services[seuil]) depassements.push(`prestations de services ${euros(caServices)} pour un seuil de ${euros(seuils.services[seuil])}`)
    if (caTotal > seuils.vente[seuil]) depassements.push(`chiffre d'affaires total ${euros(caTotal)} pour un seuil de ${euros(seuils.vente[seuil])}`)
    return depassements.join(" ; ")
  }
  const nonCalculee = "Le simulateur ne calcule pas la TVA : il considère les montants saisis comme hors taxe."
  const majore = depasse("seuilMajore")
  if (majore) return [`Franchise en base de TVA perdue (${majore}) : la TVA est due dès le jour du dépassement. ${nonCalculee}`]
  const base = depasse("franchiseBase")
  if (base) return [`Seuil de franchise en base de TVA dépassé (${base}) : la TVA sera due à partir du 1er janvier suivant. ${nonCalculee}`]
  return []
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
  const warnings = [...verifierPlafonds(entrees, plafondsAuProrata(micro.plafonds, entrees.prorataPlafonds ?? 1)), ...verifierFranchiseTVA(entrees, regles.TVA)]

  const cotisationsPleinTaux = appliquerTaux(entrees, micro.cotisations)
  const revenuApresAbattement = calculerRevenuImposable(entrees, micro.abattement)
  // Sans date de création, la réduction de l'année porte sur tout le chiffre d'affaires ; avec elle, le moteur donne le
  // chiffre d'affaires des seuls mois couverts (voir dispositifs.ts) et le dit dans une note de l'activité.
  const reductionACRE = entrees.beneficieACRE ? appliquerTaux(entrees.caSousACRE ?? entrees, micro.cotisations) * (entrees.reductionACRE ?? micro.reductionACRE) : 0
  if (entrees.beneficieACRE && !entrees.caSousACRE) {
    warnings.push(`ACRE : cotisations réduites de ${Math.round(micro.reductionACRE * 100)} %. Elles financent aussi vos droits : pendant l'aide, vous validez moins de trimestres de retraite et vos indemnités journalières sont plus faibles.`)
  }

  return {
    chiffreAffaires: entrees.caVente + entrees.caServicesBic + entrees.caServicesBnc,
    cotisationsSociales: cotisationsPleinTaux - reductionACRE,
    revenuImposable: entrees.opteVFL ? 0 : revenuApresAbattement,
    revenuApresAbattement,
    versementLiberatoire: entrees.opteVFL ? appliquerTaux(entrees, micro.versementLiberatoire.taux) : 0,
    warnings
  }
}
