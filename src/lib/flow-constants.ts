// src/lib/flow-constants.ts

import { fluxPermis } from "@/backend/logic/flux-permis"
import type { Entity, FinancialFlow } from "@/types"

export type FlowType = FinancialFlow["type"]

/**
 * Source unique des constantes liées aux types de flux financiers :
 * libellés, classification gain/dépense et types autorisés par type d'entité.
 * Aucun composant ne doit redéfinir ces listes localement.
 */

/** Libellés complets, utilisés dans les listes de saisie. */
export const flowTypeLabels: Record<FlowType, string> = {
  // Personne
  are: "Allocation chômage (ARE)",
  salary: "Salaire (emploi tiers)",
  other_taxable_income: "Autre revenu imposable",
  versement_per: "Versement PER (épargne retraite)",
  // Société
  ca_services: "CA - Prestation de services",
  ca_vente: "CA - Vente de marchandises",
  deductible_expense: "Charge déductible",
  director_remuneration: "Rémunération de dirigeant",
  dividends_payment: "Versement de dividendes",
  // Micro-entreprise : la nature de l'activité, qui fixe les taux (voir src/lib/nature-de-l-activite.ts)
  ca_micro_services_bic: "Prestations artisanales ou commerciales (BIC)",
  ca_micro_services_bnc: "Prestations libérales (BNC)",
  ca_micro_vente: "Vente de marchandises (BIC)",
  // Types de test (conservés pour la compatibilité des sauvegardes)
  income: "Revenu (Test)",
  expense: "Dépense (non déductible)"
}

/**
 * Libellé d'un type de flux selon l'acteur qui le porte. Une dépense n'a pas le même sens sur une personne
 * (dépense personnelle, jamais déductible) et sur une micro-entreprise (charge de l'activité : non déductible
 * tant que l'activité est en micro, déductible en société ou en EI au réel, ce que fait le comparateur).
 */
export function libelleDuType(type: FlowType, typeActeur?: Entity["type"]): string {
  if (type === "expense" && typeActeur === "micro-entreprise") return "Charge de l'activité (non déductible en micro)"
  if (type === "expense" && typeActeur === "person") return "Dépense personnelle"
  return flowTypeLabels[type]
}

/**
 * Anciens libellés par défaut, que portent les flux des sauvegardes antérieures : un flux qui en garde un a toujours
 * son libellé par défaut (champ vide à l'affichage, libellé qui suit le type quand on change celui-ci).
 */
const ANCIENS_LIBELLES: Partial<Record<FlowType, string>> = {
  ca_micro_services_bic: "CA Micro - Services (BIC)",
  ca_micro_services_bnc: "CA Micro - Services (BNC)",
  ca_micro_vente: "CA Micro - Vente"
}

/** Libellé laissé par défaut : celui du type pour cet acteur, l'ancien libellé générique ou un ancien libellé du type (sauvegardes antérieures). */
export function estLibelleParDefaut(flow: Pick<FinancialFlow, "type" | "label">, typeActeur?: Entity["type"]): boolean {
  return flow.label === libelleDuType(flow.type, typeActeur) || flow.label === flowTypeLabels[flow.type] || flow.label === ANCIENS_LIBELLES[flow.type]
}

/** Libellés courts, utilisés là où la place est comptée (légende, réglage des couleurs). */
export const flowTypeShortLabels: Record<FlowType, string> = {
  are: "ARE",
  salary: "Salaire",
  other_taxable_income: "Autre Revenu",
  versement_per: "Versement PER",
  ca_services: "CA Services",
  ca_vente: "CA Vente",
  deductible_expense: "Charge déductible",
  director_remuneration: "Rémunération Dirigeant",
  dividends_payment: "Dividendes",
  ca_micro_services_bic: "CA Micro (BIC)",
  ca_micro_services_bnc: "CA Micro (BNC)",
  ca_micro_vente: "CA Micro Vente",
  income: "Revenu (Test)",
  expense: "Dépense ou charge micro"
}

/**
 * Sorties d'argent du point de vue de l'entité : les dépenses, plus la rémunération
 * du dirigeant et les dividendes versés par une société. Détermine l'icône gain/dépense
 * affichée à la saisie, et le côté « dépenses » de la grille annuelle et de la légende :
 * la rémunération sort de la caisse de la société qui la verse.
 */
const EST_UNE_SORTIE: Record<FlowType, boolean> = {
  are: false,
  salary: false,
  other_taxable_income: false,
  ca_services: false,
  ca_vente: false,
  ca_micro_services_bic: false,
  ca_micro_services_bnc: false,
  ca_micro_vente: false,
  income: false,
  deductible_expense: true,
  expense: true,
  versement_per: true,
  director_remuneration: true,
  dividends_payment: true
}

export const isOutgoingFlowType = (type: FlowType): boolean => EST_UNE_SORTIE[type]

/**
 * Types de flux proposés à la saisie pour une entité, selon son type et son statut juridique, dans l'ordre de la
 * liste : la table du moteur (`FLUX_PERMIS`, src/backend/logic/flux-permis.ts), la même que celle des propositions
 * des IA.
 */
export function getFlowTypesForEntity(entity: Entity): ReadonlyArray<FlowType> {
  return fluxPermis(entity)
}
