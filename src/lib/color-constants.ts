// src/lib/color-constants.ts

import type { FinancialFlow } from "@/types"

/**
 * Couleurs par défaut des flux. Chaque type garde une famille de couleur qui a du sens (vert pour le salaire, rouge
 * pour les dépenses, violets pour la rémunération et les dividendes…), et la nuance est choisie pour que deux types
 * restent distincts : écart d'au moins 14 en OKLab (x 100) entre deux couleurs, contre 3,5 avec l'ancienne palette.
 * Les numéros de la légende s'écrivent en blanc ou en foncé selon la couleur (voir couleurDeTexteSur).
 */
export const DEFAULT_FLOW_COLORS: Record<FinancialFlow["type"], string> = {
  // --- Revenus des personnes ---
  salary: "#22c55e", // green-500
  are: "#0284c7", // sky-600
  other_taxable_income: "#facc15", // yellow-400

  // --- Chiffre d'affaires d'une société ---
  ca_services: "#1d4ed8", // blue-700
  ca_vente: "#047857", // emerald-700

  // --- Chiffre d'affaires d'une micro-entreprise ---
  ca_micro_services_bic: "#fb923c", // orange-400
  ca_micro_services_bnc: "#d946ef", // fuchsia-500
  ca_micro_vente: "#22d3ee", // cyan-400

  // --- Dépenses : le rouge, foncé pour les charges déductibles, rose pour les autres ---
  deductible_expense: "#b91c1c", // red-700
  expense: "#f43f5e", // rose-500

  // --- Rémunération du dirigeant et dividendes : deux violets bien séparés ---
  director_remuneration: "#7e22ce", // purple-700
  dividends_payment: "#a78bfa", // violet-400

  // --- Type de test, sans usage dans l'interface ---
  income: "#eab308" // yellow-500
}
