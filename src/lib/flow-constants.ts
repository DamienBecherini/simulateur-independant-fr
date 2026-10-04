// src/lib/flow-constants.ts

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
  // Société
  ca_services: "CA - Prestation de services",
  ca_vente: "CA - Vente de marchandises",
  deductible_expense: "Charge déductible",
  director_remuneration: "Rémunération de dirigeant",
  dividends_payment: "Versement de dividendes",
  // Micro-entreprise
  ca_micro_services_bic: "CA Micro - Services (BIC)",
  ca_micro_services_bnc: "CA Micro - Services (BNC)",
  ca_micro_vente: "CA Micro - Vente",
  // Types de test (conservés pour la compatibilité des sauvegardes)
  income: "Revenu (Test)",
  expense: "Dépense (non déductible)"
}

/** Libellés courts, utilisés là où la place est comptée (légende, réglage des couleurs). */
export const flowTypeShortLabels: Record<FlowType, string> = {
  are: "ARE",
  salary: "Salaire",
  other_taxable_income: "Autre Revenu",
  ca_services: "CA Services",
  ca_vente: "CA Vente",
  deductible_expense: "Charge déductible",
  director_remuneration: "Rémunération Dirigeant",
  dividends_payment: "Dividendes",
  ca_micro_services_bic: "CA Micro (BIC)",
  ca_micro_services_bnc: "CA Micro (BNC)",
  ca_micro_vente: "CA Micro Vente",
  income: "Revenu (Test)",
  expense: "Dépense (non déductible)"
}

/**
 * Types de dépenses : flux comptés côté « dépenses » dans la grille annuelle et la légende.
 */
export const expenseFlowTypes: ReadonlyArray<FlowType> = ["deductible_expense", "expense"]

/**
 * Sorties d'argent du point de vue de l'entité : les dépenses, plus la rémunération
 * du dirigeant et les dividendes versés par une société. Détermine l'icône gain/dépense
 * affichée à la saisie.
 */
export const outgoingFlowTypes: ReadonlyArray<FlowType> = [...expenseFlowTypes, "director_remuneration", "dividends_payment"]

export const isExpenseFlowType = (type: FlowType): boolean => expenseFlowTypes.includes(type)

export const isOutgoingFlowType = (type: FlowType): boolean => outgoingFlowTypes.includes(type)

/**
 * Types de flux proposés à la saisie selon le type d'entité.
 * - Personne : revenus classiques et dépenses non déductibles.
 * - Société (SASU/EURL) : les dépenses sont des charges déductibles.
 * - Entreprise individuelle au réel : comme une société, sans rémunération de dirigeant ni dividendes.
 * - Micro-entreprise (régime forfaitaire) : les dépenses ne sont pas déductibles.
 */
export const flowTypesByEntityType: Record<Entity["type"], ReadonlyArray<FlowType>> = {
  person: ["are", "salary", "other_taxable_income", "expense"],
  company: ["ca_services", "ca_vente", "deductible_expense", "director_remuneration", "dividends_payment"],
  "micro-entreprise": ["ca_micro_services_bic", "ca_micro_services_bnc", "ca_micro_vente", "expense"]
}

const individualBusinessFlowTypes: ReadonlyArray<FlowType> = ["ca_services", "ca_vente", "deductible_expense"]

/** Types de flux proposés à la saisie pour une entité donnée, selon son type et son statut juridique. */
export function getFlowTypesForEntity(entity: Entity): ReadonlyArray<FlowType> {
  if (entity.type === "company" && entity.legalStatus === "EI") return individualBusinessFlowTypes
  return flowTypesByEntityType[entity.type]
}
