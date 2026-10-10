// src/backend/logic/professions.ts

import { CAISSES_LIBERALES, estSocieteIS, type CaisseLiberale, type Company, type MicroEntreprise, type ProfessionDeLActivite, type StatutJuridique, type StatutSociete } from "../../types.js"
import type { ParametresDeLaCaisse } from "./cotisations-liberales.js"
import { reglesDesAnneesConnues, type MicroEntrepriseLiberale, type ProfessionReglementee, type ReglesFiscales, type ReglesLiberauxReglementes } from "./regles.js"

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

/** La caisse lue dans un fichier de règles est une de celles que le simulateur calcule. */
function estUneCaisseCalculee(caisse: string | null | undefined): caisse is CaisseLiberale {
  return CAISSES_LIBERALES.some(connue => connue === caisse)
}

/** La caisse d'une profession, si le simulateur la calcule ; `null` pour « autre profession réglementée ». */
export function caisseDe(profession: ProfessionReglementee | null): CaisseLiberale | null {
  const caisse = profession?.caisse
  return estUneCaisseCalculee(caisse) ? caisse : null
}

/** Ce qu'une caisse change hors du calcul de ses cotisations au réel (voir cotisations-liberales.ts). */
interface ParticularitesDeLaCaisse {
  /** La complémentaire et l'ASV se calculent sur l'assiette de l'année précédente, quand elle est dans la session. */
  assietteDeLAnneePrecedente: boolean
  /** Le taux global propre de la caisse en micro-entreprise ; `null` : celui des BNC de l'année (ou micro interdite). */
  microEntreprise: (regles: ReglesLiberauxReglementes) => MicroEntrepriseLiberale | null
}

/**
 * Les particularités de chaque caisse, une entrée par caisse de `CAISSES_LIBERALES` (le compilateur refuse un oubli) :
 * pas de « si CIPAV, sinon… », qui calculerait une nouvelle caisse comme l'une des anciennes.
 */
const PARTICULARITES_DES_CAISSES = {
  CIPAV: { assietteDeLAnneePrecedente: false, microEntreprise: liberaux => liberaux.CIPAV.microEntreprise },
  CARPIMKO: { assietteDeLAnneePrecedente: true, microEntreprise: () => null }
} satisfies Record<CaisseLiberale, ParticularitesDeLaCaisse>

/** Le taux global propre à la caisse de la profession en micro-entreprise, s'il y en a un. */
function microDeLaCaisse(regles: ReglesFiscales, profession: ProfessionReglementee | null): MicroEntrepriseLiberale | null {
  const caisse = caisseDe(profession)
  return caisse ? PARTICULARITES_DES_CAISSES[caisse].microEntreprise(regles.liberauxReglementes) : null
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
  const precedente = PARTICULARITES_DES_CAISSES[caisse].assietteDeLAnneePrecedente && assietteAnneePrecedente !== undefined ? { anneePrecedente: { annee: annee - 1, assiette: assietteAnneePrecedente } } : {}
  return { caisse, profession, regles: regles.liberauxReglementes, partConventionnee: partConventionneeDe(activite, profession), annee, ...precedente }
}

/** La profession de l'activité telle que l'affichent les résultats ; `undefined` si elle n'en a pas. */
export function professionDeLActivite(profession: ProfessionReglementee | null, regles: ReglesFiscales, enMicro: boolean): ProfessionDeLActivite | undefined {
  if (!profession) return undefined
  const micro = enMicro ? microDeLaCaisse(regles, profession) : null
  return { id: profession.id, libelle: profession.libelle, caisse: caisseDe(profession), ...(micro ? { tauxMicro: micro.cotisations } : {}) }
}

/**
 * Règles d'une micro-entreprise de cette profession : pour l'affilié d'une caisse qui a son taux global (la CIPAV), le
 * taux des BNC est le sien (cotisations, ACRE, trimestres) ; pour toute autre profession, les règles de l'année.
 */
export function reglesDeLaMicro(regles: ReglesFiscales, profession: ProfessionReglementee | null): ReglesFiscales {
  const micro = microDeLaCaisse(regles, profession)
  if (!micro) return regles
  return { ...regles, microEntreprise: { ...regles.microEntreprise, cotisations: { ...regles.microEntreprise.cotisations, servicesBnc: micro.cotisations } } }
}

/** Retraite de base d'un micro-entrepreneur d'une caisse à taux global propre : part de ce taux et taux de la retraite de base. */
export function retraiteMicroDeLaProfession(regles: ReglesFiscales, profession: ProfessionReglementee | null): { partRetraiteDeBase: number; tauxRetraiteDeBase: number } | undefined {
  const micro = microDeLaCaisse(regles, profession)
  if (!micro) return undefined
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
 * Ce que le simulateur calcule pour une profession de société d'exercice libéral en société classique, selon le statut :
 * le gérant d'EURL cotise déjà à sa caisse, le président de SASU au régime général. Un nouveau statut à l'IS doit dire
 * comment son dirigeant est calculé.
 */
const REGIME_EN_SOCIETE_D_EXERCICE_LIBERAL: Record<StatutSociete, string> = {
  SASU: "Le président est calculé comme un assimilé salarié du régime général, et",
  EURL: "Les cotisations du gérant sont calculées avec celles de sa caisse, mais"
}

/**
 * Avertissements propres à la profession de l'activité dans un statut : caisse pas encore calculée, micro-entreprise
 * interdite, société d'exercice libéral en SASU ou en EURL.
 */
export function avertissementsDeLaProfession(profession: ProfessionReglementee | null, statut: StatutJuridique | "micro"): string[] {
  if (!profession) return []
  const avertissements: string[] = []
  // Une caisse que le simulateur ne calcule pas (« autre profession réglementée ») : calcul des indépendants, signalé.
  if (caisseDe(profession) === null) {
    avertissements.push(`${profession.libelle} : la caisse de cette profession n'est pas encore prise en compte. Les cotisations sont calculées comme pour une profession libérale non réglementée (Sécurité sociale des indépendants) : la retraite, l'invalidité-décès et, en micro-entreprise, le taux global peuvent s'en écarter de plusieurs milliers d'euros par an.`)
  }
  if (statut === "micro" && microInterdite(profession)) {
    avertissements.push(`${raisonMicroInterdite(profession)} Ce résultat, calculé au taux des libéraux non réglementés, n'est donné qu'à titre indicatif.`)
  }
  if (estSocieteIS(statut) && profession.societeExerciceLiberal) {
    avertissements.push(`${profession.libelle} en ${statut} : cette profession exerce en principe en société d'exercice libéral (SELARL, SELAS…). La rémunération de son activité y relève alors des bénéfices non commerciaux et de sa caisse, y compris pour un président de SELAS, dont seul le mandat social relève du régime général. ${REGIME_EN_SOCIETE_D_EXERCICE_LIBERAL[statut]} cette rémunération n'est pas encore modélisée : l'écart n'est pas chiffré. Aucun texte consulté n'autorise ni n'interdit en toutes lettres l'EURL ou la SASU classique à cette profession.`)
  }
  return avertissements
}
