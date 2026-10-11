// src/ui/components/MenuPlusDActions.test.tsx
// Le menu « Plus d'actions » de la barre d'outils d'un téléphone : motif « bouton de menu » des WAI-ARIA, au clavier
// comme au doigt, et ce que fait chaque entrée.

import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Affichage } from "@/types"
import { oublierLeTheme } from "../hooks/useTheme"
import { MenuPlusDActions } from "./MenuPlusDActions"

afterEach(() => {
  localStorage.removeItem("theme")
  document.documentElement.classList.remove("light", "dark")
  oublierLeTheme()
})

function afficher(affichage: Affichage = "resume") {
  const rappels = { onAffichage: vi.fn(), onAvis: vi.fn(), onMontages: vi.fn() }
  render(
    <>
      <MenuPlusDActions affichage={affichage} {...rappels} />
      <button type="button">Après le menu</button>
    </>
  )
  return { user: userEvent.setup(), bouton: screen.getByRole("button", { name: "Plus d'actions" }), ...rappels }
}

const entrees = () => Array.from(screen.getByRole("menu").querySelectorAll("[role^=menuitem]"))

describe("menu « Plus d'actions »", () => {
  it("s'annonce comme un bouton de menu, fermé, puis s'ouvre au clic sur sa première entrée", async () => {
    const { user, bouton } = afficher()
    expect(bouton).toHaveAttribute("aria-haspopup", "menu")
    expect(bouton).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()

    await user.click(bouton)
    expect(bouton).toHaveAttribute("aria-expanded", "true")
    const menu = screen.getByRole("menu", { name: "Plus d'actions" })
    expect(bouton).toHaveAttribute("aria-controls", menu.id)
    expect(entrees().map(e => e.textContent)).toEqual(["Montages types", "Donner mon avis", "Résumé", "Classique", "Trois vues", "Thème sombre"])
    expect(screen.getByRole("menuitem", { name: "Montages types" })).toHaveFocus()
  })

  it("se parcourt aux flèches (en boucle), à Début et à Fin ; la flèche haut ouvre sur la dernière entrée", async () => {
    const { user, bouton } = afficher()
    bouton.focus()
    await user.keyboard("{ArrowUp}")
    expect(screen.getByRole("menuitemcheckbox", { name: "Thème sombre" })).toHaveFocus()
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("menuitem", { name: "Montages types" })).toHaveFocus()
    await user.keyboard("{ArrowUp}")
    expect(screen.getByRole("menuitemcheckbox", { name: "Thème sombre" })).toHaveFocus()
    await user.keyboard("{Home}")
    expect(screen.getByRole("menuitem", { name: "Montages types" })).toHaveFocus()
    await user.keyboard("{End}{ArrowUp}")
    expect(screen.getByRole("menuitemradio", { name: "Trois vues" })).toHaveFocus()
  })

  it("Échap le ferme et rend le focus au bouton ; Tab le ferme et passe à la suite", async () => {
    const { user, bouton } = afficher()
    await user.click(bouton)
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    expect(bouton).toHaveFocus()

    await user.keyboard("{Enter}")
    expect(screen.getByRole("menu")).toBeInTheDocument()
    await user.tab()
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Après le menu" })).toHaveFocus()
  })

  it("se ferme d'un clic hors de lui", async () => {
    const { user, bouton } = afficher()
    await user.click(bouton)
    await user.click(screen.getByRole("button", { name: "Après le menu" }))
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("ouvre l'avis et les montages en donnant son bouton, où le focus reviendra", async () => {
    const { user, bouton, onAvis, onMontages } = afficher()
    await user.click(bouton)
    await user.click(screen.getByRole("menuitem", { name: "Donner mon avis" }))
    expect(onAvis).toHaveBeenCalledWith(bouton)
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    expect(bouton).toHaveFocus()

    await user.click(bouton)
    await user.keyboard("{Enter}")
    expect(onMontages).toHaveBeenCalledWith(bouton)
  })

  it("coche l'affichage en cours et transmet le choix d'un autre", async () => {
    const { user, bouton, onAffichage } = afficher("classique")
    await user.click(bouton)
    expect(screen.getByRole("group", { name: "Affichage (bêta)" })).toBeInTheDocument()
    expect(screen.getByRole("menuitemradio", { name: "Classique" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("menuitemradio", { name: "Résumé" })).toHaveAttribute("aria-checked", "false")
    await user.click(screen.getByRole("menuitemradio", { name: "Trois vues" }))
    expect(onAffichage).toHaveBeenCalledWith("vues")
  })

  it("passe au thème sombre, et le coche", async () => {
    localStorage.setItem("theme", "light")
    const { user, bouton } = afficher()
    await user.click(bouton)
    expect(screen.getByRole("menuitemcheckbox", { name: "Thème sombre" })).toHaveAttribute("aria-checked", "false")
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Thème sombre" }))
    expect(document.documentElement).toHaveClass("dark")
    await user.click(bouton)
    expect(screen.getByRole("menuitemcheckbox", { name: "Thème sombre" })).toHaveAttribute("aria-checked", "true")
  })
})
