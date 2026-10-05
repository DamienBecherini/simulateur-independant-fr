// src/ui/components/ChampsFrais.test.tsx
// Fenêtre de réglages d'un acteur : frais réels d'une personne, déplacements professionnels d'une activité.

import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Entity } from "@/types"
import { makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import EditEntityModal from "./EditEntityModal"

function ouvrir(entity: Entity) {
  const onSave = vi.fn()
  render(<EditEntityModal entity={entity} isOpen onClose={() => {}} onSave={onSave} allEntities={[entity]} relationships={[]} />)
  return { onSave, user: userEvent.setup() }
}

/** Remplace la valeur d'un champ numérique. */
async function saisir(user: ReturnType<typeof userEvent.setup>, label: string, valeur: string) {
  const champ = screen.getByLabelText(label)
  await user.clear(champ)
  await user.type(champ, valeur)
}

describe("frais réels d'une personne", () => {
  it("se déclarent dans la fenêtre de réglages et sont enregistrés avec la personne", async () => {
    const { onSave, user } = ouvrir(makePerson())
    expect(screen.queryByLabelText("Jours travaillés par an")).not.toBeInTheDocument()

    await user.click(screen.getByRole("switch", { name: "Comparer mes frais réels à la déduction de 10 %" }))
    await saisir(user, "Trajet (km, aller simple)", "45")
    await saisir(user, "Jours travaillés par an", "210")
    await user.click(screen.getByRole("combobox", { name: "Puissance fiscale" }))
    await user.click(await screen.findByRole("option", { name: "7 CV et plus" }))
    await user.click(screen.getByRole("switch", { name: "Voiture électrique (+ 20 %)" }))
    await user.click(screen.getByRole("switch", { name: "Distance justifiée au-delà de 40 km" }))
    await saisir(user, "Autres frais réels (€ par an)", "300")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    expect(onSave.mock.calls[0][0].fraisReels).toEqual({ kmParTrajet: 45, joursTravailles: 210, puissanceFiscale: "7", electrique: true, distanceJustifiee: true, autresFrais: 300 })
  })

  it("ne garde pas de nombre négatif ni plus de 366 jours, et se retirent en désactivant l'interrupteur", async () => {
    const { onSave, user } = ouvrir(makePerson({ fraisReels: { kmParTrajet: 20, joursTravailles: 218, puissanceFiscale: "5", electrique: false, distanceJustifiee: false, autresFrais: 0 } }))

    await saisir(user, "Jours travaillés par an", "400")
    expect(screen.getByLabelText("Jours travaillés par an")).toHaveValue(366)
    fireEvent.change(screen.getByLabelText("Trajet (km, aller simple)"), { target: { value: "-3" } })
    expect(screen.getByLabelText("Trajet (km, aller simple)")).toHaveValue(0)
    await saisir(user, "Trajet (km, aller simple)", "12.5")
    expect(screen.getByLabelText("Trajet (km, aller simple)")).toHaveValue(12.5)

    await user.click(screen.getByRole("switch", { name: "Comparer mes frais réels à la déduction de 10 %" }))
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0].fraisReels).toBeUndefined()
  })
})

describe("déplacements professionnels d'une activité", () => {
  it("se déclarent pour une société, en charge déductible", async () => {
    const { onSave, user } = ouvrir(makeCompany())
    expect(screen.getByText(/Indemnités kilométriques remboursées au dirigeant/)).toBeInTheDocument()

    await user.click(screen.getByRole("switch", { name: "Déplacements avec une voiture personnelle" }))
    await saisir(user, "Kilomètres professionnels par an", "8720")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    expect(onSave.mock.calls[0][0].deplacementsProfessionnels).toEqual({ kmParAn: 8720, puissanceFiscale: "5", electrique: false })
  })

  it("expliquent ce qu'ils deviennent en micro-entreprise et en entreprise individuelle", () => {
    ouvrir(makeMicro({ deplacementsProfessionnels: { kmParAn: 5000, puissanceFiscale: "4", electrique: true } }))
    expect(screen.getByText(/jamais déductibles/)).toBeInTheDocument()
    expect(screen.getByLabelText("Kilomètres professionnels par an")).toHaveValue(5000)
    expect(screen.getByRole("switch", { name: "Voiture électrique (+ 20 %)" })).toBeChecked()
  })

  it("expliquent l'option du barème en entreprise individuelle", () => {
    ouvrir(makeCompany({ legalStatus: "EI" }))
    expect(screen.getByText(/option du barème des BNC/)).toBeInTheDocument()
  })
})
