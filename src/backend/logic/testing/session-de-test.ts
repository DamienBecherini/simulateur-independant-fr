// src/backend/logic/testing/session-de-test.ts

import type { Company, ConditionsPortage, Entity, FinancialFlow, MicroEntreprise, Person, Portage, Relationship, SimulationAnnuelle } from "../../../types.js"

/* Petites fabriques pour décrire une session en quelques lignes dans les tests du moteur. */

const avatar = { type: "initials", value: "AB", color: "#3b82f6" } as const

export function personne(id: string, fiscalParts = 1): Person {
  return { id, type: "person", name: id, fiscalParts, avatar, locked: false }
}

export function societe(id: string, legalStatus: Company["legalStatus"] = "SASU", capitalSocial = 1000): Company {
  return { id, type: "company", name: id, legalStatus, capitalSocial, avatar, locked: false }
}

export function micro(id: string, options: Partial<Pick<MicroEntreprise, "beneficieACRE" | "opteVFL">> = {}): MicroEntreprise {
  return { id, type: "micro-entreprise", name: id, beneficieACRE: false, opteVFL: false, avatar, locked: false, ...options }
}

export function portage(id: string, conditions?: ConditionsPortage): Portage {
  return { id, type: "portage", name: id, ...(conditions ? { conditions } : {}), avatar, locked: false }
}

/** Le même montant chaque mois indiqué (tous par défaut), sur une session construite par `session`. */
export function chaqueMois(donnees: SimulationAnnuelle, entityId: string, type: FinancialFlow["type"], montant: number, mois: number[] = Array.from({ length: 12 }, (_, m) => m)): SimulationAnnuelle {
  for (const m of mois) donnees.monthlyData[m].flows.push({ id: `${entityId}-${type}-${m}`, label: type, amount: montant, entityId, type })
  return donnees
}

export function relation(fromId: string, toId: string, type: Relationship["type"]): Relationship {
  return { id: `${fromId}-${toId}-${type}`, fromId, toId, type }
}

/** Un flux annuel : il est saisi sur le mois de janvier. */
export type Flux = [entityId: string, type: FinancialFlow["type"], amount: number]

export function session(entities: Entity[], relationships: Relationship[] = [], flux: Flux[] = []): SimulationAnnuelle {
  const monthlyData: SimulationAnnuelle["monthlyData"] = Array.from({ length: 12 }, (_, month) => ({ month, flows: [] }))
  flux.forEach(([entityId, type, amount], index) => {
    monthlyData[0].flows.push({ id: `flux-${index}`, label: type, amount, entityId, type })
  })
  return { name: "Test", annee: 2026, entities, relationships, monthlyData }
}
