// src/backend/logic/testing/session-de-test.ts

import type { Company, Entity, FinancialFlow, MicroEntreprise, Person, Relationship, SessionState } from "../../../types.js"

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

export function relation(fromId: string, toId: string, type: Relationship["type"]): Relationship {
  return { id: `${fromId}-${toId}-${type}`, fromId, toId, type }
}

/** Un flux annuel : il est saisi sur le mois de janvier. */
export type Flux = [entityId: string, type: FinancialFlow["type"], amount: number]

export function session(entities: Entity[], relationships: Relationship[] = [], flux: Flux[] = []): SessionState {
  const monthlyData: SessionState["monthlyData"] = Array.from({ length: 12 }, (_, month) => ({ month, flows: [] }))
  flux.forEach(([entityId, type, amount], index) => {
    monthlyData[0].flows.push({ id: `flux-${index}`, label: type, amount, entityId, type })
  })
  return { name: "Test", entities, relationships, monthlyData }
}
