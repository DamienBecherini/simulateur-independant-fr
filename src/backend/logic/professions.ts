// src/backend/logic/professions.ts

import type { Company, MicroEntreprise } from "../../types.js"
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
