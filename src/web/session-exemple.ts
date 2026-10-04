// src/web/session-exemple.ts
// Simulation fictive, chargée à la première visite de la démo web et utilisée pour les captures d'écran du README :
// une indépendante en micro-entreprise mixte, pacsée avec le président d'une SASU, avec un enfant.

import type { Company, FinancialFlow, MicroEntreprise, Person, Relationship, SessionState } from "../types"

const personne = (id: string, name: string, initiales: string, color: string): Person => ({ id, type: "person", name, fiscalParts: 1, avatar: { type: "initials", value: initiales, color }, locked: false })

const camille = personne("person-camille", "Camille Martin", "CM", "#3b82f6")
const julien = personne("person-julien", "Julien Martin", "JM", "#16a34a")
const lea = personne("person-lea", "Léa Martin", "LM", "#ec4899")

const atelier: MicroEntreprise = { id: "micro-atelier", type: "micro-entreprise", name: "Atelier de Camille", beneficieACRE: false, opteVFL: true, rfrN2: 38000, avatar: { type: "icon", value: "Store", color: "#d97706" }, locked: false }
const conseil: Company = { id: "company-conseil", type: "company", name: "Conseil SASU", legalStatus: "SASU", capitalSocial: 1000, avatar: { type: "icon", value: "Briefcase", color: "#b91c1c" }, locked: false }

const relations: Relationship[] = [
  { id: "rel-titulaire", fromId: camille.id, toId: atelier.id, type: "Titulaire" },
  { id: "rel-president", fromId: julien.id, toId: conseil.id, type: "Président" },
  { id: "rel-pacs", fromId: camille.id, toId: julien.id, type: "PACSé(e)" },
  { id: "rel-enfant", fromId: camille.id, toId: lea.id, type: "Enfant" }
]

function flux(entityId: string, type: FinancialFlow["type"], amount: number, label: string, mois: number): FinancialFlow {
  return { id: `${entityId}-${type}-${mois}`, label, amount, entityId, type }
}

export function sessionExemple(): SessionState {
  const monthlyData = Array.from({ length: 12 }, (_, mois) => ({
    month: mois,
    flows: [
      flux(atelier.id, "ca_micro_services_bnc", 2600 + (mois % 3) * 300, "Prestations", mois),
      flux(atelier.id, "ca_micro_vente", mois % 4 === 0 ? 900 : 300, "Ventes", mois),
      flux(conseil.id, "ca_services", 6500, "Facturation", mois),
      flux(conseil.id, "director_remuneration", 2500, "Rémunération", mois)
    ]
  }))
  monthlyData[11].flows.push(flux(conseil.id, "dividends_payment", 12000, "Dividendes", 11))

  return {
    name: "Famille Martin, simulation 2026",
    entities: [camille, julien, lea, atelier, conseil],
    relationships: relations,
    monthlyData
  }
}
