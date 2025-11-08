// src/lib/color-constants.ts

import type { FinancialFlow } from "@/types"

/**
 * Nouvelle palette de couleurs par défaut, conçue pour un contraste élevé
 * et un regroupement sémantique des types de flux.
 */
export const DEFAULT_FLOW_COLORS: Record<FinancialFlow["type"], string> = {
  // --- Revenus Personne (Nuances de Vert/Bleu-Vert) ---
  are: "#10b981", // Tailwind: emerald-500
  salary: "#14b8a6", // Tailwind: teal-500
  other_taxable_income: "#06b6d4", // Tailwind: cyan-500

  // --- Chiffre d'Affaires Société (Nuances de Bleu) ---
  ca_services: "#0ea5e9", // Tailwind: sky-500
  ca_vente: "#6366f1", // Tailwind: indigo-500

  // --- Chiffre d'Affaires Micro-Entreprise (Nuances d'Orange/Jaune) ---
  ca_micro_services_bic: "#f59e0b", // Tailwind: amber-500
  ca_micro_services_bnc: "#f97316", // Tailwind: orange-500
  ca_micro_vente: "#ea580c", // Tailwind: orange-600 (légèrement plus foncé pour le distinguer)

  // --- Sorties d'Argent (Rouge pour Dépenses, Violet pour Rémunérations) ---
  deductible_expense: "#f43f5e", // Tailwind: rose-500
  director_remuneration: "#8b5cf6", // Tailwind: violet-500
  dividends_payment: "#a78bfa", // Tailwind: violet-400 (une nuance plus claire pour les dividendes)

  // --- Types de test (Couleurs distinctes pour le débogage) ---
  income: "#d946ef", // Tailwind: fuchsia-500
  expense: "#ef4444" // Tailwind: red-500
}
