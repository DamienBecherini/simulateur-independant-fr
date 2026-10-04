// src/ui/components/ExportDialog.test.tsx

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { SessionState, SimulationReport } from "@/types"
import { emptyReport, emptySession } from "@/ui/testing/fixtures"
import { ExportDialog } from "./ExportDialog"

/** La fenêtre telle que l'application l'affiche : ouverte, elle se referme d'elle-même après un export. */
function FenetreExporter({ session, simulationReport }: { session: SessionState; simulationReport: SimulationReport | null }) {
  const [ouverte, setOuverte] = useState(true)
  return <ExportDialog isOpen={ouverte} onClose={() => setOuverte(false)} session={session} simulationReport={simulationReport} onExportJson={vi.fn()} />
}

describe("ExportDialog", () => {
  it("propose l'export complet en JSON, puis se referme", async () => {
    const onExportJson = vi.fn()
    const onClose = vi.fn()
    render(<ExportDialog isOpen onClose={onClose} session={emptySession()} simulationReport={null} onExportJson={onExportJson} />)

    expect(screen.getByRole("dialog", { name: "Exporter" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Simulation complète \(JSON\)/ }))

    expect(onExportJson).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalled()
  })

  it("enregistre le document PDF sous le nom de la simulation, une fois la fenêtre refermée", async () => {
    // La fenêtre doit avoir disparu de la page quand le PDF est produit : on relève sa présence à cet instant.
    const fenetreAffichee: boolean[] = []
    vi.mocked(window.api.printToPdf).mockImplementation(async () => {
      fenetreAffichee.push(document.querySelector("[role='dialog']") !== null)
      return true
    })
    render(<FenetreExporter session={{ ...emptySession(), name: "Famille Martin" }} simulationReport={{ ...emptyReport(), annee: 2026 }} />)

    await userEvent.click(screen.getByRole("button", { name: /Document PDF/ }))

    await waitFor(() => expect(window.api.printToPdf).toHaveBeenCalledWith("famille-martin-2026.pdf"))
    expect(fenetreAffichee).toEqual([false])
  })

  it("date le PDF de l'année en cours tant que la simulation n'est pas calculée", async () => {
    render(<FenetreExporter session={emptySession()} simulationReport={null} />)

    await userEvent.click(screen.getByRole("button", { name: /Document PDF/ }))

    await waitFor(() => expect(window.api.printToPdf).toHaveBeenCalledWith(`nouvelle-simulation-${new Date().getFullYear()}.pdf`))
  })

  it("ne s'affiche pas fermée", () => {
    render(<ExportDialog isOpen={false} onClose={vi.fn()} session={emptySession()} simulationReport={null} onExportJson={vi.fn()} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
