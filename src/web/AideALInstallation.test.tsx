// src/web/AideALInstallation.test.tsx
// Aide à l'installation de la démo web : la ligne du bandeau et le bouton des paramètres, la fenêtre selon le
// navigateur (Edge ou Chrome, avec ou sans invitation à installer ; Firefox, Safari), et rien une fois installée.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0"
const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0"

/** Le module de l'installation garde l'invitation du navigateur : il est rechargé à chaque test, avec l'aide. */
async function charger(userAgent: string) {
  vi.resetModules()
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent)
  const stockage = await import("./stockage-navigateur")
  vi.spyOn(stockage, "demanderUnStockagePersistant").mockResolvedValue(true)
  const cible = new EventTarget()
  ;(await import("./pwa/installation")).suivreLInstallation(cible)
  return { ...(await import("./AideALInstallation")), cible }
}

/** L'événement `beforeinstallprompt` imité, avec la réponse de l'utilisateur. */
function invitation(reponse: "accepted" | "dismissed") {
  return Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt: vi.fn(async () => undefined), userChoice: Promise.resolve({ outcome: reponse }) })
}

const utilisateur = () => userEvent.setup({ delay: null })

beforeEach(() => {
  window.matchMedia = (media: string) => ({ matches: false, media }) as MediaQueryList
})

describe("aide à l'installation de la démo", () => {
  it("le bandeau invite à installer, sans fenêtre ouverte d'elle-même ; « Comment faire ? » l'ouvre et le focus revient au bouton", async () => {
    const { InvitationAInstaller } = await charger(EDGE)
    const user = utilisateur()
    render(<InvitationAInstaller />)
    expect(screen.getByText("Installer le simulateur sur votre ordinateur : il fonctionne hors ligne, sans compte.")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    const bouton = screen.getByRole("button", { name: "Comment faire ?" })
    expect(bouton).toHaveAccessibleDescription(/Installer le simulateur sur votre ordinateur/)
    await user.click(bouton)
    expect(screen.getByRole("dialog", { name: "Installer le simulateur" })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(bouton).toHaveFocus()
  })

  it("dans Edge ou Chrome, donne les avantages et les étapes à la main, en images ; sans invitation, explique l'absence d'« Installer maintenant »", async () => {
    const { BoutonInstaller } = await charger(EDGE)
    const user = utilisateur()
    render(<BoutonInstaller />)
    await user.click(screen.getByRole("button", { name: "Installer le simulateur" }))
    const fenetre = screen.getByRole("dialog", { name: "Installer le simulateur" })

    expect(within(fenetre).getAllByRole("listitem").slice(0, 3).map(avantage => avantage.textContent)).toEqual(["Une icône sur le bureau et dans le menu Démarrer, et sa propre fenêtre.", "Il fonctionne hors ligne, sans compte.", "Vos données restent sur votre ordinateur."])
    expect(within(fenetre).queryByRole("button", { name: "Installer maintenant" })).not.toBeInTheDocument()
    expect(fenetre).toHaveTextContent("Le bouton « Installer maintenant » n'apparaît que lorsque le navigateur propose l'installation")

    const aLaMain = within(fenetre).getByRole("region", { name: "Ou bien, à la main" })
    const images = within(aLaMain).getAllByRole("img")
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAccessibleName(/L'application est disponible\. Installer Simulateur indépendant FR.*cliquer/)
    expect(images[1]).toHaveAccessibleName(/Cliquez sur « Installer »\.$/)
    expect(images[1].getAttribute("alt")).not.toMatch(/localhost|Éditeur/)
    expect(aLaMain).toHaveTextContent("Caster, enregistrer et partager")
    expect(aLaMain).toHaveTextContent("Installer la page en tant qu'application")
  })

  it("avec l'invitation du navigateur, « Installer maintenant » ouvre son installation, puis le focus va sur le résultat", async () => {
    const { BoutonInstaller, cible } = await charger(EDGE)
    const user = utilisateur()
    const evenement = invitation("accepted")
    cible.dispatchEvent(evenement)
    render(<BoutonInstaller />)
    await user.click(screen.getByRole("button", { name: "Installer le simulateur" }))
    const fenetre = screen.getByRole("dialog")

    await user.click(within(fenetre).getByRole("button", { name: "Installer maintenant" }))
    expect(evenement.prompt).toHaveBeenCalledOnce()
    const resultat = within(fenetre).getByRole("status")
    expect(resultat).toHaveTextContent("Le simulateur est installé")
    expect(resultat).toHaveFocus()
    expect(within(fenetre).queryByRole("button", { name: "Installer maintenant" })).not.toBeInTheDocument()
    expect(fenetre).not.toHaveTextContent("n'apparaît que lorsque")
  })

  it("si l'installation est refusée, le dit et renvoie aux étapes à la main", async () => {
    const { BoutonInstaller, cible } = await charger(EDGE)
    const user = utilisateur()
    cible.dispatchEvent(invitation("dismissed"))
    render(<BoutonInstaller />)
    await user.click(screen.getByRole("button", { name: "Installer le simulateur" }))
    await user.click(screen.getByRole("button", { name: "Installer maintenant" }))
    expect(screen.getByRole("status")).toHaveTextContent("Installation annulée")
  })

  it("dans Firefox ou Safari, propose Edge ou Chrome, ou l'application de bureau", async () => {
    const { BoutonInstaller } = await charger(FIREFOX)
    const user = utilisateur()
    render(<BoutonInstaller />)
    await user.click(screen.getByRole("button", { name: "Installer le simulateur" }))
    const fenetre = screen.getByRole("dialog", { name: "Installer le simulateur" })
    expect(fenetre).toHaveAccessibleDescription(/n'installe pas un site comme une application/)
    expect(fenetre).toHaveTextContent("Microsoft Edge ou Google Chrome")
    expect(within(fenetre).queryByRole("img")).not.toBeInTheDocument()
    expect(within(fenetre).queryByRole("button", { name: "Installer maintenant" })).not.toBeInTheDocument()
    expect(within(fenetre).getByRole("link", { name: /Télécharger l'application/ })).toHaveAttribute("href", "https://github.com/DamienBecherini/simulateur-independant-fr/releases/latest")
    expect(within(fenetre).getByRole("link", { name: /Guide d'installation/ })).toHaveAttribute("href", "https://github.com/DamienBecherini/simulateur-independant-fr/blob/main/documentation/installation.md")
    expect(fenetre).toHaveTextContent("Bientôt sur le Microsoft Store.")
  })

  it("un navigateur qui envoie l'invitation est traité comme Edge ou Chrome, quel que soit son nom", async () => {
    const { BoutonInstaller, cible } = await charger("Navigateur inconnu")
    const user = utilisateur()
    cible.dispatchEvent(invitation("accepted"))
    render(<BoutonInstaller />)
    await user.click(screen.getByRole("button", { name: "Installer le simulateur" }))
    expect(screen.getByRole("button", { name: "Installer maintenant" })).toBeInTheDocument()
  })

  it("n'apparaît pas dans la démo installée, ni une fois installée depuis l'onglet", async () => {
    window.matchMedia = (media: string) => ({ matches: media === "(display-mode: standalone)", media }) as MediaQueryList
    const installee = await charger(EDGE)
    const { unmount } = render(
      <>
        <installee.InvitationAInstaller />
        <installee.BoutonInstaller />
      </>
    )
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByText(/Installer le simulateur/)).not.toBeInTheDocument()
    unmount()

    window.matchMedia = (media: string) => ({ matches: false, media }) as MediaQueryList
    const { InvitationAInstaller, BoutonInstaller, cible } = await charger(EDGE)
    render(
      <>
        <InvitationAInstaller />
        <BoutonInstaller />
      </>
    )
    expect(screen.getAllByRole("button")).toHaveLength(2)
    cible.dispatchEvent(new Event("appinstalled"))
    await vi.waitFor(() => expect(screen.queryByRole("button")).not.toBeInTheDocument())
  })
})
