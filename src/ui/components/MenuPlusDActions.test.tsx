// src/ui/components/MenuPlusDActions.test.tsx
// Le menu « Plus d'actions » de la barre d'outils d'un téléphone : motif « bouton de menu » des WAI-ARIA, au clavier
// comme au doigt, et ce que fait chaque entrée. Il porte aussi le zoom de l'interface : dans une fenêtre étroite, la
// barre d'outils n'a plus ses boutons de zoom.

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

/** Le zoom tel que le donne `useZoom` : à 100 % dans une fenêtre qui permet 200 %, sauf mention contraire. */
const zoomA = (zoom: number, zoomMaximal = 2) => ({ zoom, zoomMaximal, canZoomIn: zoom < zoomMaximal, canZoomOut: zoom > 0.5, zoomIn: vi.fn(), zoomOut: vi.fn(), reinitialiser: vi.fn() })

function afficher(affichage: Affichage = "resume", zoom = zoomA(1)) {
  const rappels = { onAffichage: vi.fn(), onAvis: vi.fn(), onMontages: vi.fn() }
  render(
    <>
      <MenuPlusDActions affichage={affichage} zoom={zoom} {...rappels} />
      <button type="button">Après le menu</button>
    </>
  )
  return { user: userEvent.setup(), bouton: screen.getByRole("button", { name: "Plus d'actions" }), zoom, ...rappels }
}

const entrees = () => Array.from(screen.getByRole("menu").querySelectorAll("[role^=menuitem]"))

describe("menu « Plus d'actions »", () => {
  it("n'a pas d'entrée « Donner mon avis » quand l'utilisateur l'a retiré de la barre d'outils", async () => {
    render(<MenuPlusDActions affichage="resume" zoom={zoomA(1)} onAffichage={vi.fn()} onMontages={vi.fn()} />)
    await userEvent.click(screen.getByRole("button", { name: "Plus d'actions" }))
    expect(entrees().map(e => e.textContent)).toEqual(["Partir d'une situation type", "Trois vues", "Résumé", "Classique", "Agrandir", "Réduire", "Thème sombre"])
  })

  it("s'annonce comme un bouton de menu, fermé, puis s'ouvre au clic sur sa première entrée", async () => {
    const { user, bouton } = afficher()
    expect(bouton).toHaveAttribute("aria-haspopup", "menu")
    expect(bouton).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()

    await user.click(bouton)
    expect(bouton).toHaveAttribute("aria-expanded", "true")
    const menu = screen.getByRole("menu", { name: "Plus d'actions" })
    expect(bouton).toHaveAttribute("aria-controls", menu.id)
    expect(entrees().map(e => e.textContent)).toEqual(["Partir d'une situation type", "Donner mon avis", "Trois vues", "Résumé", "Classique", "Agrandir", "Réduire", "Thème sombre"])
    expect(screen.getByRole("menuitem", { name: "Partir d'une situation type" })).toHaveFocus()
  })

  it("se parcourt aux flèches (en boucle), à Début et à Fin ; la flèche haut ouvre sur la dernière entrée", async () => {
    const { user, bouton } = afficher()
    bouton.focus()
    await user.keyboard("{ArrowUp}")
    expect(screen.getByRole("menuitemcheckbox", { name: "Thème sombre" })).toHaveFocus()
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("menuitem", { name: "Partir d'une situation type" })).toHaveFocus()
    await user.keyboard("{ArrowUp}")
    expect(screen.getByRole("menuitemcheckbox", { name: "Thème sombre" })).toHaveFocus()
    await user.keyboard("{Home}")
    expect(screen.getByRole("menuitem", { name: "Partir d'une situation type" })).toHaveFocus()
    await user.keyboard("{End}{ArrowUp}")
    expect(screen.getByRole("menuitem", { name: "Réduire" })).toHaveFocus()
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

  it("agrandit et réduit l'interface, et dit son niveau ; « Revenir à 100 % » n'apparaît que sous un zoom", async () => {
    const { user, bouton, zoom } = afficher("resume", zoomA(1.5))
    await user.click(bouton)
    expect(screen.getByRole("group", { name: /^Zoom de l'interface : 150\s%$/ })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Agrandir" })).toHaveAttribute("title", expect.stringMatching(/^Agrandir l'interface\. Interface à 150\s%\. Ctrl\+0/))
    await user.click(screen.getByRole("menuitem", { name: "Agrandir" }))
    expect(zoom.zoomIn).toHaveBeenCalledOnce()
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()

    await user.click(bouton)
    await user.click(screen.getByRole("menuitem", { name: "Réduire" }))
    expect(zoom.zoomOut).toHaveBeenCalledOnce()
    await user.click(bouton)
    await user.click(screen.getByRole("menuitem", { name: "Revenir à 100 %" }))
    expect(zoom.reinitialiser).toHaveBeenCalledOnce()
  })

  it("à la butée de la fenêtre, « Agrandir » reste dans le menu, sans effet, et son info-bulle dit pourquoi", async () => {
    const { user, bouton, zoom } = afficher("resume", zoomA(1.2, 1.2))
    await user.click(bouton)
    const agrandir = screen.getByRole("menuitem", { name: "Agrandir" })
    expect(agrandir).toHaveAttribute("aria-disabled", "true")
    expect(agrandir).toHaveAttribute("title", expect.stringMatching(/le maximum pour cette largeur de fenêtre/))
    await user.click(agrandir)
    expect(zoom.zoomIn).not.toHaveBeenCalled()
    expect(screen.getByRole("menu")).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Revenir à 100 %" })).toBeInTheDocument()
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
