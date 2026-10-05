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
})
