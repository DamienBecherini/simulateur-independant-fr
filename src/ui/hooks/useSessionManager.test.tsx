// src/ui/hooks/useSessionManager.test.tsx

import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Comparateur, SaveSlot } from "@/types"
import { emptySession, makeCompany, makePerson } from "@/ui/testing/fixtures"
import { useSessionManager } from "./useSessionManager"

const comparateur: Comparateur = { activiteComparee: "company-sasu", reglagesParActivite: { "company-sasu": { partBncPrestations: 0.5 } } }
const rapportVide = { entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0, reglagesRemoved: 0, anneesEcartees: [], migrationNotes: [] }

async function gestionnaire() {
  const rendu = renderHook(() => useSessionManager())
  await waitFor(() => expect(window.api.getCurrentSession).toHaveBeenCalled())
  // La session chargée au démarrage remplace la session vierge : on attend qu'elle soit en place.
  await act(async () => {})
  return rendu
}

describe("useSessionManager et les réglages du comparateur", () => {
  it("enregistre les réglages du comparateur dans la session, sans étape d'annulation", async () => {
    const { result } = await gestionnaire()

    act(() => result.current.setComparateur(() => comparateur))

    expect(result.current.currentSession.comparateur).toEqual(comparateur)
    expect(result.current.canUndo).toBe(false)
  })

  it("garde les réglages du comparateur quand on annule ou rétablit une modification de la simulation", async () => {
    const { result } = await gestionnaire()
    act(() => result.current.setCurrentSession(session => ({ ...session, entities: [makePerson(), makeCompany()] })))
    act(() => result.current.setComparateur(() => comparateur))

    act(() => result.current.undo())
    expect(result.current.currentSession.entities).toEqual([])
    expect(result.current.currentSession.comparateur).toEqual(comparateur)

    const autres: Comparateur = { reglagesParActivite: {} }
    act(() => result.current.setComparateur(() => autres))
    act(() => result.current.redo())
    expect(result.current.currentSession.entities).toHaveLength(2)
    expect(result.current.currentSession.comparateur).toEqual(autres)
  })

  it("charge une sauvegarde avec ses réglages du comparateur", async () => {
    const { result } = await gestionnaire()
    const slot: SaveSlot = { ...emptySession(), name: "Avec réglages", comparateur, id: "slot-1", lastModified: 1 }

    act(() => result.current.handleLoadSlot(slot))

    expect(result.current.currentSession).toEqual({ name: "Avec réglages", entities: [], relationships: [], annees: slot.annees, comparateur })
  })

  it("importe une simulation avec son nom et ses réglages du comparateur", async () => {
    const { result } = await gestionnaire()
    const { entities, relationships, annees } = emptySession()
    vi.mocked(window.api.importState).mockResolvedValue({ data: { name: "Exportée", entities, relationships, annees, comparateur }, report: rapportVide })

    await act(() => result.current.handleImport())

    expect(result.current.currentSession).toEqual({ name: "Exportée", entities, relationships, annees, comparateur })
  })

  it("nomme « Simulation importée » un export sans nom", async () => {
    const { result } = await gestionnaire()
    const { entities, relationships, annees } = emptySession()
    vi.mocked(window.api.importState).mockResolvedValue({ data: { entities, relationships, annees }, report: rapportVide })

    await act(() => result.current.handleImport())

    expect(result.current.currentSession).toEqual({ name: "Simulation importée", entities, relationships, annees })
  })

  it("garde la version de l'application qui a écrit le fichier importé, à confirmer comme le reste", async () => {
    const { result } = await gestionnaire()
    const { entities, relationships, annees } = emptySession()
    vi.mocked(window.api.importState).mockResolvedValue({ data: { appVersion: "0.8.0", entities, relationships, annees }, report: { ...rapportVide, migrationNotes: ["À vérifier"] } })

    await act(() => result.current.handleImport())

    expect(result.current.importConfirmation?.session.appVersion).toBe("0.8.0")
  })
})

describe("useSessionManager et la sauvegarde chargée", () => {
  const slot: SaveSlot = { ...emptySession(), name: "Retenue", id: "slot-1", lastModified: 1 }

  it("reprend au démarrage la sauvegarde chargée retenue dans les préférences", async () => {
    vi.mocked(window.api.getSaveSlots).mockResolvedValue([slot])
    vi.mocked(window.api.getUserPreferences).mockResolvedValue({ slotOrder: ["slot-1"], loadedSlotId: "slot-1" })

    const { result } = await gestionnaire()

    expect(result.current.loadedSlotId).toBe("slot-1")
    expect(window.api.saveUserPreferences).not.toHaveBeenCalled()
  })

  it("oublie au démarrage une sauvegarde chargée qui n'existe plus, et corrige les préférences", async () => {
    vi.mocked(window.api.getUserPreferences).mockResolvedValue({ slotOrder: [], loadedSlotId: "disparue" })

    const { result } = await gestionnaire()

    expect(result.current.loadedSlotId).toBeNull()
    expect(window.api.saveUserPreferences).toHaveBeenCalledWith({ slotOrder: [] })
  })

  it("retient la sauvegarde chargée dans les préférences, et l'oublie pour une nouvelle simulation", async () => {
    vi.mocked(window.api.getSaveSlots).mockResolvedValue([slot])
    const { result } = await gestionnaire()

    act(() => result.current.handleLoadSlot(slot))
    expect(result.current.userPreferences.loadedSlotId).toBe("slot-1")

    act(() => result.current.handleResetSession())
    expect(result.current.loadedSlotId).toBeNull()
    expect(result.current.userPreferences).not.toHaveProperty("loadedSlotId")
  })

  it("accepte une mise à jour de la sauvegarde chargée calculée à partir de la précédente", async () => {
    vi.mocked(window.api.getSaveSlots).mockResolvedValue([slot, { ...slot, id: "slot-2" }])
    const { result } = await gestionnaire()

    act(() => result.current.setLoadedSlotId("slot-1"))
    act(() => result.current.setLoadedSlotId(precedente => (precedente === "slot-1" ? "slot-2" : null)))

    expect(result.current.loadedSlotId).toBe("slot-2")
  })

  it("oublie la sauvegarde chargée quand elle est supprimée de la liste", async () => {
    vi.mocked(window.api.getSaveSlots).mockResolvedValue([slot])
    const { result } = await gestionnaire()
    act(() => result.current.handleLoadSlot(slot))

    act(() => result.current.setAllSaveSlots([]))

    expect(result.current.loadedSlotId).toBeNull()
  })

  it("enregistre aussi les préférences à la fermeture de la fenêtre, une fois chargées", async () => {
    vi.mocked(window.api.getSaveSlots).mockResolvedValue([slot])
    const { result } = await gestionnaire()
    act(() => result.current.handleLoadSlot(slot))

    window.dispatchEvent(new Event("beforeunload"))

    expect(window.api.saveUserPreferences).toHaveBeenLastCalledWith({ slotOrder: ["slot-1"], loadedSlotId: "slot-1" })
  })
})
