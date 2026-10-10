// src/web/plateforme-web.test.tsx
// La plateforme de la démo web, telle que l'interface la reçoit de src/web/main.tsx : le bouton « Utiliser avec une IA
// (MCP) » des paramètres renvoie vers l'application de bureau, le bouton d'installation est fourni, et le diagnostic
// d'un avis dit « démo web ».

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { BoutonUtiliserAvecUneIA, CE_QUE_PERMET_L_IA } from "@/ui/components/UtiliserAvecUneIA"
import { PLATEFORME_DE_BUREAU, PlateformeContext } from "@/ui/plateforme"
import { BoutonInstaller } from "./AideALInstallation"
import { BandeauDemo } from "./BandeauDemo"
import { PLATEFORME_WEB } from "./plateforme-web"

const matchMediaDOrigine = window.matchMedia
afterEach(() => {
  window.matchMedia = matchMediaDOrigine
})

describe("plateforme de la démo web", () => {
  it("fournit le bandeau et le bouton d'installation, que l'application de bureau n'a pas", () => {
    expect(PLATEFORME_WEB).toMatchObject({ web: true, Bandeau: BandeauDemo, BoutonInstaller })
    expect(PLATEFORME_DE_BUREAU).toEqual({ web: false, installee: expect.any(Function) })
    expect(PLATEFORME_DE_BUREAU.installee()).toBe(false)
  })

  it("dit la démo installée quand elle s'ouvre dans sa propre fenêtre", () => {
    window.matchMedia = (media: string) => ({ matches: media === "(display-mode: standalone)", media }) as MediaQueryList
    expect(PLATEFORME_WEB.installee()).toBe(true)
    window.matchMedia = (media: string) => ({ matches: false, media }) as MediaQueryList
    expect(PLATEFORME_WEB.installee()).toBe(false)
  })

  it("« Utiliser avec une IA » explique ce que cela permet, et renvoie vers l'application de bureau, seule à le faire", async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <PlateformeContext value={PLATEFORME_WEB}>
        <BoutonUtiliserAvecUneIA />
      </PlateformeContext>
    )
    await user.click(screen.getByRole("button", { name: "Utiliser avec une IA (MCP)" }))
    expect(window.api.infosDuServeurMcp).not.toHaveBeenCalled()

    const fenetre = screen.getByRole("dialog", { name: "Utiliser avec une IA (MCP)" })
    expect(fenetre).toHaveTextContent(CE_QUE_PERMET_L_IA)
    expect(within(fenetre).getByRole("note")).toHaveTextContent("Seulement dans l'application de bureau : le client d'IA y lance un petit programme du simulateur, sur votre ordinateur, et un navigateur ne peut pas démarrer de programme.")
    expect(within(fenetre).getByRole("link", { name: /Télécharger l'application/ })).toHaveAttribute("href", "https://github.com/DamienBecherini/simulateur-independant-fr/releases/latest")
    expect(within(fenetre).getByRole("link", { name: /Guide d'installation/ })).toHaveAttribute("href", "https://github.com/DamienBecherini/simulateur-independant-fr/blob/main/documentation/installation.md")
    expect(fenetre).toHaveTextContent("Bientôt sur le Microsoft Store.")
    expect(within(fenetre).queryByLabelText("Configuration à copier")).not.toBeInTheDocument()
  })
})
