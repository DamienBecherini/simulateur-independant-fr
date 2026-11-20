// src/ui/components/BarreDOutils.test.tsx
// La barre d'outils seule : chaque bouton appelle son action, annuler et rétablir suivent l'historique, et les deux
// fenêtres qu'elle porte (avis, situations types depuis « Plus d'actions ») rendent le focus au bouton qui les a ouvertes.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useState } from "react"
import type { SessionState } from "@/types"
import { emptySession, makePerson } from "@/ui/testing/fixtures"
import { BarreDOutils } from "./BarreDOutils"

beforeEach(() => window.history.replaceState(null, "", "/"))

type Zoom = Parameters<typeof BarreDOutils>[0]["zoom"]

function afficher({ peutAnnuler = true, peutRetablir = false, zoom: zoomChoisi = {} as Partial<Zoom> } = {}) {
  const session: SessionState = { ...emptySession(), name: "Ma simulation", entities: [makePerson()] }
  const rappels = {
    historique: { annuler: vi.fn(), retablir: vi.fn(), peutAnnuler, peutRetablir },
    chargement: { onChargerUnMontage: vi.fn(), onChargerUneSession: vi.fn(), confirmationNecessaire: false },
    onAffichage: vi.fn(),
    zoom: { zoom: 1, zoomMaximal: 2, zoomIn: vi.fn(), zoomOut: vi.fn(), reinitialiser: vi.fn(), canZoomIn: true, canZoomOut: false, ...zoomChoisi },
    onParametres: vi.fn(),
    onExporter: vi.fn()
  }
  render(<BarreDOutils session={session} affichage="classique" {...rappels} />)
  return { user: userEvent.setup(), ...rappels }
}

/** La barre avec le réglage du bouton d'avis, tenu comme le fait l'application. */
function afficherAvecLeReglage(masqueAuDepart = false) {
  const session: SessionState = { ...emptySession(), name: "Ma simulation", entities: [makePerson()] }
  function Barre() {
    const [masque, setMasque] = useState(masqueAuDepart)
    return (
      <BarreDOutils
        session={session}
        affichage="classique"
        historique={{ annuler: vi.fn(), retablir: vi.fn(), peutAnnuler: false, peutRetablir: false }}
        chargement={{ onChargerUnMontage: vi.fn(), onChargerUneSession: vi.fn(), confirmationNecessaire: false }}
        onAffichage={vi.fn()}
        zoom={{ zoom: 1, zoomMaximal: 2, zoomIn: vi.fn(), zoomOut: vi.fn(), reinitialiser: vi.fn(), canZoomIn: true, canZoomOut: false }}
        onParametres={vi.fn()}
        onExporter={vi.fn()}
        boutonDAvis={{ masque, onMasquer: setMasque }}
      />
    )
  }
  render(<Barre />)
  return { user: userEvent.setup() }
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

  it("à 100 %, aucun niveau de zoom n'est affiché ; les infobulles des boutons le disent", () => {
    afficher({ zoom: { canZoomOut: true } })
    expect(within(barre()).queryByRole("button", { name: /Revenir à 100 %/ })).not.toBeInTheDocument()
    expect(bouton("Zoom avant")).toHaveAttribute("title", "Agrandir l'interface. Interface à 100\u00a0%.")
    expect(bouton("Zoom arrière")).toHaveAttribute("title", "Réduire l'interface. Interface à 100\u00a0%.")
  })

  it("interface agrandie : le niveau s'affiche, un clic dessus ramène à 100 %, et les infobulles rappellent Ctrl+0", async () => {
    const { user, zoom } = afficher({ zoom: { zoom: 1.5, canZoomOut: true } })
    const niveau = within(barre()).getByRole("button", { name: /^Zoom de l'interface : 150\s%\. Revenir à 100 %$/ })
    expect(niveau).toHaveTextContent(/^150\s%$/)
    expect(niveau).toHaveAttribute("title", "Revenir à 100 % (Ctrl+0)")
    expect(bouton("Zoom avant")).toHaveAttribute("title", "Agrandir l'interface. Interface à 150\u00a0%. Ctrl+0 : revenir à 100 %.")

    await user.click(niveau)
    expect(zoom.reinitialiser).toHaveBeenCalledTimes(1)
  })

  it("à la butée, l'infobulle du bouton grisé dit pourquoi : le maximum dépend de la largeur de la fenêtre", () => {
    afficher({ zoom: { zoom: 1.73, zoomMaximal: 1.73, canZoomIn: false, canZoomOut: true } })
    expect(bouton("Zoom avant")).toBeDisabled()
    expect(bouton("Zoom avant")).toHaveAttribute("title", "Interface à 173\u00a0%, le maximum pour cette largeur de fenêtre. Ctrl+0 : revenir à 100 %.")
  })

  it("au zoom le plus fort, l'infobulle du bouton grisé le dit", () => {
    afficher({ zoom: { zoom: 2, zoomMaximal: 2, canZoomIn: false, canZoomOut: true } })
    expect(bouton("Zoom avant")).toHaveAttribute("title", "Interface à 200\u00a0%, le maximum. Ctrl+0 : revenir à 100 %.")
  })

  it("au zoom le plus faible, l'infobulle du bouton grisé le dit", () => {
    afficher({ zoom: { zoom: 0.5, canZoomOut: false } })
    expect(bouton("Zoom arrière")).toHaveAttribute("title", "Interface à 50\u00a0%, le minimum. Ctrl+0 : revenir à 100 %.")
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

  it("met « Donner mon avis » en valeur, sans proposer de le retirer quand aucun réglage n'est donné", async () => {
    const { user } = afficher()
    expect(bouton("Donner mon avis")).toHaveClass("bg-blue-50", "text-blue-800")
    await user.click(bouton("Donner mon avis"))
    expect(within(screen.getByRole("dialog")).queryByRole("checkbox", { name: /Ne plus afficher/ })).not.toBeInTheDocument()
  })

  it("retire « Donner mon avis » de la barre et du menu depuis la fenêtre d'avis ; le focus va alors aux paramètres", async () => {
    const { user } = afficherAvecLeReglage()
    await user.click(bouton("Donner mon avis"))
    const caseDuBouton = within(screen.getByRole("dialog")).getByRole("checkbox", { name: "Ne plus afficher « Donner mon avis » dans la barre d'outils" })
    expect(caseDuBouton).not.toBeChecked()
    expect(caseDuBouton).toHaveAccessibleDescription(/Vous retrouverez cette fenêtre dans les Paramètres/)

    await user.click(caseDuBouton)
    expect(caseDuBouton).toBeChecked()
    // La fenêtre reste ouverte : la case se décoche aussi vite qu'elle s'est cochée.
    expect(screen.getByRole("dialog", { name: "Donner mon avis" })).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(within(barre()).queryByRole("button", { name: "Donner mon avis" })).not.toBeInTheDocument()
    await vi.waitFor(() => expect(bouton("Paramètres")).toHaveFocus())

    await user.click(bouton("Plus d'actions"))
    expect(screen.getByRole("menuitem", { name: "Partir d'une situation type" })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: "Donner mon avis" })).not.toBeInTheDocument()
  })

  it("bouton retiré : la fenêtre s'ouvre encore par son adresse, où la case le réaffiche", async () => {
    window.history.replaceState(null, "", "/#donner-mon-avis")
    const { user } = afficherAvecLeReglage(true)
    // Fenêtre ouverte, la barre est cachée aux lecteurs d'écran : on la cherche quand même.
    expect(within(screen.getByRole("navigation", { name: "Barre d'outils", hidden: true })).queryByRole("button", { name: "Donner mon avis", hidden: true })).not.toBeInTheDocument()
    const caseDuBouton = within(screen.getByRole("dialog")).getByRole("checkbox", { name: /Ne plus afficher/ })
    expect(caseDuBouton).toBeChecked()

    await user.click(caseDuBouton)
    await user.keyboard("{Escape}")
    expect(bouton("Donner mon avis")).toBeInTheDocument()
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
