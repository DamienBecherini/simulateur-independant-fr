// src/ui/components/SelecteurAnnee.test.tsx

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { SelecteurAnnee } from "./SelecteurAnnee"

function afficher(annees: number[], annee: number) {
  const actions = { onChange: vi.fn(), onAjouter: vi.fn(), onSupprimer: vi.fn() }
  render(<SelecteurAnnee annees={annees} annee={annee} premiereAnneeConnue={2024} {...actions} />)
  return actions
}

const boutonsDesAnnees = () => within(screen.getByRole("group", { name: "Année affichée" })).getAllByRole("button")

describe("SelecteurAnnee", () => {
  it("présente un bouton par année et marque l'année affichée", () => {
    afficher([2025, 2026], 2026)

    expect(boutonsDesAnnees().map(b => [b.textContent, b.getAttribute("aria-pressed")])).toEqual([
      ["2025", "false"],
      ["2026", "true"]
    ])
  })

  it("change d'année, à la souris comme au clavier", async () => {
    const { onChange } = afficher([2025, 2026], 2026)

    await userEvent.click(screen.getByRole("button", { name: "2025" }))
    expect(onChange).toHaveBeenLastCalledWith(2025)

    screen.getByRole("button", { name: "2026" }).focus()
    await userEvent.keyboard("{Enter}")
    expect(onChange).toHaveBeenLastCalledWith(2026)
  })

  it("ajoute par défaut l'année suivante, en recopiant les flux de la plus récente", async () => {
    const { onAjouter } = afficher([2025, 2026], 2025)

    await userEvent.click(screen.getByRole("button", { name: "Ajouter une année" }))
    const fenetre = screen.getByRole("dialog", { name: "Ajouter une année" })
    expect(within(fenetre).getByRole("radio", { name: "2027, après 2026" })).toBeChecked()
    expect(within(fenetre).getByRole("radio", { name: "Recopier les flux de 2026" })).toBeChecked()
    await userEvent.click(within(fenetre).getByRole("button", { name: "Ajouter 2027" }))

    expect(onAjouter).toHaveBeenCalledWith("apres", true)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("ajoute l'année précédente, avec une grille vide", async () => {
    const { onAjouter } = afficher([2025, 2026], 2026)

    await userEvent.click(screen.getByRole("button", { name: "Ajouter une année" }))
    await userEvent.click(screen.getByRole("radio", { name: "2024, avant 2025" }))
    expect(screen.getByRole("radio", { name: "Recopier les flux de 2025" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("radio", { name: "Commencer avec une grille vide" }))
    await userEvent.click(screen.getByRole("button", { name: "Ajouter 2024" }))

    expect(onAjouter).toHaveBeenCalledWith("avant", false)
  })

  it("n'ajoute pas d'année avant la première dont les règles sont connues", async () => {
    afficher([2024], 2024)

    await userEvent.click(screen.getByRole("button", { name: "Ajouter une année" }))

    expect(screen.getByRole("radio", { name: /Pas d'année avant 2024 : les règles d'avant 2024 ne sont pas connues/ })).toBeDisabled()
  })

  it("n'ajoute rien si l'on annule", async () => {
    const { onAjouter } = afficher([2026], 2026)

    await userEvent.click(screen.getByRole("button", { name: "Ajouter une année" }))
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }))

    expect(onAjouter).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("supprime l'année affichée après confirmation, si c'est une extrémité", async () => {
    const { onSupprimer } = afficher([2024, 2025, 2026], 2024)

    await userEvent.click(screen.getByRole("button", { name: "Supprimer 2024" }))
    expect(screen.getByRole("dialog", { name: "Supprimer l'année 2024 ?" })).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer 2024" }))

    expect(onSupprimer).toHaveBeenCalledWith(2024)
  })

  it("garde l'année si l'on renonce à la supprimer", async () => {
    const { onSupprimer } = afficher([2025, 2026], 2026)

    await userEvent.click(screen.getByRole("button", { name: "Supprimer 2026" }))
    await userEvent.click(screen.getByRole("button", { name: "Garder 2026" }))

    expect(onSupprimer).not.toHaveBeenCalled()
  })

  it.each([
    ["l'année du milieu", [2024, 2025, 2026], 2025],
    ["la seule année", [2026], 2026]
  ])("ne propose pas de supprimer %s", (_cas, annees, annee) => {
    afficher(annees, annee)

    expect(screen.queryByRole("button", { name: /^Supprimer/ })).not.toBeInTheDocument()
  })

  it("désactive l'ajout à dix années, en expliquant pourquoi, et laisse supprimer une extrémité", () => {
    const dix = Array.from({ length: 10 }, (_, i) => 2024 + i)
    afficher(dix, 2033)

    const ajouter = screen.getByRole("button", { name: "Ajouter une année" })
    expect(ajouter).toBeDisabled()
    expect(ajouter).toHaveAccessibleDescription(/^10 années au plus : au-delà de deux ou trois ans après les dernières règles connues, les chiffres ne sont plus qu'une projection\./)
    expect(screen.getByText(/^10 années au plus/)).toBeVisible()
    expect(screen.getByRole("button", { name: "Supprimer 2033" })).toBeEnabled()
    expect(boutonsDesAnnees()).toHaveLength(10)
  })

  it("laisse ajouter une année tant qu'il y en a moins de dix, sans explication", () => {
    afficher(Array.from({ length: 9 }, (_, i) => 2024 + i), 2032)

    expect(screen.getByRole("button", { name: "Ajouter une année" })).toBeEnabled()
    expect(screen.queryByText(/années au plus/)).not.toBeInTheDocument()
  })
})
