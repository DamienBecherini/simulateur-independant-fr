// src/ui/components/UtiliserAvecUneIA.test.tsx
// Section « Utiliser avec une IA (MCP) » des paramètres : dans l'application de bureau, absente sans serveur local, et
// sinon la configuration de cette installation, prête à copier. La démo web : src/web/FenetreIADeLaDemo.test.tsx.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { InfosDuServeurMcp } from "@/lib/configuration-mcp"
import { BoutonUtiliserAvecUneIA } from "./UtiliserAvecUneIA"

const infos: InfosDuServeurMcp = {
  executable: "C:\\Users\\Camille\\AppData\\Local\\Programs\\Simulateur\\Simulateur Indépendant FR.exe",
  script: "C:\\Users\\Camille\\AppData\\Local\\Programs\\Simulateur\\resources\\mcp\\serveur-mcp.mjs",
  donnees: "C:\\Users\\Camille\\AppData\\Roaming\\Simulateur Indépendant FR",
  plateforme: "win32"
}

describe("Utiliser avec une IA (MCP)", () => {
  it("n'apparaît pas sans serveur local", async () => {
    render(<BoutonUtiliserAvecUneIA />)
    await vi.waitFor(() => expect(window.api.infosDuServeurMcp).toHaveBeenCalled())
    expect(screen.queryByRole("button", { name: /Utiliser avec une IA/ })).not.toBeInTheDocument()
  })

  it("donne la configuration de cette installation, à copier", async () => {
    vi.mocked(window.api.infosDuServeurMcp).mockResolvedValue(infos)
    const ecrire = vi.fn(async () => undefined)
    const user = userEvent.setup({ delay: null })
    // Après userEvent.setup, qui installe son propre presse-papiers.
    Object.defineProperty(navigator, "clipboard", { value: { writeText: ecrire }, configurable: true })
    render(<BoutonUtiliserAvecUneIA />)

    await user.click(await screen.findByRole("button", { name: "Utiliser avec une IA (MCP)" }))
    const fenetre = screen.getByRole("dialog", { name: "Utiliser avec une IA (MCP)" })
    expect(within(fenetre).getByRole("note")).toHaveTextContent(/part chez le fournisseur de l'IA choisie.*IA locale/)
    expect(within(fenetre).getByText("%APPDATA%\\Claude\\claude_desktop_config.json")).toBeInTheDocument()

    const configuration = JSON.parse(within(fenetre).getByLabelText("Configuration à copier").textContent!)
    expect(configuration).toEqual({ mcpServers: { "simulateur-independant-fr": { command: infos.executable, args: [infos.script, "--donnees", infos.donnees], env: { ELECTRON_RUN_AS_NODE: "1" } } } })

    await user.click(within(fenetre).getByRole("button", { name: "Copier la configuration" }))
    expect(ecrire).toHaveBeenCalledWith(JSON.stringify(configuration, null, 2))
    expect(within(fenetre).getByRole("status")).toHaveTextContent("Configuration copiée")
  })

  it("explique l'alias d'exécution de la version du Microsoft Store, et seulement pour elle", async () => {
    const store = { ...infos, executable: "C:\\Users\\Camille\\AppData\\Local\\Microsoft\\WindowsApps\\simulateur-independant-fr.exe", microsoftStore: true }
    vi.mocked(window.api.infosDuServeurMcp).mockResolvedValue(store)
    const user = userEvent.setup({ delay: null })
    const { unmount } = render(<BoutonUtiliserAvecUneIA />)
    await user.click(await screen.findByRole("button", { name: "Utiliser avec une IA (MCP)" }))
    const fenetre = screen.getByRole("dialog")
    expect(within(fenetre).getByText(/Version du Microsoft Store/)).toHaveTextContent("Alias d'exécution d'application")
    expect(JSON.parse(within(fenetre).getByLabelText("Configuration à copier").textContent!).mcpServers["simulateur-independant-fr"].command).toBe(store.executable)
    unmount()

    vi.mocked(window.api.infosDuServeurMcp).mockResolvedValue(infos)
    render(<BoutonUtiliserAvecUneIA />)
    await user.click(await screen.findByRole("button", { name: "Utiliser avec une IA (MCP)" }))
    expect(within(screen.getByRole("dialog")).queryByText(/Version du Microsoft Store/)).not.toBeInTheDocument()
  })

  it("dit quand la copie échoue, et quand Claude Desktop n'existe pas sur le système", async () => {
    vi.mocked(window.api.infosDuServeurMcp).mockResolvedValue({ ...infos, plateforme: "linux", executable: "/opt/Simulateur/simulateur", script: "/opt/Simulateur/resources/mcp/serveur-mcp.mjs", donnees: "/home/camille/.config/Simulateur" })
    const user = userEvent.setup({ delay: null })
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => Promise.reject(new Error("refus"))) }, configurable: true })
    render(<BoutonUtiliserAvecUneIA />)
    await user.click(await screen.findByRole("button", { name: "Utiliser avec une IA (MCP)" }))
    const fenetre = screen.getByRole("dialog")
    expect(within(fenetre).getByText(/Claude Desktop n'existe pas officiellement sur ce système/)).toBeInTheDocument()
    expect(within(fenetre).getByLabelText("Commande de vérification")).toHaveTextContent('ELECTRON_RUN_AS_NODE=1 "/opt/Simulateur/simulateur" "/opt/Simulateur/resources/mcp/serveur-mcp.mjs" --donnees "/home/camille/.config/Simulateur"')
    await user.click(within(fenetre).getByRole("button", { name: "Copier la configuration" }))
    expect(within(fenetre).getByRole("status")).toHaveTextContent("La copie a échoué")
  })

  it("rend le focus au bouton à la fermeture de la fenêtre", async () => {
    vi.mocked(window.api.infosDuServeurMcp).mockResolvedValue(infos)
    const user = userEvent.setup({ delay: null })
    render(<BoutonUtiliserAvecUneIA />)
    const bouton = await screen.findByRole("button", { name: "Utiliser avec une IA (MCP)" })
    await user.click(bouton)
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(bouton).toHaveFocus()
  })
})
