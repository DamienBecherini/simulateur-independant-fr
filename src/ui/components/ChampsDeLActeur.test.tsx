// src/ui/components/ChampsDeLActeur.test.tsx
// Fenêtre de réglages d'une société à l'IS : capital social et réserves au début de la simulation.

import { fireEvent, render, screen } from "@testing-library/react"
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

  it("le capital, les réserves et le revenu fiscal de référence s'enregistrent à l'euro près, sans pas imposé", async () => {
    // Avec un pas de 100, le navigateur refusait d'enregistrer un capital de 1 €, ou un montant lu sur un avis d'impôt.
    const { onSave, user } = ouvrir(makeCompany({ legalStatus: "SASU" }))
    const capital = screen.getByLabelText<HTMLInputElement>("Capital social")
    const reserves = screen.getByLabelText<HTMLInputElement>("Réserves au début")
    await user.clear(capital)
    await user.type(capital, "1")
    await user.type(reserves, "12345")

    expect([capital.validity.valid, reserves.validity.valid]).toEqual([true, true])
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0]).toMatchObject({ capitalSocial: 1, reservesInitiales: 12345 })
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
    const minimum = plafondMinimalDeLAnnee(2025, reglesPubliees(2025))

    expect(minimum).toBe(4637)
    expect(champ).toHaveValue(null)
    expect(champ).toHaveAccessibleDescription(new RegExp(`« Plafond pour les cotisations versées en 2025 » de l'avis d'impôt reçu en 2025\\. Vide : le minimum légal est retenu \\(4\\s637\\s€\\)\\. Les années suivantes, il est calculé sur les revenus de l'année précédente\\.`))
  })

  it("enregistre le plafond saisi, à l'euro près : un montant d'avis d'impôt n'est pas un multiple de 100", async () => {
    const { onSave, user } = ouvrirLaPersonne(makePerson(), [2026])
    const champ = screen.getByLabelText<HTMLInputElement>("Plafond épargne retraite 2026")
    await user.type(champ, "13906")

    // Le navigateur refuse d'envoyer un formulaire dont un champ ne respecte pas son pas : aucun pas n'est imposé.
    expect(champ.validity.valid).toBe(true)
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    // L'année du plafond s'enregistre avec lui : il ne glissera pas si la simulation gagne une année avant 2026.
    expect(onSave.mock.calls[0][0]).toMatchObject({ plafondEpargneRetraite: 13906, anneeDuPlafondEpargneRetraite: 2026 })
  })

  it("vider le champ retire le plafond et son année : le minimum légal s'applique de nouveau", async () => {
    const { onSave, user } = ouvrirLaPersonne(makePerson({ plafondEpargneRetraite: 9000, anneeDuPlafondEpargneRetraite: 2026 }), [2026])
    const champ = screen.getByLabelText("Plafond épargne retraite 2026")
    expect(champ).toHaveValue(9000)

    await user.clear(champ)
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0].plafondEpargneRetraite).toBeUndefined()
    expect(onSave.mock.calls[0][0].anneeDuPlafondEpargneRetraite).toBeUndefined()
  })

  it("garde l'année du plafond quand une année est ajoutée avant elle, le dit, et la garde quand le montant est corrigé", async () => {
    const { onSave, user } = ouvrirLaPersonne(makePerson({ plafondEpargneRetraite: 9000, anneeDuPlafondEpargneRetraite: 2026 }), [2025, 2026])
    const champ = screen.getByLabelText("Plafond épargne retraite 2026")

    expect(champ).toHaveAccessibleDescription(/En 2025, première année de la simulation, le minimum légal est retenu\./)
    // Le montant remplacé d'un coup, sans que le champ passe par le vide.
    fireEvent.change(champ, { target: { value: "9500" } })
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0]).toMatchObject({ plafondEpargneRetraite: 9500, anneeDuPlafondEpargneRetraite: 2026 })
  })

  it("vidé, le champ nomme de nouveau la première année : un montant saisi ensuite vaut pour elle", async () => {
    const { onSave, user } = ouvrirLaPersonne(makePerson({ plafondEpargneRetraite: 9000, anneeDuPlafondEpargneRetraite: 2026 }), [2025, 2026])

    await user.clear(screen.getByLabelText("Plafond épargne retraite 2026"))
    await user.type(screen.getByLabelText("Plafond épargne retraite 2025"), "4637")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0]).toMatchObject({ plafondEpargneRetraite: 4637, anneeDuPlafondEpargneRetraite: 2025 })
  })

  it("une activité n'a pas ce champ", () => {
    ouvrir(makeMicro())
    expect(screen.queryByLabelText(/Plafond épargne retraite/)).not.toBeInTheDocument()
  })
})
