// src/backend/logic/flux-permis.ts
// Les types de flux que porte chaque genre d'acteur. Une seule table, lue par la saisie (src/lib/flow-constants.ts) et
// par les propositions des IA (outils/commun.ts) : un type ajouté ou retiré ici l'est des deux côtés.

import type { Entity, FinancialFlow } from "../../types.js"
import type { GenreDeStructure } from "./regles-de-structure.js"

/** Ce qu'est un acteur, en un mot : une personne, ou une activité et sa forme. */
export type GenreDActeur = "personne" | GenreDeStructure

export function genreDe(acteur: Entity): GenreDActeur {
  if (acteur.type === "person") return "personne"
  if (acteur.type === "micro-entreprise" || acteur.type === "portage") return acteur.type
  return acteur.legalStatus
}

/** Un type de flux qu'on saisit : tous, sauf « income », réservé aux tests. */
export type TypeDeFluxSaisi = Exclude<FinancialFlow["type"], "income">

const D_UNE_SOCIETE = ["ca_services", "ca_vente", "deductible_expense", "director_remuneration", "dividends_payment"] as const

/**
 * Types de flux de chaque genre d'acteur, dans l'ordre où la saisie les propose.
 * - Personne : ses revenus hors de ses activités, et ses dépenses, non déductibles.
 * - Société (SASU, EURL) : chiffre d'affaires, charges déductibles, rémunération du dirigeant et dividendes.
 * - Entreprise individuelle au réel : comme une société, sans rémunération de dirigeant ni dividendes, qui ne se
 *   versent que dans une société à l'IS.
 * - Micro-entreprise (régime forfaitaire) : ses dépenses ne sont pas déductibles. Les prestations libérales viennent en
 *   tête : c'est la nature proposée d'office tant que l'activité n'a pas de chiffre d'affaires dans l'année (voir
 *   typeProposeDOffice, src/lib/nature-de-l-activite.ts).
 * - Portage salarial : des prestations de services seulement, et les frais professionnels remboursés (ADR 016).
 */
export const FLUX_PERMIS: Record<GenreDActeur, readonly TypeDeFluxSaisi[]> = {
  personne: ["are", "salary", "other_taxable_income", "expense"],
  SASU: D_UNE_SOCIETE,
  EURL: D_UNE_SOCIETE,
  EI: ["ca_services", "ca_vente", "deductible_expense"],
  "micro-entreprise": ["ca_micro_services_bnc", "ca_micro_services_bic", "ca_micro_vente", "expense"],
  portage: ["ca_services", "deductible_expense"]
}

/** Les types de flux que porte cet acteur. */
export function fluxPermis(acteur: Entity): readonly TypeDeFluxSaisi[] {
  return FLUX_PERMIS[genreDe(acteur)]
}
