// src/lib/entity-factory.ts

import type { Person, Company, MicroEntreprise, FinancialFlow } from "../types.js"

// Centralisation des listes de flux par défaut - MAINTENANT EXPORTÉES
export const defaultPersonFlows: FinancialFlow["type"][] = ["are", "salary", "other_taxable_income", "expense"]
export const defaultCompanyFlows: FinancialFlow["type"][] = ["ca_services", "ca_vente", "deductible_expense", "director_remuneration", "dividends_payment"]
export const defaultMicroFlows: FinancialFlow["type"][] = ["ca_micro_services_bic", "ca_micro_services_bnc", "ca_micro_vente", "expense"]

const defaultColors = {
  person: "#3b82f6",
  sasu: "#ef4444",
  eurl: "#22c55e",
  micro: "#f97316"
}

export function createPerson(): Person {
  return {
    id: `person-${Date.now()}`,
    type: "person",
    name: "Nouvelle Personne",
    fiscalParts: 1,
    avatar: { type: "initials", value: "NP", color: defaultColors.person },
    locked: false,
    enabledFlowTypes: [...defaultPersonFlows]
  }
}

export function createCompany(legalStatus: "SASU" | "EURL"): Company {
  const isSASU = legalStatus === "SASU"
  return {
    id: `company-${Date.now()}`,
    type: "company",
    name: isSASU ? "Ma SASU" : "Mon EURL",
    legalStatus: legalStatus,
    avatar: {
      type: "icon",
      value: isSASU ? "Briefcase" : "Building",
      color: isSASU ? defaultColors.sasu : defaultColors.eurl
    },
    locked: false,
    enabledFlowTypes: [...defaultCompanyFlows]
  }
}

export function createMicroEntreprise(): MicroEntreprise {
  return {
    id: `micro-${Date.now()}`,
    type: "micro-entreprise",
    name: "Ma Micro-Entreprise",
    beneficieACRE: false,
    opteVFL: false,
    avatar: { type: "icon", value: "Store", color: defaultColors.micro },
    locked: false,
    enabledFlowTypes: [...defaultMicroFlows]
  }
}
