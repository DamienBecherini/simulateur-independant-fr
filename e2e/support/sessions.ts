// e2e/support/sessions.ts
// Sessions préparées pour les tests de bout en bout, avec des identifiants stables.

import type { FinancialFlow, MicroEntreprise, Person, SessionState } from "../../src/types"

export const ALICE: Person = {
  id: "person-alice",
  type: "person",
  name: "Alice Martin",
  fiscalParts: 1,
  avatar: { type: "initials", value: "AM", color: "#3b82f6" },
  locked: false
}

export const ATELIER: MicroEntreprise = {
  id: "micro-atelier",
  type: "micro-entreprise",
  name: "Atelier Martin",
  beneficieACRE: false,
  opteVFL: false,
  avatar: { type: "icon", value: "Store", color: "#f97316" },
  locked: false
}

/** Douze mois ; `flux` place des flux dans les mois indiqués (0 = janvier). */
export function grilleMensuelle(flux: { mois: number; flux: FinancialFlow }[] = []): SessionState["monthlyData"] {
  return Array.from({ length: 12 }, (_, month) => ({ month, flows: flux.filter(f => f.mois === month).map(f => f.flux) }))
}

/** Session vierge, telle que l'application la crée. */
export function sessionVide(): SessionState {
  return { name: "Nouvelle Simulation", entities: [], relationships: [], monthlyData: grilleMensuelle() }
}

/** Alice seule, sans activité ni flux. */
export function sessionAliceSeule(): SessionState {
  return { name: "Alice seule", entities: [ALICE], relationships: [], monthlyData: grilleMensuelle() }
}

/**
 * Alice, titulaire d'une micro-entreprise de prestations BNC : 2 500 € de chiffre d'affaires
 * chaque mois, soit 30 000 € sur l'année.
 */
export function sessionMicroBnc(): SessionState {
  const flux = Array.from({ length: 12 }, (_, mois) => ({
    mois,
    flux: { id: `flow-ca-${mois}`, entityId: ATELIER.id, type: "ca_micro_services_bnc" as const, label: "Prestations", amount: 2500 }
  }))
  return {
    name: "Micro BNC 30 000 €",
    entities: [ALICE, ATELIER],
    relationships: [{ id: "rel-titulaire", fromId: ALICE.id, toId: ATELIER.id, type: "Titulaire" }],
    monthlyData: grilleMensuelle(flux)
  }
}
