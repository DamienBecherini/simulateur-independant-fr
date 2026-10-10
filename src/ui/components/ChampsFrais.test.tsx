// src/ui/components/ChampsFrais.test.tsx
// Fenêtre de réglages d'un acteur : frais réels d'une personne, déplacements professionnels d'une activité.

import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ESPACE_INSECABLE, pourcent } from "@/backend/logic/format"
import { reglesPubliees } from "@/backend/logic/regles"
import type { Entity, Trajet } from "@/types"
import { makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { ChampsFraisReels } from "./ChampsFrais"
import EditEntityModal from "./EditEntityModal"

function ouvrir(entity: Entity) {
  const onSave = vi.fn()
  render(<EditEntityModal entity={entity} isOpen onClose={() => {}} onSave={onSave} allEntities={[entity]} relationships={[]} annee={2026} />)
  return { onSave, user: userEvent.setup() }
}

/** Remplace la valeur d'un champ numérique. */
async function saisir(user: ReturnType<typeof userEvent.setup>, label: string, valeur: string) {
  const champ = screen.getByLabelText(label)
  await user.clear(champ)
  await user.type(champ, valeur)
}

const trajet20km: Trajet = { libelle: "", kmParTrajet: 20, joursTravailles: 218, puissanceFiscale: "5", electrique: false, distanceJustifiee: false }

describe("frais réels d'une personne", () => {
  it("se déclarent dans la fenêtre de réglages et sont enregistrés avec la personne", async () => {
    const { onSave, user } = ouvrir(makePerson())
    expect(screen.queryByLabelText("Jours travaillés par an")).not.toBeInTheDocument()

    await user.click(screen.getByRole("switch", { name: `Comparer mes frais réels à la déduction de 10${ESPACE_INSECABLE}%` }))
    await saisir(user, "Trajet (km, aller simple)", "45")
    await saisir(user, "Jours travaillés par an", "210")
    await user.click(screen.getByRole("combobox", { name: "Puissance fiscale" }))
    await user.click(await screen.findByRole("option", { name: "7 CV et plus" }))
    await user.click(screen.getByRole("switch", { name: `Voiture électrique (+ 20${ESPACE_INSECABLE}%)` }))
    await user.click(screen.getByRole("switch", { name: "Distance justifiée au-delà de 40 km" }))
    await saisir(user, "Autres frais réels (€ par an)", "300")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    expect(onSave.mock.calls[0][0].fraisReels).toEqual({ trajets: [{ libelle: "", kmParTrajet: 45, joursTravailles: 210, puissanceFiscale: "7", electrique: true, distanceJustifiee: true }], autresFrais: 300 })
  })

  it("ne garde pas de nombre négatif ni plus de 366 jours, et se retirent en désactivant l'interrupteur", async () => {
    const { onSave, user } = ouvrir(makePerson({ fraisReels: { trajets: [trajet20km], autresFrais: 0 } }))

    await saisir(user, "Jours travaillés par an", "400")
    expect(screen.getByLabelText("Jours travaillés par an")).toHaveValue(366)
    fireEvent.change(screen.getByLabelText("Trajet (km, aller simple)"), { target: { value: "-3" } })
    expect(screen.getByLabelText("Trajet (km, aller simple)")).toHaveValue(0)
    await saisir(user, "Trajet (km, aller simple)", "12.5")
    expect(screen.getByLabelText("Trajet (km, aller simple)")).toHaveValue(12.5)

    await user.click(screen.getByRole("switch", { name: `Comparer mes frais réels à la déduction de 10${ESPACE_INSECABLE}%` }))
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0].fraisReels).toBeUndefined()
  })

  it("se déclarent pour plusieurs lieux de travail : un trajet chacun, ajouté ou retiré", async () => {
    const { onSave, user } = ouvrir(makePerson({ fraisReels: { trajets: [{ ...trajet20km, puissanceFiscale: "3" }], autresFrais: 0 } }))

    await user.click(screen.getByRole("button", { name: "Ajouter un trajet" }))
    const second = screen.getByRole("group", { name: "Trajet 2" })
    // Le focus passe au premier champ du nouveau trajet, qui reprend la voiture du précédent.
    expect(within(second).getByLabelText("Lieu de travail ou employeur (facultatif)")).toHaveFocus()
    expect(within(second).getByRole("combobox", { name: "Puissance fiscale" })).toHaveTextContent("3 CV et moins")
    await user.keyboard("Agence de Lyon")
    expect(screen.getByRole("group", { name: "Trajet 2 : Agence de Lyon" })).toBeInTheDocument()
    const km = within(second).getByLabelText("Trajet (km, aller simple)")
    await user.clear(km)
    await user.type(km, "55")

    await user.click(screen.getByRole("button", { name: "Ajouter un trajet" }))
    await user.click(screen.getByRole("button", { name: "Retirer le trajet 1" }))
    expect(screen.getByRole("button", { name: "Ajouter un trajet" })).toHaveFocus()
    expect(screen.getAllByRole("group", { name: /^Trajet \d/ }).map(groupe => groupe.querySelector("legend")?.textContent)).toEqual(["Trajet 1 : Agence de Lyon", "Trajet 2"])

    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0].fraisReels).toEqual({
      trajets: [
        { libelle: "Agence de Lyon", kmParTrajet: 55, joursTravailles: 218, puissanceFiscale: "3", electrique: false, distanceJustifiee: false },
        { libelle: "", kmParTrajet: 0, joursTravailles: 218, puissanceFiscale: "3", electrique: false, distanceJustifiee: false }
      ],
      autresFrais: 0
    })
  })

  it("acceptent de ne garder aucun trajet, seulement d'autres frais", async () => {
    const { onSave, user } = ouvrir(makePerson({ fraisReels: { trajets: [trajet20km], autresFrais: 0 } }))

    await user.click(screen.getByRole("button", { name: "Retirer le trajet 1" }))
    expect(screen.queryByRole("group", { name: /^Trajet/ })).not.toBeInTheDocument()
    await saisir(user, "Autres frais réels (€ par an)", "1200")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    expect(onSave.mock.calls[0][0].fraisReels).toEqual({ trajets: [], autresFrais: 1200 })
  })
})

describe("taux et distances cités par les textes", () => {
  it("sont ceux des règles de l'année affichée", () => {
    const r = reglesPubliees(2026)
    ouvrir(makePerson({ fraisReels: { trajets: [trajet20km], autresFrais: 0 } }))
    expect(screen.getByRole("switch", { name: `Comparer mes frais réels à la déduction de ${pourcent(r.IR.abattementSalaires.taux)}` })).toBeChecked()
    expect(screen.getByRole("switch", { name: `Voiture électrique (+ ${pourcent(r.baremeKilometrique.majorationElectrique)})` })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: `Distance justifiée au-delà de ${r.baremeKilometrique.domicileTravail.distanceMaxParTrajet} km` })).toBeInTheDocument()
  })

  it("suivent les règles reçues, sans valeur écrite en dur", () => {
    const r = reglesPubliees(2026)
    const autres = {
      ...r,
      IR: { ...r.IR, abattementSalaires: { ...r.IR.abattementSalaires, taux: 0.12 } },
      baremeKilometrique: { ...r.baremeKilometrique, majorationElectrique: 0.25, domicileTravail: { distanceMaxParTrajet: 50 } }
    }
    render(<ChampsFraisReels personne={makePerson({ fraisReels: { trajets: [trajet20km], autresFrais: 0 } })} onChange={vi.fn()} regles={autres} />)
    expect(screen.getByRole("switch", { name: `Comparer mes frais réels à la déduction de 12${ESPACE_INSECABLE}%` })).toBeInTheDocument()
    expect(screen.getByText(/la déduction forfaitaire de 12\s% ou vos frais réels/)).toBeInTheDocument()
    expect(screen.getByText(/Au-delà de 50 km par trajet, seuls 50 km comptent/)).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: `Voiture électrique (+ 25${ESPACE_INSECABLE}%)` })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Distance justifiée au-delà de 50 km" })).toBeInTheDocument()
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
    expect(screen.getByRole("switch", { name: `Voiture électrique (+ 20${ESPACE_INSECABLE}%)` })).toBeChecked()
  })

  it("expliquent l'option du barème en entreprise individuelle", () => {
    ouvrir(makeCompany({ legalStatus: "EI" }))
    expect(screen.getByText(/option du barème des BNC/)).toBeInTheDocument()
  })
})
