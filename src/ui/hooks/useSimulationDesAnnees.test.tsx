// src/ui/hooks/useSimulationDesAnnees.test.tsx

import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionState, SimulationPluriannuelle } from "@/types"
import { emptyReport, emptySession } from "@/ui/testing/fixtures"
import { DELAI_DU_CALCUL } from "./useCalculDiffere"
import { useSimulationDesAnnees } from "./useSimulationDesAnnees"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Deux années simulées : 2025 réussie, 2026 en erreur. */
const SIMULATION: SimulationPluriannuelle = {
  annees: [
    { annee: 2025, report: { ...emptyReport(), annee: 2025, totalNetApresImpots: 1000 }, erreur: null },
    { annee: 2026, report: null, erreur: "Règles de 2026 introuvables." }
  ]
}

async function calculer() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(DELAI_DU_CALCUL)
  })
}

function monter(session: SessionState, annee: number) {
  return renderHook(({ annee: anneeAffichee }: { annee: number }) => useSimulationDesAnnees(session, anneeAffichee), { initialProps: { annee } })
}

describe("useSimulationDesAnnees", () => {
  it("simule toutes les années de la session, peu après, et donne le rapport de l'année affichée", async () => {
    vi.mocked(window.api.simulerLesAnnees).mockResolvedValue(SIMULATION)
    const session = emptySession()
    const { result } = monter(session, 2025)
    expect(result.current.report).toBeNull()

    await calculer()
    expect(window.api.simulerLesAnnees).toHaveBeenCalledWith(session)
    expect(result.current.simulation).toBe(SIMULATION)
    expect(result.current.report?.totalNetApresImpots).toBe(1000)
    expect(result.current.erreurDeLAnnee).toBeNull()
  })

  it("donne l'erreur propre à l'année affichée, sans recalculer quand on change d'année", async () => {
    vi.mocked(window.api.simulerLesAnnees).mockResolvedValue(SIMULATION)
    const { result, rerender } = monter(emptySession(), 2025)
    await calculer()
    rerender({ annee: 2026 })

    expect(result.current.report).toBeNull()
    expect(result.current.erreurDeLAnnee).toBe("Règles de 2026 introuvables.")
    expect(window.api.simulerLesAnnees).toHaveBeenCalledTimes(1)
  })

  it("une simulation qui échoue en entier donne son erreur à chaque année, sans garder de résultats périmés", async () => {
    vi.mocked(window.api.simulerLesAnnees).mockRejectedValue(new Error("Session illisible."))
    const { result } = monter(emptySession(), 2025)
    await calculer()

    expect(result.current.simulation).toBeNull()
    expect(result.current.simulationError).toBe("Session illisible.")
    expect(result.current.erreurDeLAnnee).toBe("Session illisible.")
  })
})
