// src/backend/logic/data-sanitizer.test.ts

import { afterEach, describe, expect, it, vi } from "vitest"
import { sanitizeSlots, sanitizeStateAndFillDefaults } from "./data-sanitizer.js"

const avatar = { type: "initials", value: "AB", color: "#3b82f6" }

const alice = { id: "p1", type: "person", name: "Alice", fiscalParts: 1, avatar, locked: false }
const sasu = { id: "c1", type: "company", name: "Ma SASU", legalStatus: "SASU", avatar, locked: false }

/** Grille de 12 mois dont seul janvier porte des flux. */
function grille(fluxDeJanvier: unknown[] = []) {
  return Array.from({ length: 12 }, (_, month) => ({ month, flows: month === 0 ? fluxDeJanvier : [] }))
}

function flux(id: string, entityId: string) {
  return { id, label: "Flux", amount: 1000, entityId, type: "salary" }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("sanitizeStateAndFillDefaults", () => {
  describe("valeurs par défaut", () => {
    it("construit une session vide complète à partir d'un objet vide", () => {
      const { safeState, report } = sanitizeStateAndFillDefaults({})

      expect(safeState.name).toBe("Nouvelle Simulation")
      expect(safeState.entities).toEqual([])
      expect(safeState.relationships).toEqual([])
      expect(safeState.monthlyData).toEqual(grille())
      expect(report).toEqual({ entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0 })
    })

    it("complète les champs facultatifs des entités", () => {
      const { safeState } = sanitizeStateAndFillDefaults({
        entities: [
          { id: "p1", type: "person", avatar },
          { id: "c1", type: "company", legalStatus: "EURL", avatar },
          { id: "m1", type: "micro-entreprise", avatar }
        ]
      })

      expect(safeState.entities).toEqual([
        { id: "p1", type: "person", name: "Nouvelle Personne", fiscalParts: 1, avatar, locked: false },
        { id: "c1", type: "company", name: "Nouvelle Société", legalStatus: "EURL", avatar, locked: false },
        { id: "m1", type: "micro-entreprise", name: "Nouvelle Micro-Entreprise", beneficieACRE: false, opteVFL: false, avatar, locked: false }
      ])
    })

    it("met à 0 le montant d'un flux qui n'en a pas", () => {
      const { safeState } = sanitizeStateAndFillDefaults({
        entities: [alice],
        monthlyData: grille([{ id: "f1", label: "Salaire", entityId: "p1", type: "salary" }])
      })

      expect(safeState.monthlyData[0].flows).toEqual([{ id: "f1", label: "Salaire", amount: 0, entityId: "p1", type: "salary" }])
    })

    it("conserve une session déjà valide à l'identique", () => {
      const session = {
        name: "Scénario 2025",
        entities: [alice, sasu],
        relationships: [{ id: "r1", fromId: "p1", toId: "c1", type: "Président" }],
        monthlyData: grille([flux("f1", "p1")])
      }

      const { safeState, report } = sanitizeStateAndFillDefaults(session)

      expect(safeState).toEqual(session)
      expect(report).toEqual({ entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0 })
    })

    it("écarte les propriétés inconnues", () => {
      const { safeState } = sanitizeStateAndFillDefaults({ name: "Test", proprieteInconnue: 42 })

      expect(safeState).not.toHaveProperty("proprieteInconnue")
      expect(safeState.name).toBe("Test")
    })
  })

  describe("cohérence sémantique", () => {
    it("supprime les relations dont une extrémité n'existe plus", () => {
      const { safeState, report } = sanitizeStateAndFillDefaults({
        entities: [alice, sasu],
        relationships: [
          { id: "r1", fromId: "p1", toId: "c1", type: "Président" },
          { id: "r2", fromId: "p1", toId: "fantome", type: "Associé" },
          { id: "r3", fromId: "fantome", toId: "c1", type: "Gérant" },
          { id: "r4", fromId: "fantome", toId: "autre-fantome", type: "Marié(e)" }
        ]
      })

      expect(safeState.relationships).toEqual([{ id: "r1", fromId: "p1", toId: "c1", type: "Président" }])
      expect(report.relationshipsRemoved).toBe(3)
      expect(report.flowsRemoved).toBe(0)
    })

    it("supprime les flux rattachés à une entité inexistante, mois par mois", () => {
      const monthlyData = grille([flux("f1", "p1"), flux("f2", "fantome")])
      monthlyData[5] = { month: 5, flows: [flux("f3", "fantome"), flux("f4", "c1")] }
      monthlyData[11] = { month: 11, flows: [flux("f5", "fantome")] }

      const { safeState, report } = sanitizeStateAndFillDefaults({ entities: [alice, sasu], monthlyData })

      expect(safeState.monthlyData[0].flows.map(f => f.id)).toEqual(["f1"])
      expect(safeState.monthlyData[5].flows.map(f => f.id)).toEqual(["f4"])
      expect(safeState.monthlyData[11].flows).toEqual([])
      expect(safeState.monthlyData).toHaveLength(12)
      expect(safeState.monthlyData.map(m => m.month)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
      expect(report.flowsRemoved).toBe(3)
      expect(report.relationshipsRemoved).toBe(0)
    })

    it("supprime tout ce qui pointe vers une entité quand la session n'en contient aucune", () => {
      const { safeState, report } = sanitizeStateAndFillDefaults({
        relationships: [{ id: "r1", fromId: "p1", toId: "c1", type: "Président" }],
        monthlyData: grille([flux("f1", "p1")])
      })

      expect(safeState.relationships).toEqual([])
      expect(safeState.monthlyData).toEqual(grille())
      expect(report).toEqual({ entitiesRemoved: 0, relationshipsRemoved: 1, flowsRemoved: 1 })
    })
  })

  describe("éléments invalides", () => {
    it("conserve les entités valides quand une seule est corrompue", () => {
      const { safeState, report } = sanitizeStateAndFillDefaults({
        name: "Scénario 2025",
        entities: [alice, { id: "x1", type: "association", name: "Type inconnu" }, sasu, "pas une entité"],
        relationships: [{ id: "r1", fromId: "p1", toId: "c1", type: "Président" }],
        monthlyData: grille([flux("f1", "p1")])
      })

      expect(safeState.name).toBe("Scénario 2025")
      expect(safeState.entities).toEqual([alice, sasu])
      expect(safeState.relationships).toHaveLength(1)
      expect(safeState.monthlyData[0].flows).toHaveLength(1)
      expect(report).toEqual({ entitiesRemoved: 2, relationshipsRemoved: 0, flowsRemoved: 0 })
    })

    it("supprime aussi les relations et les flux de l'entité écartée", () => {
      const { safeState, report } = sanitizeStateAndFillDefaults({
        entities: [alice, { ...sasu, legalStatus: "SCI" }],
        relationships: [{ id: "r1", fromId: "p1", toId: "c1", type: "Président" }],
        monthlyData: grille([flux("f1", "p1"), flux("f2", "c1")])
      })

      expect(safeState.entities).toEqual([alice])
      expect(safeState.relationships).toEqual([])
      expect(safeState.monthlyData[0].flows.map(f => f.id)).toEqual(["f1"])
      expect(report).toEqual({ entitiesRemoved: 1, relationshipsRemoved: 1, flowsRemoved: 1 })
    })

    it("écarte une relation invalide sans toucher aux autres", () => {
      const { safeState, report } = sanitizeStateAndFillDefaults({
        entities: [alice, sasu],
        relationships: [
          { id: "r1", fromId: "p1", toId: "c1", type: "Cousin" },
          { id: "r2", fromId: "p1", toId: "c1", type: "Associé" },
          { id: "r3", fromId: "p1", toId: "fantome", type: "Associé" }
        ]
      })

      expect(safeState.entities).toEqual([alice, sasu])
      expect(safeState.relationships).toEqual([{ id: "r2", fromId: "p1", toId: "c1", type: "Associé" }])
      expect(report).toEqual({ entitiesRemoved: 0, relationshipsRemoved: 2, flowsRemoved: 0 })
    })

    it("écarte un flux invalide sans toucher aux autres", () => {
      const { safeState, report } = sanitizeStateAndFillDefaults({
        entities: [alice],
        monthlyData: grille([flux("f1", "p1"), { ...flux("f2", "p1"), type: "pot-de-vin" }, null, flux("f3", "fantome")])
      })

      expect(safeState.monthlyData[0].flows.map(f => f.id)).toEqual(["f1"])
      expect(safeState.monthlyData).toHaveLength(12)
      expect(report).toEqual({ entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 3 })
    })
  })

  describe("données irrécupérables", () => {
    it.each([
      ["null", null],
      ["une chaîne", "pas une session"],
      ["un tableau", [1, 2, 3]],
      ["une grille de 11 mois", { monthlyData: grille().slice(0, 11) }],
      ["un mois qui n'est pas un objet", { monthlyData: [...grille().slice(0, 11), "décembre"] }],
      ["un mois sans liste de flux", { monthlyData: [...grille().slice(0, 11), { month: 11 }] }],
      ["un nom qui n'est pas une chaîne", { name: 42, entities: [alice] }]
    ])("repart d'une session vide pour %s", (_cas, donnees) => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

      const { safeState, report } = sanitizeStateAndFillDefaults(donnees)

      expect(safeState).toEqual({ name: "Nouvelle Simulation", entities: [], relationships: [], monthlyData: grille() })
      expect(report).toEqual({ entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0 })
      expect(consoleError).toHaveBeenCalledOnce()
    })
  })
})

describe("sanitizeSlots", () => {
  const slot = {
    id: "slot-1",
    lastModified: 1_700_000_000_000,
    name: "Scénario A",
    entities: [alice],
    relationships: [],
    monthlyData: grille([flux("f1", "p1")])
  }

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["un objet", { 0: slot }],
    ["une chaîne", "slots"]
  ])("renvoie une liste vide pour %s", (_cas, donnees) => {
    expect(sanitizeSlots(donnees)).toEqual([])
  })

  it("renvoie une liste vide pour un tableau vide", () => {
    expect(sanitizeSlots([])).toEqual([])
  })

  it("conserve les slots valides avec leur identifiant et leur date", () => {
    const autre = { ...slot, id: "slot-2", lastModified: 1_700_000_500_000, name: "Scénario B" }

    expect(sanitizeSlots([slot, autre])).toEqual([slot, autre])
  })

  it("applique les valeurs par défaut à chaque slot", () => {
    const [resultat] = sanitizeSlots([{ id: "slot-1", lastModified: 42 }])

    expect(resultat).toEqual({ id: "slot-1", lastModified: 42, name: "Nouvelle Simulation", entities: [], relationships: [], monthlyData: grille() })
  })

  it("nettoie les relations et flux orphelins de chaque slot", () => {
    const [resultat] = sanitizeSlots([
      {
        ...slot,
        relationships: [{ id: "r1", fromId: "p1", toId: "fantome", type: "Président" }],
        monthlyData: grille([flux("f1", "p1"), flux("f2", "fantome")])
      }
    ])

    expect(resultat.relationships).toEqual([])
    expect(resultat.monthlyData[0].flows.map(f => f.id)).toEqual(["f1"])
    expect(resultat.id).toBe("slot-1")
    expect(resultat.lastModified).toBe(1_700_000_000_000)
  })

  it("ignore uniquement les slots corrompus, comme l'annonce le message d'avertissement", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
    const autre = { ...slot, id: "slot-2", name: "Scénario B" }

    const resultat = sanitizeSlots([
      slot,
      { name: "Slot sans identifiant" },
      { ...slot, id: "slot-sans-date", lastModified: "hier" },
      { ...slot, id: "slot-grille-tronquee", monthlyData: grille().slice(0, 11) },
      null,
      autre
    ])

    expect(resultat).toEqual([slot, autre])
    expect(consoleWarn).toHaveBeenCalledOnce()
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("4 sur 6"))
  })

  it("conserve un slot dont seul un élément est invalide, en écartant cet élément", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const [resultat] = sanitizeSlots([{ ...slot, entities: [alice, { id: "x1", type: "association" }] }])

    expect(resultat).toEqual(slot)
    expect(consoleWarn).not.toHaveBeenCalled()
  })
})
