// src/ui/components/MentionsLegales.test.tsx

import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ADRESSE_E_MAIL_DES_RETOURS, DEPOT_GITHUB } from "@/lib/adresses-des-retours"
import { RUBRIQUES, TITRE_DES_MENTIONS_LEGALES } from "@/lib/mentions-legales"
import { emptySession } from "@/ui/testing/fixtures"
import Footer from "./Footer"
import { MentionsLegalesParLAdresse } from "./MentionsLegales"
import { SettingsSheet } from "./SettingsSheet"

const NOM = TITRE_DES_MENTIONS_LEGALES

afterEach(() => window.history.replaceState(null, "", "/"))

function Parametres() {
  const rien = () => {}
  return (
    <SettingsSheet
      isOpen
      onOpenChange={rien}
      allSaveSlots={[]}
      setAllSaveSlots={rien}
      currentSession={emptySession()}
      setCurrentSession={rien}
      slotOrder={[]}
      setSlotOrder={rien}
      onReset={rien}
      onLoadSlot={rien}
      onImport={async () => {}}
      onLoadMontage={rien}
      importConfirmation={null}
      onConfirmImport={rien}
      onCancelImport={rien}
      loadedSlotId={null}
      setLoadedSlotId={rien}
    />
  )
}

/** Simule un changement d'adresse de la page, comme un lien ou la barre d'adresse. */
function allerA(fragment: string) {
  const ancienne = window.location.href
  window.history.pushState(null, "", fragment)
  act(() => window.dispatchEvent(new HashChangeEvent("hashchange", { oldURL: ancienne, newURL: window.location.href })))
}

describe("mentions légales et confidentialité", () => {
  it("s'ouvrent depuis le pied de page, titre en tête, et rendent le focus au bouton", async () => {
    const user = userEvent.setup()
    render(<Footer />)
    const bouton = screen.getByRole("button", { name: NOM })
    await user.click(bouton)

    const fenetre = screen.getByRole("dialog", { name: NOM })
    expect(screen.getByRole("heading", { level: 2, name: NOM })).toHaveFocus()
    expect(within(fenetre).getAllByRole("heading", { level: 3 }).map(titre => titre.textContent)).toEqual(RUBRIQUES.map(r => r.titre))

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(bouton).toHaveFocus()
  })

  it("s'ouvrent depuis les paramètres, par-dessus le panneau, qui reste ouvert", async () => {
    const user = userEvent.setup()
    render(<Parametres />)
    const bouton = screen.getByRole("button", { name: NOM })
    await user.click(bouton)
    expect(screen.getByRole("dialog", { name: NOM })).toBeInTheDocument()

    await user.click(within(screen.getByRole("dialog", { name: NOM })).getByRole("button", { name: "Fermer" }))
    expect(screen.queryByRole("dialog", { name: NOM })).not.toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Configuration" })).toBeInTheDocument()
    expect(bouton).toHaveFocus()
  })

  it("signalent les liens externes et confient l'e-mail de contact à l'application", async () => {
    const user = userEvent.setup()
    render(<Footer />)
    await user.click(screen.getByRole("button", { name: NOM }))
    const fenetre = screen.getByRole("dialog", { name: NOM })

    const depot = within(fenetre).getByRole("link", { name: /^le dépôt GitHub du projet\s*\(nouvelle fenêtre\)$/ })
    expect(depot).toHaveAttribute("href", DEPOT_GITHUB)
    expect(depot).toHaveAttribute("target", "_blank")
    expect(within(fenetre).getByRole("link", { name: /^CNIL \(cnil\.fr\)\s*\(nouvelle fenêtre\)$/ })).toHaveAttribute("href", "https://www.cnil.fr")

    const [contact] = within(fenetre).getAllByRole("link", { name: ADRESSE_E_MAIL_DES_RETOURS })
    expect(contact).not.toHaveAttribute("target")
    await user.click(contact)
    expect(window.api.ouvrirAdresseExterne).toHaveBeenCalledWith(`mailto:${ADRESSE_E_MAIL_DES_RETOURS}`)
  })

  it("s'ouvrent par leur adresse au chargement, et l'effacent à la fermeture", async () => {
    window.history.replaceState(null, "", "/?demo#mentions-legales")
    const user = userEvent.setup()
    render(<MentionsLegalesParLAdresse />)
    expect(screen.getByRole("dialog", { name: NOM })).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(window.location.hash).toBe("")
    expect(window.location.search).toBe("?demo")
  })

  it("s'ouvrent quand l'adresse change, et rendent ensuite l'adresse de la vue", async () => {
    window.history.replaceState(null, "", "/#resultats")
    const user = userEvent.setup()
    render(<MentionsLegalesParLAdresse />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    allerA("#mentions-legales")
    expect(screen.getByRole("dialog", { name: NOM })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Fermer" }))
    expect(window.location.hash).toBe("#resultats")
  })

  it("se ferment au retour arrière, sans toucher à l'adresse", () => {
    const replaceState = vi.spyOn(window.history, "replaceState")
    render(<MentionsLegalesParLAdresse />)
    allerA("#mentions-legales")
    allerA("#mentions-legales")
    expect(screen.getByRole("dialog", { name: NOM })).toBeInTheDocument()

    allerA("#comparer")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(replaceState).not.toHaveBeenCalled()
    replaceState.mockRestore()
  })
})
