// src/backend/logic/foyers.test.ts

import { describe, expect, it } from "vitest"
import { buildFoyers } from "./foyers.js"
import { reglesDeTest } from "./testing/regles-de-test.js"
import { micro, personne, relation, session, societe } from "./testing/session-de-test.js"
import type { Entity, Relationship } from "../../types.js"

const foyers = (entities: Entity[], relationships: Relationship[] = []) => buildFoyers(session(entities, relationships), reglesDeTest.IR.partsParEnfant)

describe("buildFoyers", () => {
  it("ne crée aucun foyer sans personne", () => {
    expect(foyers([societe("s1"), micro("m1")])).toEqual([])
  })

  it("crée un foyer par personne seule, avec ses propres parts", () => {
    expect(foyers([personne("alice"), personne("bob", 1.5)])).toEqual([
      { declarantIds: ["alice"], enfantIds: [], totalParts: 1, nombreDeclarants: 1, warnings: [] },
      { declarantIds: ["bob"], enfantIds: [], totalParts: 1.5, nombreDeclarants: 1, warnings: [] }
    ])
  })

  it.each(["Marié(e)", "PACSé(e)"] as const)("réunit un couple %s en un seul foyer à deux déclarants", type => {
    expect(foyers([personne("alice"), personne("bob")], [relation("bob", "alice", type)])).toEqual([{ declarantIds: ["alice", "bob"], enfantIds: [], totalParts: 2, nombreDeclarants: 2, warnings: [] }])
  })

  it("laisse deux foyers distincts pour un couple en union libre", () => {
    const resultat = foyers([personne("alice"), personne("bob")], [relation("alice", "bob", "En couple")])

    expect(resultat.map(f => f.declarantIds)).toEqual([["alice"], ["bob"]])
  })

  it("ignore les relations de couple vers une entité qui n'est pas une personne", () => {
    expect(foyers([personne("alice"), societe("s1")], [relation("alice", "s1", "Marié(e)")])).toHaveLength(1)
  })

  describe("enfants", () => {
    it("rattache l'enfant au foyer de son parent : la relation va du parent vers l'enfant", () => {
      expect(foyers([personne("parent"), personne("enfant")], [relation("parent", "enfant", "Enfant")])).toEqual([{ declarantIds: ["parent"], enfantIds: ["enfant"], totalParts: 1.5, nombreDeclarants: 1, warnings: [] }])
    })

    it("signale un parent qui a plus d'une part propre en plus d'enfants reliés", () => {
      const [foyer] = foyers([personne("parent", 1.5), personne("enfant")], [relation("parent", "enfant", "Enfant")])

      expect(foyer.totalParts).toBe(2)
      expect(foyer.warnings).toHaveLength(1)
      expect(foyer.warnings[0]).toContain("parent : plus d'une part propre et des enfants reliés")
    })

    it("ne signale rien pour une part majorée sans enfant relié", () => {
      expect(foyers([personne("parent", 2.5)])[0].warnings).toEqual([])
    })

    it("ignore les parts saisies sur l'enfant : seul son rang compte", () => {
      const [foyer] = foyers([personne("parent"), personne("enfant", 3)], [relation("parent", "enfant", "Enfant")])

      expect(foyer.totalParts).toBe(1.5)
    })

    it("compte une demi-part pour chacun des deux premiers enfants et une part entière ensuite", () => {
      const parents = [personne("alice"), personne("bob")]
      const enfants = [personne("e1"), personne("e2"), personne("e3"), personne("e4")]
      const liens = [relation("alice", "bob", "Marié(e)"), ...enfants.map(e => relation("alice", e.id, "Enfant"))]

      const [foyer] = foyers([...parents, ...enfants], liens)

      expect(foyer.enfantIds).toEqual(["e1", "e2", "e3", "e4"])
      expect(foyer.totalParts).toBe(2 + 0.5 + 0.5 + 1 + 1)
    })

    it("ne compte qu'une fois un enfant relié à ses deux parents mariés", () => {
      const liens = [relation("alice", "bob", "Marié(e)"), relation("alice", "enfant", "Enfant"), relation("bob", "enfant", "Enfant")]

      const resultat = foyers([personne("alice"), personne("bob"), personne("enfant")], liens)

      expect(resultat).toEqual([{ declarantIds: ["alice", "bob"], enfantIds: ["enfant"], totalParts: 2.5, nombreDeclarants: 2, warnings: [] }])
    })

    it("rattache au premier parent un enfant relié à deux foyers, et le signale", () => {
      const liens = [relation("alice", "enfant", "Enfant"), relation("bob", "enfant", "Enfant")]

      const [foyerAlice, foyerBob] = foyers([personne("alice"), personne("bob"), personne("enfant")], liens)

      expect(foyerAlice.enfantIds).toEqual(["enfant"])
      expect(foyerAlice.warnings).toHaveLength(1)
      expect(foyerAlice.warnings[0]).toContain("foyers différents")
      expect(foyerBob).toEqual({ declarantIds: ["bob"], enfantIds: [], totalParts: 1, nombreDeclarants: 1, warnings: [] })
    })

    it("laisse un enfant en couple déclarer de son côté", () => {
      const liens = [relation("parent", "enfant", "Enfant"), relation("enfant", "conjoint", "PACSé(e)")]

      const resultat = foyers([personne("parent"), personne("enfant"), personne("conjoint")], liens)

      expect(resultat).toEqual([
        { declarantIds: ["parent"], enfantIds: [], totalParts: 1, nombreDeclarants: 1, warnings: [] },
        { declarantIds: ["enfant", "conjoint"], enfantIds: [], totalParts: 2, nombreDeclarants: 2, warnings: [] }
      ])
    })

    it("ne rattache pas un petit-enfant dont le parent est lui-même rattaché", () => {
      const liens = [relation("grandParent", "parent", "Enfant"), relation("parent", "petitEnfant", "Enfant")]

      const resultat = foyers([personne("grandParent"), personne("parent"), personne("petitEnfant")], liens)

      expect(resultat.map(f => f.declarantIds)).toEqual([["grandParent"], ["petitEnfant"]])
      expect(resultat[0].enfantIds).toEqual(["parent"])
    })
  })

  it("signale plus de deux personnes reliées par des relations de couple", () => {
    const liens = [relation("a", "b", "Marié(e)"), relation("b", "c", "PACSé(e)")]

    const [foyer] = foyers([personne("a"), personne("b"), personne("c")], liens)

    expect(foyer.declarantIds).toEqual(["a", "b", "c"])
    expect(foyer.nombreDeclarants).toBe(2)
    expect(foyer.warnings).toHaveLength(1)
  })
})
