// src/ui/components/ExportDialog.test.tsx

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { emptySession } from "@/ui/testing/fixtures"
import { ExportDialog } from "./ExportDialog"

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

  it("ne s'affiche pas fermée", () => {
    render(<ExportDialog isOpen={false} onClose={vi.fn()} session={emptySession()} simulationReport={null} onExportJson={vi.fn()} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
