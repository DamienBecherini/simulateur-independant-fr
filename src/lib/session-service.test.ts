// src/lib/session-service.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createNewSlotFromSession, exportState, importState, saveAllSlots, updateSlotWithSession } from "@/lib/session-service"
import type { ExportableState, SanitizationReport, SaveSlot, SessionState } from "@/types"

const MAINTENANT = 1_700_000_000_000

const session: SessionState = {
  name: "Scénario 2025",
  entities: [{ id: "p1", type: "person", name: "Alice", fiscalParts: 1, avatar: { type: "initials", value: "A", color: "#3b82f6" }, locked: false }],
  relationships: [],
  annees: [{ annee: 2026, monthlyData: Array.from({ length: 12 }, (_, month) => ({ month, flows: [] })) }]
}

const api = {
  exportState: vi.fn(),
  importState: vi.fn(),
  saveSlots: vi.fn()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(MAINTENANT)
  vi.stubGlobal("window", { api })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe("createNewSlotFromSession", () => {
  it("copie la session dans un nouveau slot horodaté", () => {
    expect(createNewSlotFromSession(session)).toEqual({
      id: expect.stringMatching(/^slot-[0-9a-f-]{36}$/),
      name: "Scénario 2025",
      entities: session.entities,
      relationships: session.relationships,
      annees: session.annees,
      lastModified: MAINTENANT
    })
  })

  it("donne un identifiant distinct à deux slots créés dans la même milliseconde", () => {
    expect(createNewSlotFromSession(session).id).not.toBe(createNewSlotFromSession(session).id)
  })
})

describe("updateSlotWithSession", () => {
  const slot: SaveSlot = { id: "slot-1", name: "Ancien nom", entities: [], relationships: [], annees: [], lastModified: 1 }

  it("remplace le contenu du slot en conservant son identifiant", () => {
    expect(updateSlotWithSession(slot, session)).toEqual({
      id: "slot-1",
      name: "Scénario 2025",
      entities: session.entities,
      relationships: session.relationships,
      annees: session.annees,
      lastModified: MAINTENANT
    })
  })

  it("ne modifie pas le slot reçu", () => {
    updateSlotWithSession(slot, session)

    expect(slot.name).toBe("Ancien nom")
    expect(slot.lastModified).toBe(1)
  })
})

describe("pont vers l'API Electron", () => {
  it("transmet l'état à exporter", () => {
    const etat = { entities: session.entities, relationships: session.relationships, annees: session.annees }

    exportState(etat)

    expect(api.exportState).toHaveBeenCalledExactlyOnceWith(etat)
  })

  it("transmet la liste des slots à sauvegarder", () => {
    const slots: SaveSlot[] = [{ ...session, id: "slot-1", lastModified: MAINTENANT }]

    saveAllSlots(slots)

    expect(api.saveSlots).toHaveBeenCalledExactlyOnceWith(slots, undefined)

    saveAllSlots(slots, { silencieux: true })
    expect(api.saveSlots).toHaveBeenLastCalledWith(slots, { silencieux: true })
  })

  describe("importState", () => {
    const data: ExportableState = { entities: session.entities, relationships: [], annees: session.annees }
    const report: SanitizationReport = { entitiesRemoved: 0, relationshipsRemoved: 1, flowsRemoved: 2, anneesEcartees: [], migrationNotes: [] }

    it("renvoie les données et le rapport de nettoyage", async () => {
      api.importState.mockResolvedValue({ data, report })

      await expect(importState()).resolves.toEqual({ data, report })
    })

    it("ne renvoie que les données et le rapport", async () => {
      api.importState.mockResolvedValue({ data, report, error: "ignorée" })

      await expect(importState()).resolves.toEqual({ data, report })
    })

    it.each([
      ["l'import est annulé", undefined],
      ["le backend renvoie une erreur", { error: "Fichier illisible" }],
      ["le rapport est absent", { data }],
      ["les données sont absentes", { report }]
    ])("renvoie null quand %s", async (_cas, reponse) => {
      api.importState.mockResolvedValue(reponse)

      await expect(importState()).resolves.toBeNull()
    })
  })
})
