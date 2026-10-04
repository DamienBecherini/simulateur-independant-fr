// src/ui/testing/fixtures.ts
// Données de départ des tests de composants : entités, flux et session, avec des identifiants stables.

import type { Company, FinancialFlow, MicroEntreprise, Person, SessionState, SimulationReport } from "@/types"

export function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: "person-alice",
    type: "person",
    name: "Alice Martin",
    fiscalParts: 1,
    avatar: { type: "initials", value: "AM", color: "#3b82f6" },
    locked: false,
    ...overrides
  }
}

export function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: "company-sasu",
    type: "company",
    name: "Ma SASU",
    legalStatus: "SASU",
    capitalSocial: 1000,
    avatar: { type: "icon", value: "Briefcase", color: "#ef4444" },
    locked: false,
    ...overrides
  }
}

export function makeMicro(overrides: Partial<MicroEntreprise> = {}): MicroEntreprise {
  return {
    id: "micro-atelier",
    type: "micro-entreprise",
    name: "Mon atelier",
    beneficieACRE: false,
    opteVFL: false,
    avatar: { type: "icon", value: "Store", color: "#f97316" },
    locked: false,
    ...overrides
  }
}

export function makeFlow(overrides: Partial<FinancialFlow> = {}): FinancialFlow {
  return {
    id: "flow-1",
    entityId: "person-alice",
    type: "other_taxable_income",
    label: "Autre revenu imposable",
    amount: 1000,
    ...overrides
  }
}

/** Session vide : douze mois sans flux. */
export function emptySession(): SessionState {
  return {
    name: "Nouvelle Simulation",
    entities: [],
    relationships: [],
    monthlyData: Array.from({ length: 12 }, (_, month) => ({ month, flows: [] }))
  }
}

/** Rapport de simulation vide : aucune entité, tous les montants à zéro. */
export function emptyReport(): SimulationReport {
  return {
    annee: 2025,
    bilan: {
      chiffreAffaires: 0,
      charges: 0,
      revenusDirects: 0,
      cotisationsSalariales: 0,
      revenusAvantPrelevements: 0,
      cotisationsSociales: 0,
      impotSocietes: 0,
      impotSurLeRevenu: 0,
      prelevementsSociaux: 0,
      totalPrelevements: 0,
      resultatConserve: 0,
      nonRattache: 0
    },
    activities: [],
    persons: [],
    foyers: [],
    totalNetApresImpots: 0
  }
}
