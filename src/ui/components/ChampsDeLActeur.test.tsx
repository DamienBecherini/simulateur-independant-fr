// src/ui/components/ChampsDeLActeur.test.tsx
// Fenêtre de réglages d'une société à l'IS : capital social et réserves au début de la simulation.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { enTexteBrut, pourcent } from "@/backend/logic/format"
import { reglesPubliees } from "@/backend/logic/regles"
import type { Entity, Person } from "@/types"
import { plafondMinimalDeLAnnee } from "@/backend/logic/epargne-retraite"
import { makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import EditEntityModal from "./EditEntityModal"

function ouvrir(entity: Entity) {
  const onSave = vi.fn()
  render(<EditEntityModal entity={entity} isOpen onClose={() => {}} onSave={onSave} allEntities={[entity]} relationships={[]} annee={2026} />)
  return { onSave, user: userEvent.setup() }
}

describe("réglages d'une société à l'IS", () => {
  it("une SASU a un capital social, pour sa réserve légale, et des réserves au début de la simulation", async () => {
    const { onSave, user } = ouvrir(makeCompany({ legalStatus: "SASU" }))

    expect(screen.getByText(/5\s% du bénéfice vont à la réserve légale/)).toBeInTheDocument()
    expect(screen.queryByText(/supportent les cotisations sociales du gérant/)).not.toBeInTheDocument()
    const reserves = screen.getByLabelText("Réserves au début")
    expect(reserves).toHaveValue(null)

    await user.type(reserves, "12000")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    expect(onSave.mock.calls[0][0]).toMatchObject({ reservesInitiales: 12000 })
  })

  it("vider le champ retire les réserves de départ", async () => {
    const { onSave, user } = ouvrir(makeCompany({ legalStatus: "EURL", reservesInitiales: 5000 }))

    expect(screen.getByText(/Les dividendes au-delà de 10\s% du capital supportent les cotisations sociales du gérant/)).toBeInTheDocument()
    await user.clear(screen.getByLabelText("Réserves au début"))
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    expect(onSave.mock.calls[0][0].reservesInitiales).toBeUndefined()
  })

  it("l'aide du capital cite la réserve légale et le seuil des dividendes d'EURL des règles de l'année", () => {
    const r = reglesPubliees(2026)
    ouvrir(makeCompany({ legalStatus: "EURL" }))
    expect(screen.getByText(enTexteBrut(`Les dividendes au-delà de ${pourcent(r.EURL.seuilDividendesPartDuCapital)} du capital supportent les cotisations sociales du gérant. ${pourcent(r.reserveLegale.partDuBenefice)} du bénéfice vont à la réserve légale, non distribuable, jusqu'à ce qu'elle atteigne ${pourcent(r.reserveLegale.plafondPartDuCapital)} du capital.`))).toBeInTheDocument()
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
    render(<EditEntityModal entity={micro} isOpen onClose={() => {}} onSave={vi.fn()} allEntities={[micro]} relationships={[]} annee={2026} anneesSimulees={[2024, 2025, 2026]} />)
    const champ = screen.getByLabelText("Revenu fiscal de référence 2022 et 2023")
    expect(champ).toHaveAccessibleDescription(/avis d'imposition reçus en 2023 et 2024 : il décide de l'accès au versement libératoire en 2024 et 2025. .* Pour 2026, la simulation utilise le revenu fiscal de référence qu'elle calcule elle-même./)
  })
})

describe("plafond d'épargne retraite d'une personne", () => {
  function ouvrirLaPersonne(personne: Person, anneesSimulees: number[]) {
    const onSave = vi.fn()
    render(<EditEntityModal entity={personne} isOpen onClose={() => {}} onSave={onSave} allEntities={[personne]} relationships={[]} annee={2026} anneesSimulees={anneesSimulees} />)
    return { onSave, user: userEvent.setup() }
  }

  it("le champ nomme la première année de la simulation, et son aide le minimum légal de cette année-là", () => {
    ouvrirLaPersonne(makePerson(), [2025, 2026])
    const champ = screen.getByLabelText("Plafond épargne retraite 2025")
    // Versements de 2025 : 10 % du plafond de la sécurité sociale de 2024, lu dans les règles de 2025.
    const minimum = plafondMinimalDeLAnnee(reglesPubliees(2025).IR.epargneRetraite)

    expect(minimum).toBe(4637)
    expect(champ).toHaveValue(null)
    expect(champ).toHaveAccessibleDescription(new RegExp(`« Plafond pour les cotisations versées en 2025 » de l'avis d'impôt reçu en 2025\\. Vide : le minimum légal est retenu \\(4\\s637\\s€\\)\\. Les années suivantes, il est calculé sur les revenus de l'année précédente\\.`))
  })

  it("enregistre le plafond saisi, et le retire quand le champ est vidé", async () => {
    const { onSave, user } = ouvrirLaPersonne(makePerson(), [2026])
    await user.type(screen.getByLabelText("Plafond épargne retraite 2026"), "12500")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0]).toMatchObject({ plafondEpargneRetraite: 12500 })
  })

  it("vider le champ retire le plafond : le minimum légal s'applique de nouveau", async () => {
    const { onSave, user } = ouvrirLaPersonne(makePerson({ plafondEpargneRetraite: 9000 }), [2026])
    const champ = screen.getByLabelText("Plafond épargne retraite 2026")
    expect(champ).toHaveValue(9000)

    await user.clear(champ)
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0].plafondEpargneRetraite).toBeUndefined()
  })

  it("une activité n'a pas ce champ", () => {
    ouvrir(makeMicro())
    expect(screen.queryByLabelText(/Plafond épargne retraite/)).not.toBeInTheDocument()
  })
})
