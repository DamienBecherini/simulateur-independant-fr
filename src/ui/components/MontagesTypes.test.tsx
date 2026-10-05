// src/ui/components/MontagesTypes.test.tsx
// Fenêtre des montages types : liste en cartes, détail, chargement direct ou après confirmation, retour du focus.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { MONTAGES_TYPES } from "@/lib/montages/montages"
import { BoutonDesMontages } from "./MontagesTypes"

function ouvrir(confirmationNecessaire = false) {
  const onCharger = vi.fn()
  const user = userEvent.setup({ delay: null })
  render(<BoutonDesMontages onCharger={onCharger} confirmationNecessaire={confirmationNecessaire} nomDeLaSession="Ma simulation" />)
  return { user, onCharger, ouvrirLaFenetre: () => user.click(screen.getByRole("button", { name: "Partir d'un montage type..." })) }
}

const fenetre = () => screen.getByRole("dialog", { name: "Partir d'un montage type" })

describe("Fenêtre des montages types", () => {
  it("liste chaque montage en carte : titre, résumé et mots-clés", async () => {
    const { ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()

    const cartes = within(within(fenetre()).getByRole("list", { name: "Montages types" })).getAllByRole("listitem").filter(item => item.querySelector("h3"))
    expect(cartes).toHaveLength(MONTAGES_TYPES.length)
    const sasu = within(fenetre()).getByRole("heading", { name: "SASU sans salaire, tout en dividendes" }).closest("li")!
    expect(sasu).toHaveTextContent("Thomas préside seul une SASU")
    expect(within(within(sasu).getByRole("list", { name: "Mots-clés" })).getAllByRole("listitem").map(li => li.textContent)).toEqual(["SASU", "Dividendes", "Retraite"])
  })

  it("montre le détail d'un montage, ses sources dans une nouvelle fenêtre, puis revient à la liste avec le focus sur sa carte", async () => {
    const { user, ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()

    await user.click(screen.getByRole("button", { name: "Détails du montage « Couple en union libre, puis marié ou pacsé »" }))
    const detail = screen.getByRole("dialog", { name: "Couple en union libre, puis marié ou pacsé" })
    for (const rubrique of ["Questions auxquelles il répond", "Ce que ce montage illustre", "Conditions", "Points d'attention et risques", "Sources officielles"]) {
      expect(within(detail).getByRole("heading", { name: rubrique })).toBeInTheDocument()
    }
    const source = within(detail).getByRole("link", { name: /Déclaration de revenus d'un couple en union libre/ })
    expect(source).toHaveAttribute("href", "https://www.service-public.gouv.fr/particuliers/vosdroits/F362")
    expect(source).toHaveAttribute("target", "_blank")
    expect(within(detail).getByRole("button", { name: "Tous les montages" })).toHaveFocus()

    await user.click(within(detail).getByRole("button", { name: "Retour" }))
    expect(screen.getByRole("button", { name: "Détails du montage « Couple en union libre, puis marié ou pacsé »" })).toHaveFocus()
  })

  it("charge le montage depuis son détail et ferme la fenêtre, sans confirmation quand rien n'est perdu", async () => {
    const { user, onCharger, ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()

    await user.click(screen.getByRole("button", { name: "Détails du montage « SASU sans salaire, tout en dividendes »" }))
    await user.click(screen.getByRole("button", { name: "Charger ce montage" }))

    expect(onCharger).toHaveBeenCalledWith(MONTAGES_TYPES.find(m => m.id === "sasu-sans-salaire"))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("demande confirmation avant de remplacer une simulation non enregistrée ; « Annuler » ne charge rien", async () => {
    const { user, onCharger, ouvrirLaFenetre } = ouvrir(true)
    await ouvrirLaFenetre()

    await user.click(screen.getByRole("button", { name: "Charger le montage « Micro-entreprise seule (BNC) »" }))
    const confirmation = screen.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })
    expect(confirmation).toHaveTextContent("« Ma simulation » n'est pas enregistrée dans une sauvegarde. Le montage « Micro-entreprise seule (BNC) » la remplacera")

    await user.click(within(confirmation).getByRole("button", { name: "Annuler" }))
    expect(onCharger).not.toHaveBeenCalled()
    expect(fenetre()).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Charger le montage « Micro-entreprise seule (BNC) »" })).toHaveFocus()

    await user.click(screen.getByRole("button", { name: "Charger le montage « Micro-entreprise seule (BNC) »" }))
    await user.click(screen.getByRole("button", { name: "Remplacer" }))
    expect(onCharger).toHaveBeenCalledWith(MONTAGES_TYPES[0])
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("se ferme à la touche Échap, puis se rouvre sur la liste", async () => {
    const { user, ouvrirLaFenetre } = ouvrir()
    await ouvrirLaFenetre()
    await user.click(screen.getByRole("button", { name: "Détails du montage « Conjoint salarié de la SASU »" }))

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await ouvrirLaFenetre()
    expect(fenetre()).toBeInTheDocument()
  })
})
