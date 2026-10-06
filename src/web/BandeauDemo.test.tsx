// src/web/BandeauDemo.test.tsx
// Bandeau de la démo web : « Démo web » et l'invitation à installer dans le navigateur ; une fois installée,
// « Version web installée » et le renvoi vers l'application de bureau pour connecter une IA (MCP).

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

/** Le module de l'installation garde son état : il est rechargé à chaque test, avec le bandeau. */
async function charger() {
  vi.resetModules()
  const stockage = await import("./stockage-navigateur")
  vi.spyOn(stockage, "demanderUnStockagePersistant").mockResolvedValue(true)
  const cible = new EventTarget()
  ;(await import("./pwa/installation")).suivreLInstallation(cible)
  return { ...(await import("./BandeauDemo")), cible }
}

const affichageAutonome = (autonome: boolean) => {
  window.matchMedia = (media: string) => ({ matches: autonome && media === "(display-mode: standalone)", media }) as MediaQueryList
}

beforeEach(() => affichageAutonome(false))

describe("bandeau de la démo", () => {
  it("dans le navigateur, s'appelle « Démo web » et invite à installer", async () => {
    const { BandeauDemo } = await charger()
    render(<BandeauDemo />)
    const bandeau = screen.getByRole("complementary", { name: "Démo web" })
    expect(bandeau).toHaveTextContent("Démo web : vos simulations restent dans ce navigateur, rien n'est envoyé.")
    expect(bandeau).toHaveTextContent("Installer le simulateur sur votre ordinateur")
    expect(bandeau).not.toHaveTextContent("MCP")
  })

  it("une fois installée, devient la « Version web installée » et renvoie vers l'application de bureau pour le MCP", async () => {
    affichageAutonome(true)
    const { BandeauDemo } = await charger()
    const user = userEvent.setup({ delay: null })
    render(<BandeauDemo />)
    const bandeau = screen.getByRole("complementary", { name: "Version web installée" })
    expect(bandeau).toHaveTextContent("Version web installée : vos simulations restent sur cet ordinateur, rien n'est envoyé.")
    expect(bandeau).not.toHaveTextContent("Installer le simulateur")

    const bouton = within(bandeau).getByRole("button", { name: "En savoir plus" })
    expect(bouton).toHaveAccessibleDescription("Pour connecter une IA (Claude Desktop, LM Studio…) par MCP, il faut l'application de bureau.")
    await user.click(bouton)
    const fenetre = screen.getByRole("dialog", { name: "Utiliser avec une IA (MCP)" })
    expect(fenetre).toHaveTextContent("Seulement dans l'application de bureau")
    await user.keyboard("{Escape}")
    expect(bouton).toHaveFocus()
  })

  it("installée depuis l'onglet, change de nom aussitôt", async () => {
    const { BandeauDemo, cible } = await charger()
    render(<BandeauDemo />)
    cible.dispatchEvent(new Event("appinstalled"))
    expect(await screen.findByRole("complementary", { name: "Version web installée" })).toBeInTheDocument()
  })
})
