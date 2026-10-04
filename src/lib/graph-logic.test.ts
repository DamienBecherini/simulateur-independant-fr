// src/lib/graph-logic.test.ts

import { describe, expect, it } from "vitest"
import { getAvailableRelationships } from "@/lib/graph-logic"
import type { Company, MicroEntreprise, Person, Relationship } from "@/types"

const avatar = { type: "initials", value: "AB", color: "#3b82f6" } as const

function personne(id: string): Person {
  return { id, type: "person", name: id, fiscalParts: 1, avatar, locked: false }
}

function societe(id: string, legalStatus: Company["legalStatus"] = "SASU"): Company {
  return { id, type: "company", name: id, legalStatus, capitalSocial: 1000, avatar, locked: false }
}

function micro(id: string): MicroEntreprise {
  return { id, type: "micro-entreprise", name: id, beneficieACRE: false, opteVFL: false, avatar, locked: false }
}

function relation(fromId: string, toId: string, type: Relationship["type"]): Relationship {
  return { id: `${fromId}-${toId}-${type}`, fromId, toId, type }
}

describe("getAvailableRelationships", () => {
  describe("relations possibles selon les entités", () => {
    it("propose les liens familiaux entre deux personnes", () => {
      expect(getAvailableRelationships(personne("p1"), personne("p2"), [])).toEqual(["Marié(e)", "PACSé(e)", "Enfant"])
    })

    it("propose un président et des associés pour une SASU", () => {
      expect(getAvailableRelationships(personne("p1"), societe("c1", "SASU"), [])).toEqual(["Président", "Associé"])
    })

    it("propose un gérant et des associés pour une EURL", () => {
      expect(getAvailableRelationships(personne("p1"), societe("c1", "EURL"), [])).toEqual(["Gérant", "Associé"])
    })

    it("propose un titulaire pour une entreprise individuelle, au réel ou en micro", () => {
      expect(getAvailableRelationships(personne("p1"), societe("c1", "EI"), [])).toEqual(["Titulaire"])
      expect(getAvailableRelationships(personne("p1"), micro("m1"), [])).toEqual(["Titulaire"])
    })

    it("propose les mêmes relations quand l'activité est la source", () => {
      expect(getAvailableRelationships(societe("c1", "EURL"), personne("p1"), [])).toEqual(["Gérant", "Associé"])
      expect(getAvailableRelationships(micro("m1"), personne("p1"), [])).toEqual(["Titulaire"])
    })

    it("ne propose rien entre deux activités", () => {
      expect(getAvailableRelationships(societe("c1"), societe("c2"), [])).toEqual([])
      expect(getAvailableRelationships(societe("c1"), micro("m1"), [])).toEqual([])
      expect(getAvailableRelationships(micro("m1"), societe("c1"), [])).toEqual([])
      expect(getAvailableRelationships(micro("m1"), micro("m2"), [])).toEqual([])
    })

    it("ne propose rien entre une entité et elle-même", () => {
      expect(getAvailableRelationships(personne("p1"), personne("p1"), [])).toEqual([])
    })
  })

  describe("relations déjà existantes", () => {
    it("retire une relation déjà créée entre une personne et une activité", () => {
      const existantes = [relation("p1", "c1", "Président")]

      expect(getAvailableRelationships(personne("p1"), societe("c1"), existantes)).toEqual(["Associé"])
    })

    it("retire une relation créée dans l'autre sens", () => {
      const existantes = [relation("c1", "p1", "Associé")]

      expect(getAvailableRelationships(personne("p1"), societe("c1"), existantes)).toEqual(["Président"])
    })

    it("ne propose plus rien quand toutes les relations existent", () => {
      const existantes = [relation("p1", "c1", "Président"), relation("p1", "c1", "Associé")]

      expect(getAvailableRelationships(personne("p1"), societe("c1"), existantes)).toEqual([])
    })

    it("n'autorise qu'un seul lien familial entre deux personnes, quel que soit son sens", () => {
      expect(getAvailableRelationships(personne("p1"), personne("p2"), [relation("p2", "p1", "Marié(e)")])).toEqual([])
      expect(getAvailableRelationships(personne("p1"), personne("p2"), [relation("p1", "p2", "Enfant")])).toEqual([])
    })

    it("ignore les relations qui concernent d'autres entités", () => {
      const existantes = [relation("p1", "c2", "Président"), relation("p2", "c1", "Président"), relation("p2", "c2", "Associé")]

      expect(getAvailableRelationships(personne("p1"), societe("c1"), existantes)).toEqual(["Président", "Associé"])
    })

    it("ignore une relation qui ne partage qu'une extrémité dans le sens inverse", () => {
      const existantes = [relation("c1", "p2", "Président"), relation("c2", "p1", "Associé")]

      expect(getAvailableRelationships(personne("p1"), societe("c1"), existantes)).toEqual(["Président", "Associé"])
    })
  })
})
