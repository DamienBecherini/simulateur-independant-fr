// src/backend/logic/data-sanitizer.test.ts

import { afterEach, describe, expect, it, vi } from "vitest"
import { AnneesRefuseesError, nettoyerLesSlots, rapportAvecCorrections, sanitizeSlots, sanitizeStateAndFillDefaults, texteAnneesEcartees } from "./data-sanitizer.js"
import { FORMAT_VERSION_ACTUEL } from "./migrations.js"

const avatar = { type: "initials", value: "AB", color: "#3b82f6" }

const alice = { id: "p1", type: "person", name: "Alice", fiscalParts: 1, avatar, locked: false }
const sasu = { id: "c1", type: "company", name: "Ma SASU", legalStatus: "SASU", capitalSocial: 1000, avatar, locked: false }

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
      expect(safeState.annees).toEqual([{ annee: 2026, monthlyData: grille() }])
      expect(report).toMatchObject({ entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0 })
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
        { id: "c1", type: "company", name: "Nouvelle Société", legalStatus: "EURL", capitalSocial: 1000, avatar, locked: false },
        { id: "m1", type: "micro-entreprise", name: "Nouvelle Micro-Entreprise", beneficieACRE: false, opteVFL: false, avatar, locked: false }
      ])
    })

    it("complète les frais réels d'une personne et les déplacements d'une activité, sans changer de format", () => {
      const { safeState } = sanitizeStateAndFillDefaults({
        entities: [
          { ...alice, fraisReels: { kmParTrajet: 20 } },
          { ...sasu, deplacementsProfessionnels: { kmParAn: 3000, electrique: true } },
          { id: "m1", type: "micro-entreprise", avatar, deplacementsProfessionnels: {} }
        ]
      })

      expect(safeState.entities[0]).toMatchObject({ fraisReels: { kmParTrajet: 20, joursTravailles: 0, puissanceFiscale: "5", electrique: false, distanceJustifiee: false, autresFrais: 0 } })
      expect(safeState.entities[1]).toMatchObject({ deplacementsProfessionnels: { kmParAn: 3000, puissanceFiscale: "5", electrique: true } })
      expect(safeState.entities[2]).toMatchObject({ deplacementsProfessionnels: { kmParAn: 0, puissanceFiscale: "5", electrique: false } })
    })

    it("met à 0 le montant d'un flux qui n'en a pas", () => {
      const { safeState } = sanitizeStateAndFillDefaults({
        entities: [alice],
        monthlyData: grille([{ id: "f1", label: "Salaire", entityId: "p1", type: "salary" }])
      })

      expect(safeState.annees[0].monthlyData[0].flows).toEqual([{ id: "f1", label: "Salaire", amount: 0, entityId: "p1", type: "salary" }])
    })

    it("conserve une session déjà valide à l'identique", () => {
      const session = {
        name: "Scénario 2025",
        entities: [alice, sasu],
        relationships: [{ id: "r1", fromId: "p1", toId: "c1", type: "Président" }],
        annees: [
          { annee: 2025, monthlyData: grille([flux("f1", "p1")]) },
          { annee: 2026, monthlyData: grille() }
        ]
      }

      const { safeState, report } = sanitizeStateAndFillDefaults({ ...session, formatVersion: FORMAT_VERSION_ACTUEL })

      expect(safeState).toEqual(session)
      expect(report).toMatchObject({ entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0 })
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

      expect(safeState.annees[0].monthlyData[0].flows.map(f => f.id)).toEqual(["f1"])
      expect(safeState.annees[0].monthlyData[5].flows.map(f => f.id)).toEqual(["f4"])
      expect(safeState.annees[0].monthlyData[11].flows).toEqual([])
      expect(safeState.annees[0].monthlyData).toHaveLength(12)
      expect(safeState.annees[0].monthlyData.map(m => m.month)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
      expect(report.flowsRemoved).toBe(3)
      expect(report.relationshipsRemoved).toBe(0)
    })

    it("supprime tout ce qui pointe vers une entité quand la session n'en contient aucune", () => {
      const { safeState, report } = sanitizeStateAndFillDefaults({
        relationships: [{ id: "r1", fromId: "p1", toId: "c1", type: "Président" }],
        monthlyData: grille([flux("f1", "p1")])
      })

      expect(safeState.relationships).toEqual([])
      expect(safeState.annees).toEqual([{ annee: 2026, monthlyData: grille() }])
      expect(report).toMatchObject({ entitiesRemoved: 0, relationshipsRemoved: 1, flowsRemoved: 1 })
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
      expect(safeState.annees[0].monthlyData[0].flows).toHaveLength(1)
      expect(report).toMatchObject({ entitiesRemoved: 2, relationshipsRemoved: 0, flowsRemoved: 0 })
    })

    it("supprime aussi les relations et les flux de l'entité écartée", () => {
      const { safeState, report } = sanitizeStateAndFillDefaults({
        entities: [alice, { ...sasu, legalStatus: "SCI" }],
        relationships: [{ id: "r1", fromId: "p1", toId: "c1", type: "Président" }],
        monthlyData: grille([flux("f1", "p1"), flux("f2", "c1")])
      })

      expect(safeState.entities).toEqual([alice])
      expect(safeState.relationships).toEqual([])
      expect(safeState.annees[0].monthlyData[0].flows.map(f => f.id)).toEqual(["f1"])
      expect(report).toMatchObject({ entitiesRemoved: 1, relationshipsRemoved: 1, flowsRemoved: 1 })
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
      expect(report).toMatchObject({ entitiesRemoved: 0, relationshipsRemoved: 2, flowsRemoved: 0 })
    })

    it("écarte un flux invalide sans toucher aux autres", () => {
      const { safeState, report } = sanitizeStateAndFillDefaults({
        entities: [alice],
        monthlyData: grille([flux("f1", "p1"), { ...flux("f2", "p1"), type: "pot-de-vin" }, null, flux("f3", "fantome")])
      })

      expect(safeState.annees[0].monthlyData[0].flows.map(f => f.id)).toEqual(["f1"])
      expect(safeState.annees[0].monthlyData).toHaveLength(12)
      expect(report).toMatchObject({ entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 3 })
    })
  })

  describe("années", () => {
    /** Une session au format actuel, avec les années données. */
    const sessionDesAnnees = (annees: unknown) => ({ formatVersion: FORMAT_VERSION_ACTUEL, entities: [alice], annees })

    it("trie les années dans l'ordre chronologique", () => {
      const { safeState } = sanitizeStateAndFillDefaults(sessionDesAnnees([2026, 2024, 2025].map(annee => ({ annee, monthlyData: grille() }))))

      expect(safeState.annees.map(a => a.annee)).toEqual([2024, 2025, 2026])
    })

    it("écarte une année en double, et compte ses flux parmi les flux supprimés", () => {
      const { safeState, report } = sanitizeStateAndFillDefaults(
        sessionDesAnnees([
          { annee: 2026, monthlyData: grille([flux("f1", "p1")]) },
          { annee: 2026, monthlyData: grille([flux("f2", "p1"), flux("f3", "p1")]) }
        ])
      )

      expect(safeState.annees).toEqual([{ annee: 2026, monthlyData: grille([flux("f1", "p1")]) }])
      expect(report.flowsRemoved).toBe(2)
      expect(report.anneesEcartees).toEqual([2026])
    })

    it("signale une année en double même sans flux, une seule fois par année", () => {
      const { report } = sanitizeStateAndFillDefaults(
        sessionDesAnnees([
          { annee: 2025, monthlyData: grille() },
          { annee: 2026, monthlyData: grille() },
          { annee: 2025, monthlyData: grille() },
          { annee: 2025, monthlyData: grille() },
          { annee: 2026, monthlyData: grille() }
        ])
      )

      expect(report).toMatchObject({ flowsRemoved: 0, anneesEcartees: [2025, 2026] })
      expect(rapportAvecCorrections(report)).toBe(true)
    })

    it("ne signale rien pour des années sans doublon", () => {
      const { report } = sanitizeStateAndFillDefaults(sessionDesAnnees([{ annee: 2026, monthlyData: grille() }]))

      expect(report.anneesEcartees).toEqual([])
      expect(rapportAvecCorrections(report)).toBe(false)
    })

    it("accepte dix années consécutives", () => {
      const { safeState } = sanitizeStateAndFillDefaults(sessionDesAnnees(Array.from({ length: 10 }, (_, i) => ({ annee: 2024 + i, monthlyData: grille() }))))

      expect(safeState.annees).toHaveLength(10)
    })

    it("refuse plus de dix années", () => {
      const onze = sessionDesAnnees(Array.from({ length: 11 }, (_, i) => ({ annee: 2024 + i, monthlyData: grille() })))

      expect(() => sanitizeStateAndFillDefaults(onze)).toThrow(AnneesRefuseesError)
      expect(() => sanitizeStateAndFillDefaults(onze)).toThrow("Cette simulation contient 11 années, de 2024 à 2034")
    })

    it("refuse des années qui ne se suivent pas, une fois les doublons écartés, en nommant les années manquantes", () => {
      const avecUnTrou = sessionDesAnnees([2024, 2027, 2024].map(annee => ({ annee, monthlyData: grille() })))

      expect(() => sanitizeStateAndFillDefaults(avecUnTrou)).toThrow("il manque 2025 et 2026 entre 2024 et 2027")
    })

    it("nettoie les flux de chaque année", () => {
      const { safeState, report } = sanitizeStateAndFillDefaults(
        sessionDesAnnees([
          { annee: 2025, monthlyData: grille([flux("f1", "fantome")]) },
          { annee: 2026, monthlyData: grille([flux("f2", "p1"), { id: "f3" }]) }
        ])
      )

      expect(safeState.annees.map(a => a.monthlyData[0].flows.map(f => f.id))).toEqual([[], ["f2"]])
      expect(report.flowsRemoved).toBe(2)
    })

    it("donne l'année par défaut à une session dont la liste des années est vide", () => {
      const { safeState } = sanitizeStateAndFillDefaults(sessionDesAnnees([]))

      expect(safeState.entities).toEqual([alice])
      expect(safeState.annees).toEqual([{ annee: 2026, monthlyData: grille() }])
    })

    it.each([
      ["une année sans numéro", [{ monthlyData: grille() }]],
      ["une année qui n'est pas un objet", ["2026"]],
      ["une année au numéro décimal", [{ annee: 2025.5, monthlyData: grille() }]],
      ["une liste d'années qui n'en est pas une", "2026"]
    ])("repart d'une session vide pour %s", (_cas, annees) => {
      vi.spyOn(console, "error").mockImplementation(() => {})

      expect(sanitizeStateAndFillDefaults(sessionDesAnnees(annees)).safeState.entities).toEqual([])
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

      expect(safeState).toEqual({ name: "Nouvelle Simulation", entities: [], relationships: [], annees: [{ annee: 2026, monthlyData: grille() }] })
      expect(report).toMatchObject({ entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0 })
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
    annees: [{ annee: 2026, monthlyData: grille([flux("f1", "p1")]) }]
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

    expect(resultat).toEqual({ id: "slot-1", lastModified: 42, name: "Nouvelle Simulation", entities: [], relationships: [], annees: [{ annee: 2026, monthlyData: grille() }] })
  })

  it("nettoie les relations et flux orphelins de chaque slot", () => {
    const [resultat] = sanitizeSlots([
      {
        ...slot,
        relationships: [{ id: "r1", fromId: "p1", toId: "fantome", type: "Président" }],
        annees: [{ annee: 2026, monthlyData: grille([flux("f1", "p1"), flux("f2", "fantome")]) }]
      }
    ])

    expect(resultat.relationships).toEqual([])
    expect(resultat.annees[0].monthlyData[0].flows.map(f => f.id)).toEqual(["f1"])
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
      { ...slot, id: "slot-grille-tronquee", annees: [{ annee: 2026, monthlyData: grille().slice(0, 11) }] },
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

describe("nettoyerLesSlots", () => {
  const slot = (id: string, name: string, annees: number[]) => ({ id, lastModified: 1, name, entities: [alice], relationships: [], annees: annees.map(annee => ({ annee, monthlyData: grille() })) })

  it("rend à part les sauvegardes refusées à cause de leurs années, avec leur nom et le motif", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const bonne = slot("s1", "Bonne", [2025, 2026])

    const { slots, refusees } = nettoyerLesSlots([bonne, slot("s2", "Trouée", [2024, 2026]), slot("s3", "", Array.from({ length: 11 }, (_, i) => 2024 + i)), { name: "Sans identifiant" }])

    expect(slots).toEqual([bonne])
    expect(refusees).toEqual([
      { nom: "Trouée", raison: expect.stringContaining("il manque 2025") },
      { nom: "Sans nom", raison: expect.stringContaining("11 années") }
    ])
  })

  it("rend des listes vides pour autre chose qu'un tableau", () => {
    expect(nettoyerLesSlots("slots")).toEqual({ slots: [], refusees: [] })
  })
})

describe("texteAnneesEcartees", () => {
  it("accorde le texte au nombre d'années", () => {
    expect(texteAnneesEcartees([2025])).toBe("Année en double écartée : 2025")
    expect(texteAnneesEcartees([2025, 2026])).toBe("Années en double écartées : 2025, 2026")
  })
})
