// src/lib/business-logic.test.ts

import { describe, expect, it } from "vitest"
import { sanitizeFlowsAfterRelationshipChange } from "@/lib/business-logic"
import type { FinancialFlow, Relationship, SessionState } from "@/types"

function flux(id: string, entityId: string, type: FinancialFlow["type"]): FinancialFlow {
  return { id, label: id, amount: 1000, entityId, type }
}

function relation(fromId: string, toId: string, type: Relationship["type"]): Relationship {
  return { id: `${fromId}-${toId}-${type}`, fromId, toId, type }
}

/** Session minimale : seuls les relations et les flux comptent pour ce nettoyage. */
function session(relationships: Relationship[], fluxParMois: Record<number, FinancialFlow[]>): SessionState {
  return {
    name: "Test",
    entities: [],
    relationships,
    monthlyData: Array.from({ length: 12 }, (_, month) => ({ month, flows: fluxParMois[month] ?? [] }))
  }
}

function identifiants(monthlyData: SessionState["monthlyData"], mois: number): string[] {
  return monthlyData[mois].flows.map(f => f.id)
}

describe("sanitizeFlowsAfterRelationshipChange", () => {
  it("conserve la grille de 12 mois et les numéros de mois", () => {
    const resultat = sanitizeFlowsAfterRelationshipChange(session([], {}))

    expect(resultat).toHaveLength(12)
    expect(resultat.map(m => m.month)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(resultat.every(m => m.flows.length === 0)).toBe(true)
  })

  it("conserve toujours les flux sans dépendance à une relation", () => {
    const flows = [flux("salaire", "p1", "salary"), flux("ca", "c1", "ca_services"), flux("charge", "c1", "deductible_expense"), flux("micro", "m1", "ca_micro_vente")]

    const resultat = sanitizeFlowsAfterRelationshipChange(session([], { 3: flows }))

    expect(resultat[3].flows).toEqual(flows)
  })

  describe("rémunération de dirigeant", () => {
    const remuneration = flux("remu", "c1", "director_remuneration")

    it.each(["Président", "Gérant"] as const)("est conservée quand la société a un %s", type => {
      const resultat = sanitizeFlowsAfterRelationshipChange(session([relation("p1", "c1", type)], { 0: [remuneration] }))

      expect(identifiants(resultat, 0)).toEqual(["remu"])
    })

    it("est conservée quel que soit le sens de la relation", () => {
      const resultat = sanitizeFlowsAfterRelationshipChange(session([relation("c1", "p1", "Président")], { 0: [remuneration] }))

      expect(identifiants(resultat, 0)).toEqual(["remu"])
    })

    it("est supprimée quand la société n'a plus aucune relation", () => {
      const resultat = sanitizeFlowsAfterRelationshipChange(session([], { 0: [remuneration] }))

      expect(identifiants(resultat, 0)).toEqual([])
    })

    it("est supprimée quand il ne reste qu'un associé", () => {
      const resultat = sanitizeFlowsAfterRelationshipChange(session([relation("p1", "c1", "Associé")], { 0: [remuneration] }))

      expect(identifiants(resultat, 0)).toEqual([])
    })

    it("est supprimée quand le dirigeant est celui d'une autre société", () => {
      const resultat = sanitizeFlowsAfterRelationshipChange(session([relation("p1", "c2", "Président")], { 0: [remuneration] }))

      expect(identifiants(resultat, 0)).toEqual([])
    })
  })

  describe("versement de dividendes", () => {
    const dividendes = flux("div", "c1", "dividends_payment")

    it("est conservé quand la société a un associé", () => {
      const resultat = sanitizeFlowsAfterRelationshipChange(session([relation("p1", "c1", "Associé")], { 0: [dividendes] }))

      expect(identifiants(resultat, 0)).toEqual(["div"])
    })

    it("est supprimé quand la société n'a qu'un président", () => {
      const resultat = sanitizeFlowsAfterRelationshipChange(session([relation("p1", "c1", "Président")], { 0: [dividendes] }))

      expect(identifiants(resultat, 0)).toEqual([])
    })
  })

  it("nettoie chaque mois indépendamment et préserve l'ordre des flux restants", () => {
    const relations = [relation("p1", "c1", "Gérant"), relation("p1", "c2", "Associé")]
    const resultat = sanitizeFlowsAfterRelationshipChange(
      session(relations, {
        0: [flux("ca", "c1", "ca_services"), flux("remu-c1", "c1", "director_remuneration"), flux("div-c1", "c1", "dividends_payment")],
        6: [flux("remu-c2", "c2", "director_remuneration"), flux("div-c2", "c2", "dividends_payment"), flux("salaire", "p1", "salary")],
        11: [flux("remu-c3", "c3", "director_remuneration")]
      })
    )

    expect(identifiants(resultat, 0)).toEqual(["ca", "remu-c1"])
    expect(identifiants(resultat, 6)).toEqual(["div-c2", "salaire"])
    expect(identifiants(resultat, 11)).toEqual([])
  })

  it("ne modifie pas la session reçue", () => {
    const entree = session([], { 0: [flux("remu", "c1", "director_remuneration")] })
    const copie = structuredClone(entree)

    const resultat = sanitizeFlowsAfterRelationshipChange(entree)

    expect(entree).toEqual(copie)
    expect(resultat).not.toBe(entree.monthlyData)
  })
})
