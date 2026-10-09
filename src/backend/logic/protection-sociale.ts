// src/backend/logic/protection-sociale.ts

import type { CaisseLiberale, ProtectionSociale, StatutCompare } from "../../types.js"
import type { ReglesFiscales, TauxMicro } from "./regles.js"

/*
 * Note qualitative de protection sociale, sur 5 étoiles, pour le comparateur. Elle combine le régime
 * (assimilé salarié, travailleur non salarié, micro-entrepreneur) et le nombre de trimestres de retraite
 * validés dans l'année. Aucun statut d'indépendant n'ouvre droit à l'assurance chômage : la cinquième
 * étoile, celle du salarié classique, n'est jamais atteinte.
 */

export interface DonneesProtection {
  /** Rémunération brute du président de SASU sur l'année, celle sur laquelle il cotise à la retraite de base. */
  remunerationBrute: number
  /** Assiette sociale de l'année du gérant d'EURL ou de l'entrepreneur individuel au réel, après l'abattement forfaitaire. */
  assietteTNS: number
  /** Chiffre d'affaires annuel par nature, pour une micro-entreprise. */
  chiffreAffairesMicro: { caVente: number; caServicesBic: number; caServicesBnc: number }
  /** Micro-entreprise bénéficiant de l'ACRE : les cotisations, donc les droits, sont réduits. */
  beneficieACRE?: boolean
  /**
   * Avec une date de création connue : la réduction de l'ACRE et le chiffre d'affaires des seuls mois qu'elle couvre.
   * Absente, la réduction de l'année porte sur tout le chiffre d'affaires.
   */
  acre?: { reduction: number; chiffreAffaires: DonneesProtection["chiffreAffairesMicro"] }
  /** Gérant d'EURL ou entrepreneur individuel d'une profession libérale réglementée : sa caisse (voir l'ADR 015). */
  caisse?: CaisseLiberale
  /**
   * Micro-entrepreneur de la CIPAV : part de son taux global affectée à la retraite de base, et taux de la retraite de
   * base auquel la ramener pour compter les trimestres de ses BNC.
   */
  retraiteBnc?: { partRetraiteDeBase: number; tauxRetraiteDeBase: number }
}

/** Couverture d'un indépendant selon sa caisse : celle des indépendants, ou celle d'un libéral réglementé. */
const COUVERTURE_TNS: Record<CaisseLiberale | "SSI", string> = {
  SSI: "Régime des indépendants : retraite de base et complémentaire, indemnités journalières après un an d'affiliation, invalidité-décès ; pas de couverture accidents du travail ni de chômage.",
  CIPAV: "Profession libérale de la CIPAV : retraite de base des libéraux (CNAVPL) et complémentaire de la CIPAV, invalidité-décès proportionnelle au revenu, indemnités journalières de l'Assurance maladie (du 4e au 90e jour, depuis 2021) ; pas de couverture accidents du travail ni de chômage.",
  CARPIMKO: "Auxiliaire médical de la CARPIMKO : retraite de base des libéraux (CNAVPL), complémentaire et, conventionné, avantage social vieillesse ; indemnités journalières de l'Assurance maladie du 4e au 90e jour, puis de la CARPIMKO ; rente d'invalidité forfaitaire ; pas de chômage."
}

function trimestresValides(revenuCotise: number, regles: ReglesFiscales): number {
  return Math.max(0, Math.min(4, Math.floor(revenuCotise / regles.protectionSociale.revenuParTrimestre)))
}

function texteTrimestres(trimestres: number): string {
  return `${trimestres} trimestre${trimestres > 1 ? "s" : ""} de retraite validé${trimestres > 1 ? "s" : ""} sur 4`
}

/** Président de SASU : tout dépend de sa rémunération brute, sur laquelle il cotise à la retraite de base. */
function protectionSASU(remunerationBrute: number, regles: ReglesFiscales): ProtectionSociale {
  if (remunerationBrute <= 0) {
    return { etoiles: 1, trimestres: 0, resume: "Sans rémunération, aucune couverture liée au mandat : frais de santé par la protection universelle maladie, mais ni trimestre de retraite, ni indemnités journalières, ni prévoyance." }
  }
  const trimestres = trimestresValides(remunerationBrute, regles)
  const couverture = "Régime général : maladie, accidents du travail, retraite de base et complémentaire, prévoyance ; pas d'assurance chômage"
  return { etoiles: trimestres === 4 ? 4 : 3, trimestres, resume: `${couverture}. ${texteTrimestres(trimestres)}.` }
}

/**
 * Gérant d'EURL ou entrepreneur individuel au réel : régime des indépendants. La retraite de base est cotisée
 * sur l'assiette sociale, au moins sur son assiette minimale, qui garantit un plancher de trimestres.
 */
function protectionTNS(assiette: number, regles: ReglesFiscales, caisse?: CaisseLiberale): ProtectionSociale {
  // Un libéral réglementé a l'assiette minimale de la CNAVPL (450 heures au SMIC horaire, comme les indépendants).
  const assietteMinimale = caisse ? regles.liberauxReglementes.commun.cotisationsMinimales.retraiteDeBase : regles.TNS.cotisationsMinimales.retraiteDeBase
  const trimestres = trimestresValides(Math.max(assiette, assietteMinimale), regles)
  return {
    etoiles: 3,
    trimestres,
    resume: `${COUVERTURE_TNS[caisse ?? "SSI"]} ${texteTrimestres(trimestres)} (${trimestresValides(assietteMinimale, regles)} au minimum grâce aux cotisations minimales).`
  }
}

/** Micro-entrepreneur : mêmes droits que les indépendants, mais proportionnels au chiffre d'affaires, sans aucun minimum. */
function protectionMicro({ chiffreAffairesMicro: ca, beneficieACRE = false, acre, retraiteBnc }: DonneesProtection, regles: ReglesFiscales): ProtectionSociale {
  const taux: TauxMicro = regles.microEntreprise.cotisations
  const part = regles.protectionSociale.partRetraiteDeBaseMicro
  const tauxRetraite = regles.protectionSociale.tauxRetraiteDeBase
  // Revenu validant : la part retraite des cotisations de chaque nature, ramenée au taux de sa retraite de base. Les BNC
  // d'un affilié de la CIPAV ont leur propre part et leur propre taux (ceux de la CNAVPL).
  const bnc = retraiteBnc ?? { partRetraiteDeBase: part.servicesBnc, tauxRetraiteDeBase: tauxRetraite }
  const retraite = (c: DonneesProtection["chiffreAffairesMicro"]) => (c.caVente * taux.venteBic * part.venteBic + c.caServicesBic * taux.servicesBic * part.servicesBic) / tauxRetraite + (c.caServicesBnc * taux.servicesBnc * bnc.partRetraiteDeBase) / bnc.tauxRetraiteDeBase
  // Sans date de création, l'ACRE réduit toute l'année ; avec elle, les seuls mois qu'elle couvre.
  const sousACRE = beneficieACRE ? (acre ?? { reduction: regles.microEntreprise.reductionACRE, chiffreAffaires: ca }) : { reduction: 0, chiffreAffaires: ca }
  const trimestres = trimestresValides(retraite(ca) - retraite(sousACRE.chiffreAffaires) * sousACRE.reduction, regles)
  const regime = retraiteBnc ? "Profession libérale de la CIPAV, avec des droits proportionnels au chiffre d'affaires et aucun minimum" : "Régime des indépendants, avec des droits proportionnels au chiffre d'affaires et aucun minimum"
  return {
    etoiles: trimestres === 4 ? 2 : 1,
    trimestres,
    resume: `${regime} : retraite et indemnités journalières faibles, voire nulles, à faible chiffre d'affaires ; pas de couverture accidents du travail ni de chômage. ${texteTrimestres(trimestres)}${retraite(sousACRE.chiffreAffaires) * sousACRE.reduction > 0 ? ", en tenant compte des cotisations réduites par l'ACRE" : ""}.`
  }
}

export function evaluerProtectionSociale(statut: StatutCompare, donnees: DonneesProtection, regles: ReglesFiscales): ProtectionSociale {
  if (statut === "SASU") return protectionSASU(donnees.remunerationBrute, regles)
  if (statut === "EURL" || statut === "EI") return protectionTNS(donnees.assietteTNS, regles, donnees.caisse)
  return protectionMicro(donnees, regles)
}
