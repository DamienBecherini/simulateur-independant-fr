// src/lib/color-constants.ts

import type { FinancialFlow } from "@/types"

/**
 * Nouvelle palette de couleurs par défaut.
 * Stratégie : Différenciation maximale entre chaque type de flux,
 * même au sein d'une même catégorie, pour une lisibilité instantanée.
 */
export const DEFAULT_FLOW_COLORS: Record<FinancialFlow["type"], string> = {
  // --- Revenus Personnels (Contraste Élevé) ---
  // Un vert franc, un bleu ciel et un ambre chaud. Très distincts.
  salary: "#22c55e", // Tailwind: green-500
  are: "#38bdf8", // Tailwind: lightBlue-400 (ou sky-400)
  other_taxable_income: "#f59e0b", // Tailwind: amber-500

  // --- Chiffre d'Affaires Société (Contraste Élevé) ---
  // Un bleu-violet (indigo) et un vert d'eau (teal). Inconfondables.
  ca_services: "#4f46e5", // Tailwind: indigo-600
  ca_vente: "#14b8a6", // Tailwind: teal-500

  // --- Chiffre d'Affaires Micro-Entreprise (Contraste Élevé) ---
  // Un orange vif, un rose/magenta et un cyan. Aucune confusion possible.
  ca_micro_services_bic: "#f97316", // Tailwind: orange-500
  ca_micro_services_bnc: "#d946ef", // Tailwind: fuchsia-500
  ca_micro_vente: "#06b6d4", // Tailwind: cyan-500

  // --- Sorties d'Argent (Couleurs Cohérentes) ---
  // Le rouge reste la convention pour les dépenses.
  // Le violet, couleur "premium", est pour la rémunération et les dividendes.
  deductible_expense: "#ef4444", // Tailwind: red-500
  director_remuneration: "#8b5cf6", // Tailwind: violet-500
  dividends_payment: "#a78bfa", // Tailwind: violet-400 (plus clair pour différencier)

  // --- Types de test (Couleurs uniques pour le débogage) ---
  income: "#eab308", // Tailwind: yellow-500
  expense: "#f43f5e" // Tailwind: rose-500
}
