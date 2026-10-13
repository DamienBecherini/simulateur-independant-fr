// src/ui/components/BarreDOutils.test.tsx
// La barre d'outils seule : chaque bouton appelle son action, annuler et rétablir suivent l'historique, et les deux
// fenêtres qu'elle porte (avis, situations types depuis « Plus d'actions ») rendent le focus au bouton qui les a ouvertes.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionState } from "@/types"
import { emptySession, makePerson } from "@/ui/testing/fixtures"
import { BarreDOutils } from "./BarreDOutils"

beforeEach(() => window.history.replaceState(null, "", "/"))

function afficher({ peutAnnuler = true, peutRetablir = false } = {}) {
  const session: SessionState = { ...emptySession(), name: "Ma simulation", entities: [makePerson()] }
  const rappels = {
    historique: { annuler: vi.fn(), retablir: vi.fn(), peutAnnuler, peutRetablir },
    chargement: { onChargerUnMontage: vi.fn(), onChargerUneSession: vi.fn(), confirmationNecessaire: false },
    onAffichage: vi.fn(),
    zoom: { zoom: 1, zoomIn: vi.fn(), zoomOut: vi.fn(), canZoomIn: true, canZoomOut: false },
    onParametres: vi.fn(),
    onExporter: vi.fn()
  }
  render(<BarreDOutils session={session} affichage="classique" {...rappels} />)
  return { user: userEvent.setup(), ...rappels }
}

const barre = () => screen.getByRole("navigation", { name: "Barre d'outils" })
const bouton = (nom: string) => within(barre()).getByRole("button", { name: nom })

describe("BarreDOutils", () => {
  it("chaque bouton appelle son action : paramètres, annuler, export, zoom", async () => {
    const { user, historique, onParametres, onExporter, zoom } = afficher()
    await user.click(bouton("Paramètres"))
    await user.click(bouton("Annuler"))
    await user.click(bouton("Exporter"))
    await user.click(bouton("Zoom avant"))

    expect(onParametres).toHaveBeenCalledTimes(1)
    expect(historique.annuler).toHaveBeenCalledTimes(1)
    expect(onExporter).toHaveBeenCalledTimes(1)
    expect(zoom.zoomIn).toHaveBeenCalledTimes(1)
  })

  it("désactive ce que l'historique ou le zoom ne permettent pas", () => {
    afficher({ peutAnnuler: false, peutRetablir: false })
    expect(bouton("Annuler")).toBeDisabled()
    expect(bouton("Rétablir")).toBeDisabled()
    expect(bouton("Zoom arrière")).toBeDisabled()
    expect(bouton("Zoom avant")).toBeEnabled()
  })

  it("ouvre la fenêtre d'avis, et rend le focus à son bouton à la fermeture", async () => {
    const { user } = afficher()
    await user.click(bouton("Donner mon avis"))
    expect(screen.getByRole("dialog", { name: "Donner mon avis" })).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(bouton("Donner mon avis")).toHaveFocus()
  })

  it("ouvre la fenêtre d'avis depuis son adresse, au chargement de la page", () => {
    window.history.replaceState(null, "", "/#donner-mon-avis")
    afficher()
    expect(screen.getByRole("dialog", { name: "Donner mon avis" })).toBeInTheDocument()
  })

  it("ouvre les situations types depuis « Plus d'actions », et rend le focus au menu à la fermeture", async () => {
    const { user } = afficher()
    await user.click(bouton("Plus d'actions"))
    await user.click(screen.getByRole("menuitem", { name: "Partir d'une situation type" }))
    expect(screen.getByRole("dialog", { name: "Partir d'une situation type" })).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(bouton("Plus d'actions")).toHaveFocus()
  })
})
