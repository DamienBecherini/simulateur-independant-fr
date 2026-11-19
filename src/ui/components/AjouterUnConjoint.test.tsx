// src/ui/components/AjouterUnConjoint.test.tsx

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { BoutonAjouterUnConjoint, type AjoutDuConjoint } from "./AjouterUnConjoint"

function afficher() {
  const ajout: AjoutDuConjoint = { personnes: new Set(["p-sophie"]), annee: 2026, ajouter: vi.fn() }
  const user = userEvent.setup({ delay: null })
  render(<BoutonAjouterUnConjoint personneId="p-sophie" nomDeLaPersonne="Sophie" ajout={ajout} />)
  return { user, ajouter: vi.mocked(ajout.ajouter) }
}

describe("Ajouter un conjoint", () => {
  it("demande le prénom, le lien et le salaire net mensuel, puis ajoute au foyer", async () => {
    const { user, ajouter } = afficher()
    await user.click(screen.getByRole("button", { name: "Ajouter un conjoint" }))
    const fenetre = screen.getByRole("dialog", { name: "Ajouter le conjoint de Sophie" })
    expect(fenetre).toHaveTextContent("un seul foyer fiscal")
    expect(screen.getByRole("radio", { name: "Marié(e)" })).toBeChecked()

    await user.type(screen.getByRole("textbox", { name: "Prénom" }), "Nadia")
    await user.click(screen.getByRole("radio", { name: "Pacsé(e)" }))
    await user.type(screen.getByRole("spinbutton", { name: "Son salaire net par mois (€), facultatif" }), "2500")
    expect(screen.getByRole("spinbutton", { name: "Son salaire net par mois (€), facultatif" })).toHaveAccessibleDescription(/chaque mois de 2026/)
    await user.click(screen.getByRole("button", { name: "Ajouter au foyer" }))

    expect(ajouter).toHaveBeenCalledExactlyOnceWith("p-sophie", { prenom: "Nadia", lien: "PACSé(e)", salaireMensuel: 2500 })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("sans salaire ni prénom : 0 €, le prénom par défaut étant donné par l'ajout", async () => {
    const { user, ajouter } = afficher()
    await user.click(screen.getByRole("button", { name: "Ajouter un conjoint" }))
    await user.click(screen.getByRole("button", { name: "Ajouter au foyer" }))
    expect(ajouter).toHaveBeenCalledExactlyOnceWith("p-sophie", { prenom: "", lien: "Marié(e)", salaireMensuel: 0 })
  })

  it("un salaire négatif ne s'ajoute pas", async () => {
    const { user, ajouter } = afficher()
    await user.click(screen.getByRole("button", { name: "Ajouter un conjoint" }))
    await user.type(screen.getByRole("spinbutton", { name: "Son salaire net par mois (€), facultatif" }), "-5")
    expect(screen.getByRole("button", { name: "Ajouter au foyer" })).toBeDisabled()
    expect(ajouter).not.toHaveBeenCalled()
  })

  it("« Annuler » ferme sans rien ajouter, et la fenêtre repart vide à la réouverture", async () => {
    const { user, ajouter } = afficher()
    await user.click(screen.getByRole("button", { name: "Ajouter un conjoint" }))
    await user.type(screen.getByRole("textbox", { name: "Prénom" }), "Nadia")
    await user.click(screen.getByRole("button", { name: "Annuler" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(ajouter).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Ajouter un conjoint" }))
    expect(screen.getByRole("textbox", { name: "Prénom" })).toHaveValue("")
  })
})
