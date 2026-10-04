// src/backend/logic/protection-sociale.ts

import type { ProtectionSociale, StatutCompare } from "../../types.js"
import type { ReglesFiscales, TauxMicro } from "./regles.js"

/*
 * Note qualitative de protection sociale, sur 5 étoiles, pour le comparateur. Elle combine le régime
 * (assimilé salarié, travailleur non salarié, micro-entrepreneur) et le nombre de trimestres de retraite
 * validés dans l'année. Aucun statut d'indépendant n'ouvre droit à l'assurance chômage : la cinquième
 * étoile, celle du salarié classique, n'est jamais atteinte.
 */

export interface DonneesProtection {
  /** Rémunération nette du président de SASU sur l'année. */
  remunerationNette: number
  /** Cotisations sociales de l'activité (gérant d'EURL, entrepreneur individuel au réel). */
  cotisationsTNS: number
  /** Chiffre d'affaires annuel par nature, pour une micro-entreprise. */
  chiffreAffairesMicro: { caVente: number; caServicesBic: number; caServicesBnc: number }
  /** Micro-entreprise bénéficiant de l'ACRE : les cotisations, donc les droits, sont réduits. */
  beneficieACRE?: boolean
}

function trimestresValides(revenuCotise: number, regles: ReglesFiscales): number {
  return Math.max(0, Math.min(4, Math.floor(revenuCotise / regles.protectionSociale.revenuParTrimestre)))
}

function texteTrimestres(trimestres: number): string {
  return `${trimestres} trimestre${trimestres > 1 ? "s" : ""} de retraite validé${trimestres > 1 ? "s" : ""} sur 4`
}

/** Président de SASU : tout dépend de sa rémunération, convertie en brut pour la validation des trimestres. */
function protectionSASU(remunerationNette: number, regles: ReglesFiscales): ProtectionSociale {
  if (remunerationNette <= 0) {
    return { etoiles: 1, trimestres: 0, resume: "Sans rémunération, aucune couverture liée au mandat : frais de santé par la protection universelle maladie, mais ni trimestre de retraite, ni indemnités journalières, ni prévoyance." }
  }
  const brut = remunerationNette / regles.protectionSociale.tauxNetSurBrutSalarie
  const trimestres = trimestresValides(brut, regles)
  const couverture = "Régime général : maladie, accidents du travail, retraite de base et complémentaire, prévoyance ; pas d'assurance chômage"
  return { etoiles: trimestres === 4 ? 4 : 3, trimestres, resume: `${couverture}. ${texteTrimestres(trimestres)}.` }
}

/** Gérant d'EURL ou entrepreneur individuel au réel : régime des indépendants, avec un plancher grâce aux cotisations minimales. */
function protectionTNS(cotisations: number, regles: ReglesFiscales): ProtectionSociale {
  const revenuCotise = cotisations / regles.TNS.tauxCotisationsSurRevenuNet
  // Les cotisations minimales valident à elles seules 3 trimestres.
  const trimestres = Math.max(3, trimestresValides(revenuCotise, regles))
  return {
    etoiles: 3,
    trimestres,
    resume: `Régime des indépendants : retraite de base et complémentaire, indemnités journalières après un an d'affiliation, invalidité-décès ; pas de couverture accidents du travail ni de chômage. ${texteTrimestres(trimestres)} (3 au minimum grâce aux cotisations minimales).`
  }
}

/** Micro-entrepreneur : mêmes droits que les indépendants, mais proportionnels au chiffre d'affaires, sans aucun minimum. */
function protectionMicro(ca: DonneesProtection["chiffreAffairesMicro"], beneficieACRE: boolean, regles: ReglesFiscales): ProtectionSociale {
  const taux: TauxMicro = regles.microEntreprise.cotisations
  const part = regles.protectionSociale.partRetraiteDeBaseMicro
  const reduction = beneficieACRE ? 1 - regles.microEntreprise.reductionACRE : 1
  const cotisationsRetraite = (ca.caVente * taux.venteBic * part.venteBic + ca.caServicesBic * taux.servicesBic * part.servicesBic + ca.caServicesBnc * taux.servicesBnc * part.servicesBnc) * reduction
  const trimestres = trimestresValides(cotisationsRetraite / regles.protectionSociale.tauxRetraiteDeBase, regles)
  return {
    etoiles: trimestres === 4 ? 2 : 1,
    trimestres,
    resume: `Régime des indépendants, avec des droits proportionnels au chiffre d'affaires et aucun minimum : retraite et indemnités journalières faibles, voire nulles, à faible chiffre d'affaires ; pas de couverture accidents du travail ni de chômage. ${texteTrimestres(trimestres)}${beneficieACRE ? ", en tenant compte des cotisations réduites par l'ACRE" : ""}.`
  }
}

export function evaluerProtectionSociale(statut: StatutCompare, donnees: DonneesProtection, regles: ReglesFiscales): ProtectionSociale {
  if (statut === "SASU") return protectionSASU(donnees.remunerationNette, regles)
  if (statut === "EURL" || statut === "EI") return protectionTNS(donnees.cotisationsTNS, regles)
  return protectionMicro(donnees.chiffreAffairesMicro, donnees.beneficieACRE ?? false, regles)
}
