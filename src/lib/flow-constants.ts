// src/lib/flow-constants.ts

import type { FinancialFlow } from "@/types"

/**
 * Dictionnaire centralisé qui associe chaque type de flux financier
 * à un libellé lisible pour l'utilisateur.
 * C'est la source de vérité unique pour l'affichage dans toute l'application.
 */
export const flowTypeLabels: Record<FinancialFlow["type"], string> = {
  // Personne
  are: "Allocation chômage (ARE)",
  salary: "Salaire (emploi tiers)",
  other_taxable_income: "Autre revenu imposable",
  // Société
  ca_services: "CA - Prestation de services",
  ca_vente: "CA - Vente de marchandises",
  deductible_expense: "Dépense déductible",
  director_remuneration: "Rémunération de dirigeant",
  dividends_payment: "Versement de dividendes",
  // Micro-entreprise
  ca_micro_services_bic: "CA Micro - Services (BIC)",
  ca_micro_services_bnc: "CA Micro - Services (BNC)",
  ca_micro_vente: "CA Micro - Vente",
  // Test (à conserver pour la robustesse)
  income: "Revenu (Test)",
  expense: "Dépense (Test)"
}
