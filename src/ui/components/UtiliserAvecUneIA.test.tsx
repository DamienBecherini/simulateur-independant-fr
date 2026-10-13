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
    const configuration = JSON.parse(within(fenetre).getByLabelText("Configuration à copier").textContent!)
    expect(configuration).toEqual({ mcpServers: { "simulateur-independant-fr": { command: infos.executable, args: [infos.script, "--donnees", infos.donnees], env: { ELECTRON_RUN_AS_NODE: "1" } } } })

    // Le cas courant : le fichier a déjà des réglages, le bloc se colle après sa première accolade.
    await user.click(within(fenetre).getByRole("button", { name: "Copier le bloc à insérer (fichier existant)" }))
    expect(ecrire).toHaveBeenLastCalledWith(`${JSON.stringify(configuration, null, 2).split("\n").slice(1, -1).join("\n")},`)
    expect(within(fenetre).getByRole("status")).toHaveTextContent("Bloc copié : collez-le juste après la première accolade")

    await user.click(within(fenetre).getByRole("button", { name: "Copier la configuration complète (fichier vide)" }))
    expect(ecrire).toHaveBeenLastCalledWith(JSON.stringify(configuration, null, 2))
    expect(within(fenetre).getByRole("status")).toHaveTextContent("Configuration copiée")
  })

  it("donne la commande de Claude Code, prête à copier, avec les mêmes chemins que la configuration", async () => {
    vi.mocked(window.api.infosDuServeurMcp).mockResolvedValue(infos)
    const ecrire = vi.fn(async () => undefined)
    const user = userEvent.setup({ delay: null })
    Object.defineProperty(navigator, "clipboard", { value: { writeText: ecrire }, configurable: true })
    render(<BoutonUtiliserAvecUneIA />)
    await user.click(await screen.findByRole("button", { name: "Utiliser avec une IA (MCP)" }))
    const fenetre = screen.getByRole("dialog")

    const commande = `claude mcp add simulateur-independant-fr --scope user --env ELECTRON_RUN_AS_NODE=1 -- "${infos.executable}" "${infos.script}" --donnees "${infos.donnees}"`
    expect(within(fenetre).getByLabelText("Commande pour Claude Code")).toHaveTextContent(commande)
    await user.click(within(fenetre).getByRole("button", { name: "Copier la commande pour Claude Code" }))
    expect(ecrire).toHaveBeenLastCalledWith(commande)
    expect(within(fenetre).getByText(/Commande copiée/)).toBeInTheDocument()
    // Relancer Claude Code, voir l'état, retirer le serveur.
    expect(within(fenetre).getByText(/relancez-le/)).toHaveTextContent("/mcp")
    expect(within(fenetre).getByText(/relancez-le/)).toHaveTextContent("claude mcp remove simulateur-independant-fr --scope user")
  })

  it("dit quand la copie de la commande de Claude Code échoue", async () => {
    vi.mocked(window.api.infosDuServeurMcp).mockResolvedValue(infos)
    const user = userEvent.setup({ delay: null })
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => Promise.reject(new Error("refus"))) }, configurable: true })
    render(<BoutonUtiliserAvecUneIA />)
    await user.click(await screen.findByRole("button", { name: "Utiliser avec une IA (MCP)" }))
    const fenetre = screen.getByRole("dialog")
    await user.click(within(fenetre).getByRole("button", { name: "Copier la commande pour Claude Code" }))
    expect(within(fenetre).getByText(/La copie a échoué/)).toBeInTheDocument()
  })

  it("donne la commande de Claude Code de la version du Microsoft Store avec l'alias d'exécution", async () => {
    const store = { ...infos, executable: "C:\\Users\\Camille\\AppData\\Local\\Microsoft\\WindowsApps\\simulateur-independant-fr.exe", microsoftStore: true }
    vi.mocked(window.api.infosDuServeurMcp).mockResolvedValue(store)
    const user = userEvent.setup({ delay: null })
    render(<BoutonUtiliserAvecUneIA />)
    await user.click(await screen.findByRole("button", { name: "Utiliser avec une IA (MCP)" }))
    expect(within(screen.getByRole("dialog")).getByLabelText("Commande pour Claude Code")).toHaveTextContent(`-- "${store.executable}" "${infos.script}"`)
  })

  it("fait ouvrir le fichier de Claude Desktop par son menu, quitter Claude Desktop avant d'enregistrer, et utiliser l'onglet Chat", async () => {
    vi.mocked(window.api.infosDuServeurMcp).mockResolvedValue(infos)
    const user = userEvent.setup({ delay: null })
    render(<BoutonUtiliserAvecUneIA />)
    await user.click(await screen.findByRole("button", { name: "Utiliser avec une IA (MCP)" }))
    const fenetre = screen.getByRole("dialog")
    expect(within(fenetre).getByText(/« Modifier la configuration »/)).toHaveTextContent("Edit Config")
    expect(within(fenetre).getByText(/Quittez complètement Claude Desktop/)).toHaveTextContent("clic droit sur son icône près de l'horloge")
    expect(within(fenetre).getByText(/juste après la toute première accolade/)).toHaveTextContent("rubrique « mcpServers »")
    expect(within(fenetre).getByText(/onglet Chat/)).toHaveTextContent("menu « + »")
    // Les chemins, en information secondaire : l'installation classique et celle en paquet.
    expect(within(fenetre).getByText("%APPDATA%\\Claude\\claude_desktop_config.json")).toBeInTheDocument()
    expect(within(fenetre).getByText("%LOCALAPPDATA%\\Packages\\Claude_<identifiant>\\LocalCache\\Roaming\\Claude\\claude_desktop_config.json")).toBeInTheDocument()
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
    expect(within(fenetre).queryByText(/Quittez complètement Claude Desktop/)).not.toBeInTheDocument()
    await user.click(within(fenetre).getByRole("button", { name: "Copier la configuration complète (fichier vide)" }))
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
