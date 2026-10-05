// src/ui/components/ChampDateDeCreation.test.tsx
// Fenêtre de réglages d'une activité : date de création, et dépassement des plafonds l'année d'avant la simulation.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ANNEE_PAR_DEFAUT, type Entity } from "@/types"
import { makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import EditEntityModal from "./EditEntityModal"

function ouvrir(entity: Entity) {
  const onSave = vi.fn()
  render(<EditEntityModal entity={entity} isOpen onClose={() => {}} onSave={onSave} allEntities={[entity]} relationships={[]} />)
  return { onSave, user: userEvent.setup() }
}

async function choisir(user: ReturnType<typeof userEvent.setup>, liste: string, option: string) {
  await user.click(screen.getByRole("combobox", { name: liste }))
  await user.click(await screen.findByRole("option", { name: option }))
}

describe("date de création d'une activité", () => {
  it("se règle au mois et à l'année, groupés sous un même libellé, et s'enregistre « AAAA-MM »", async () => {
    const { onSave, user } = ouvrir(makeMicro())
    expect(screen.getByRole("group", { name: "Date de création" })).toHaveAccessibleDescription(/l'ACRE \(mois couverts\)/)
    expect(screen.getByRole("combobox", { name: "Mois de création" })).toHaveTextContent("Non renseignée")

    await choisir(user, "Mois de création", "septembre")
    // Un mois choisi sans année prend l'année par défaut.
    expect(screen.getByRole("combobox", { name: "Année de création" })).toHaveTextContent(String(ANNEE_PAR_DEFAUT))
    await choisir(user, "Année de création", "2027")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    expect(onSave.mock.calls[0][0].dateDeCreation).toBe("2027-09")
  })

  it("prend janvier pour une année choisie sans mois, et s'efface avec « Non renseignée »", async () => {
    const { onSave, user } = ouvrir(makeCompany({ legalStatus: "EI" }))
    expect(screen.getByRole("group", { name: "Date de création" })).toHaveAccessibleDescription(/CFE du comparateur/)

    await choisir(user, "Année de création", "2025")
    expect(screen.getByRole("combobox", { name: "Mois de création" })).toHaveTextContent("janvier")
    await choisir(user, "Mois de création", "Non renseignée")
    expect(screen.getByRole("combobox", { name: "Année de création" })).toHaveTextContent("Non renseignée")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    expect(onSave.mock.calls[0][0].dateDeCreation).toBeUndefined()
  })

  it("reprend la date enregistrée", () => {
    ouvrir(makeMicro({ dateDeCreation: "2026-03" }))
    expect(screen.getByRole("combobox", { name: "Mois de création" })).toHaveTextContent("mars")
    expect(screen.getByRole("combobox", { name: "Année de création" })).toHaveTextContent("2026")
  })

  it("n'existe pas pour une personne", () => {
    ouvrir(makePerson())
    expect(screen.queryByRole("group", { name: "Date de création" })).not.toBeInTheDocument()
  })
})

describe("plafonds dépassés l'année d'avant la simulation", () => {
  it("se coche pour une micro-entreprise seulement", async () => {
    const { onSave, user } = ouvrir(makeMicro())
    const interrupteur = screen.getByRole("switch", { name: "Chiffre d'affaires au-delà des plafonds l'année d'avant la simulation" })
    expect(interrupteur).toHaveAccessibleDescription(/Deux années de suite au-delà des plafonds/)

    await user.click(interrupteur)
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0].horsPlafondAnneePrecedente).toBe(true)
  })

  it("n'existe pas pour une société", () => {
    ouvrir(makeCompany())
    expect(screen.queryByRole("switch", { name: /au-delà des plafonds/ })).not.toBeInTheDocument()
  })
})
