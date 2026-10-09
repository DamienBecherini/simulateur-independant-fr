// src/ui/components/ChampsDeLActeur.test.tsx
// Fenêtre de réglages d'une société à l'IS : capital social et réserves au début de la simulation.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Entity } from "@/types"
import { makeCompany, makeMicro } from "@/ui/testing/fixtures"
import EditEntityModal from "./EditEntityModal"

function ouvrir(entity: Entity) {
  const onSave = vi.fn()
  render(<EditEntityModal entity={entity} isOpen onClose={() => {}} onSave={onSave} allEntities={[entity]} relationships={[]} />)
  return { onSave, user: userEvent.setup() }
}

describe("réglages d'une société à l'IS", () => {
  it("une SASU a un capital social, pour sa réserve légale, et des réserves au début de la simulation", async () => {
    const { onSave, user } = ouvrir(makeCompany({ legalStatus: "SASU" }))

    expect(screen.getByText(/5 % du bénéfice vont à la réserve légale/)).toBeInTheDocument()
    expect(screen.queryByText(/supportent les cotisations sociales du gérant/)).not.toBeInTheDocument()
    const reserves = screen.getByLabelText("Réserves au début")
    expect(reserves).toHaveValue(null)

    await user.type(reserves, "12000")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    expect(onSave.mock.calls[0][0]).toMatchObject({ reservesInitiales: 12000 })
  })

  it("vider le champ retire les réserves de départ", async () => {
    const { onSave, user } = ouvrir(makeCompany({ legalStatus: "EURL", reservesInitiales: 5000 }))

    expect(screen.getByText(/Les dividendes au-delà de 10 % du capital supportent les cotisations sociales du gérant/)).toBeInTheDocument()
    await user.clear(screen.getByLabelText("Réserves au début"))
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    expect(onSave.mock.calls[0][0].reservesInitiales).toBeUndefined()
  })

  it("une entreprise individuelle n'a ni capital ni réserves", () => {
    ouvrir(makeCompany({ legalStatus: "EI" }))

    expect(screen.queryByLabelText("Capital social")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Réserves au début")).not.toBeInTheDocument()
  })
})

describe("revenu fiscal de référence d'une micro-entreprise", () => {
  it("le champ nomme les années de RFR qu'il couvre, d'après les années de la simulation", () => {
    const micro = makeMicro()
    render(<EditEntityModal entity={micro} isOpen onClose={() => {}} onSave={vi.fn()} allEntities={[micro]} relationships={[]} anneesSimulees={[2024, 2025, 2026]} />)
    const champ = screen.getByLabelText("RFR 2022 et 2023")
    expect(champ).toHaveAccessibleDescription(/avis d'imposition reçus en 2023 et 2024 : il décide de l'accès au versement libératoire en 2024 et 2025. .* Pour 2026, la simulation utilise le revenu fiscal de référence qu'elle calcule elle-même./)
  })
})
