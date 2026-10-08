// src/backend/logic/professions.ts

import type { Company, MicroEntreprise, ProfessionDeLActivite } from "../../types.js"
import type { ParametresDeLaCaisse } from "./cotisations-liberales.js"
import { CAISSES_LIBERALES, reglesDesAnneesConnues, type CaisseLiberale, type ProfessionReglementee, type ReglesFiscales } from "./regles.js"

/*
 * Professions libérales réglementées (voir l'ADR 015) : une activité BNC enregistre sa profession, jamais sa caisse.
 * La caisse et les particularités de la profession (micro-entreprise permise, conventionnement, CURPS, sociétés
 * d'exercice libéral) se lisent dans les règles de l'année simulée.
 */

/** Profession par défaut, enregistrée aussi bien absente : le calcul des libéraux non réglementés. */
export const PROFESSION_NON_REGLEMENTEE = "non-reglementee"

/** Libellé de la profession par défaut, en tête de la liste. */
export const LIBELLE_NON_REGLEMENTEE = "Non réglementée"

/** Les identifiants de profession qu'un fichier peut porter : ceux des règles de chaque année connue, et le défaut. */
export function professionsConnues(): Set<string> {
  return new Set([PROFESSION_NON_REGLEMENTEE, ...reglesDesAnneesConnues().flatMap(r => r.liberauxReglementes.professions.liste.map(p => p.id))])
}

/** La profession réglementée de l'activité d'après les règles de l'année ; `null` si elle n'en a pas, ou une inconnue. */
export function professionDe(activite: Pick<Company | MicroEntreprise, "profession">, regles: ReglesFiscales): ProfessionReglementee | null {
  if (activite.profession === undefined || activite.profession === PROFESSION_NON_REGLEMENTEE) return null
  return regles.liberauxReglementes.professions.liste.find(p => p.id === activite.profession) ?? null
}

/** La caisse d'une profession, si le simulateur la calcule ; `null` pour « autre profession réglementée ». */
export function caisseDe(profession: ProfessionReglementee | null): CaisseLiberale | null {
  const caisse = profession?.caisse
  return (CAISSES_LIBERALES as readonly (string | null | undefined)[]).includes(caisse) ? (caisse as CaisseLiberale) : null
}

/** Part conventionnée retenue : celle saisie, 1 par défaut, 0 pour une profession qui ne peut pas être conventionnée. */
export function partConventionneeDe(activite: Pick<Company | MicroEntreprise, "partConventionnee">, profession: ProfessionReglementee | null): number {
  if (!profession?.conventionnable) return 0
  return Math.min(1, Math.max(0, activite.partConventionnee ?? 1))
}

/**
 * Ce qu'il faut pour calculer au réel les cotisations de la caisse de l'activité ; `undefined` pour une activité non
 * réglementée ou d'une caisse que le simulateur ne calcule pas (calcul des indépendants). `assietteAnneePrecedente` :
 * l'assiette de l'activité l'année précédente, quand cette année est dans la session (CARPIMKO, ADR 015).
 */
export function parametresDeLaCaisse(activite: Pick<Company | MicroEntreprise, "profession" | "partConventionnee">, regles: ReglesFiscales, annee: number, assietteAnneePrecedente?: number): ParametresDeLaCaisse | undefined {
  const profession = professionDe(activite, regles)
  const caisse = caisseDe(profession)
  if (!profession || !caisse) return undefined
  const precedente = caisse === "CARPIMKO" && assietteAnneePrecedente !== undefined ? { anneePrecedente: { annee: annee - 1, assiette: assietteAnneePrecedente } } : {}
  return { caisse, profession, regles: regles.liberauxReglementes, partConventionnee: partConventionneeDe(activite, profession), annee, ...precedente }
}

/** La profession de l'activité telle que l'affichent les résultats ; `undefined` si elle n'en a pas. */
export function professionDeLActivite(profession: ProfessionReglementee | null, regles: ReglesFiscales, enMicro: boolean): ProfessionDeLActivite | undefined {
  if (!profession) return undefined
  const caisse = caisseDe(profession)
  const tauxMicro = enMicro && caisse === "CIPAV" ? { tauxMicro: regles.liberauxReglementes.CIPAV.microEntreprise.cotisations } : {}
  return { id: profession.id, libelle: profession.libelle, caisse, ...tauxMicro }
}

/**
 * Règles d'une micro-entreprise de cette profession : pour un affilié de la CIPAV, le taux global des BNC est le sien
 * (cotisations, ACRE, trimestres) ; pour toute autre profession, les règles de l'année telles quelles.
 */
export function reglesDeLaMicro(regles: ReglesFiscales, profession: ProfessionReglementee | null): ReglesFiscales {
  if (caisseDe(profession) !== "CIPAV") return regles
  const micro = regles.liberauxReglementes.CIPAV.microEntreprise
  return { ...regles, microEntreprise: { ...regles.microEntreprise, cotisations: { ...regles.microEntreprise.cotisations, servicesBnc: micro.cotisations } } }
}

/** Retraite de base d'un micro-entrepreneur de la CIPAV : part de son taux global et taux de la retraite de base. */
export function retraiteMicroDeLaProfession(regles: ReglesFiscales, profession: ProfessionReglementee | null): { partRetraiteDeBase: number; tauxRetraiteDeBase: number } | undefined {
  if (caisseDe(profession) !== "CIPAV") return undefined
  const micro = regles.liberauxReglementes.CIPAV.microEntreprise
  return { partRetraiteDeBase: micro.repartition.retraiteDeBase, tauxRetraiteDeBase: micro.tauxRetraiteDeBase }
}

/** La micro-entreprise est interdite à la profession (praticiens et auxiliaires médicaux). */
export function microInterdite(profession: ProfessionReglementee | null): boolean {
  return profession !== null && !profession.microEntreprise
}

/** Pourquoi la micro-entreprise n'est pas proposée à cette profession. */
export function raisonMicroInterdite(profession: ProfessionReglementee): string {
  return `Micro-entreprise non proposée : elle est interdite aux praticiens et auxiliaires médicaux (« En tant que praticien ou auxiliaire médical vous ne pouvez pas être auto-entrepreneur », Urssaf). ${profession.libelle} : régime réel seulement.`
}

/**
 * Avertissements propres à la profession de l'activité dans un statut : caisse pas encore calculée, micro-entreprise
 * interdite, société d'exercice libéral en SASU ou en EURL.
 */
export function avertissementsDeLaProfession(profession: ProfessionReglementee | null, statut: "SASU" | "EURL" | "EI" | "micro"): string[] {
  if (!profession) return []
  const avertissements: string[] = []
  if (profession.caisse === null) {
    avertissements.push(`${profession.libelle} : la caisse de cette profession n'est pas encore prise en compte. Les cotisations sont calculées comme pour une profession libérale non réglementée (Sécurité sociale des indépendants) : la retraite, l'invalidité-décès et, en micro-entreprise, le taux global peuvent s'en écarter de plusieurs milliers d'euros par an.`)
  }
  if (statut === "micro" && microInterdite(profession)) {
    avertissements.push(`${raisonMicroInterdite(profession)} Ce résultat, calculé au taux des libéraux non réglementés, n'est donné qu'à titre indicatif.`)
  }
  if ((statut === "SASU" || statut === "EURL") && profession.societeExerciceLiberal) {
    const regime = statut === "EURL" ? "Les cotisations du gérant sont calculées avec celles de sa caisse, mais" : "Le président est calculé comme un assimilé salarié du régime général, et"
    avertissements.push(`${profession.libelle} en ${statut} : cette profession exerce en principe en société d'exercice libéral (SELARL, SELAS…). La rémunération de son activité y relève alors des bénéfices non commerciaux et de sa caisse, y compris pour un président de SELAS, dont seul le mandat social relève du régime général. ${regime} cette rémunération n'est pas encore modélisée : l'écart n'est pas chiffré. Aucun texte consulté n'autorise ni n'interdit en toutes lettres l'EURL ou la SASU classique à cette profession.`)
  }
  return avertissements
}
