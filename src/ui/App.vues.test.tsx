// src/ui/App.vues.test.tsx
// Affichage « Trois vues » (proposition B) : onglets au clavier et à la souris, adresse de chaque vue, retour arrière,
// titre de la fenêtre, focus au changement de vue, et vues masquées gardées dans la page pour l'impression.

import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Affichage } from "@/types"
import { emptySession, makeMicro, makePerson } from "@/ui/testing/fixtures"
import App from "./App"

const TITRE_D_ORIGINE = "Simulateur de revenus pour indépendants"

beforeEach(() => {
  window.history.replaceState(null, "", "/")
  document.title = TITRE_D_ORIGINE
})

async function renderApp(affichage: Affichage = "vues") {
  vi.mocked(window.api.getCurrentSession).mockResolvedValue({ ...emptySession(), name: "Simulation de test", entities: [makePerson(), makeMicro()] })
  vi.mocked(window.api.getUserPreferences).mockResolvedValue({ slotOrder: [], affichage })
  render(<App />)
  await screen.findByRole("heading", { name: "Simulation de test" })
  await screen.findByRole("region", { name: "Résumé de l'année" })
}

const onglets = () => screen.getByRole("tablist", { name: "Vues de la page" })
const onglet = (nom: RegExp) => within(onglets()).getByRole("tab", { name: nom })
const vue = (id: string) => document.getElementById(`vue-${id}`)!
const titreDeLaVue = (nom: string) => screen.getByRole("heading", { level: 2, name: nom })

/** Change l'adresse comme le ferait un lien ou le retour arrière du navigateur, et le signale à la page. */
function allerA(adresse: string) {
  act(() => {
    window.history.replaceState(null, "", adresse)
    window.dispatchEvent(new PopStateEvent("popstate"))
    window.dispatchEvent(new HashChangeEvent("hashchange"))
  })
}

describe("App : affichage « Trois vues »", () => {
  it("partage la page en trois vues, sous la barre de résumé ; seule « Ma situation » est affichée", async () => {
    await renderApp()
    expect(within(onglets()).getAllByRole("tab").map(o => o.textContent)).toEqual(["Ma situationSituation", "Mes résultatsRésultats", "Comparer et optimiserComparer"])
    expect(onglet(/situation/)).toHaveAttribute("aria-selected", "true")
    expect(onglet(/situation/)).toHaveAttribute("aria-controls", "vue-situation")
    expect(vue("situation")).toHaveAttribute("role", "tabpanel")
    expect(vue("situation")).toHaveAttribute("aria-labelledby", "onglet-situation")
    expect(vue("situation")).not.toHaveClass("hidden")
    // Les autres vues restent dans la page, masquées à l'écran, imprimées à la suite.
    expect(vue("resultats")).toHaveClass("hidden", "print:block")
    expect(vue("comparer")).toHaveClass("hidden", "print:block")
    expect(within(vue("situation")).getByRole("heading", { name: "Acteurs de la Simulation" })).toBeInTheDocument()
    expect(within(vue("resultats")).getByRole("heading", { name: "Résultats de simulation" })).toBeInTheDocument()
    expect(document.title).toBe("Ma situation — Simulation de test")
  })

  it("un onglet choisi à la souris affiche sa vue, change l'adresse et le titre, remonte en haut et mène le focus au titre de la vue", async () => {
    const remonter = vi.spyOn(window, "scrollTo")
    await renderApp()
    await userEvent.click(onglet(/résultats/))

    expect(onglet(/résultats/)).toHaveAttribute("aria-selected", "true")
    expect(onglet(/situation/)).toHaveAttribute("aria-selected", "false")
    expect(vue("resultats")).not.toHaveClass("hidden")
    expect(vue("situation")).toHaveClass("hidden")
    expect(window.location.hash).toBe("#resultats")
    expect(document.title).toBe("Mes résultats — Simulation de test")
    expect(titreDeLaVue("Mes résultats")).toHaveFocus()
    expect(remonter).toHaveBeenCalledWith(0, 0)
  })

  it("au clavier : flèches, Début et Fin changent d'onglet et de vue, le focus suit l'onglet ; un seul onglet dans l'ordre de tabulation", async () => {
    await renderApp()
    act(() => onglet(/situation/).focus())
    const tabulables = () => within(onglets()).getAllByRole("tab").filter(o => o.tabIndex === 0)

    await userEvent.keyboard("{ArrowRight}")
    expect(onglet(/résultats/)).toHaveFocus()
    expect(onglet(/résultats/)).toHaveAttribute("aria-selected", "true")
    expect(tabulables()).toEqual([onglet(/résultats/)])
    expect(window.location.hash).toBe("#resultats")

    await userEvent.keyboard("{End}")
    expect(onglet(/Comparer/)).toHaveFocus()
    expect(vue("comparer")).not.toHaveClass("hidden")
    await userEvent.keyboard("{ArrowRight}")
    expect(onglet(/situation/)).toHaveFocus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(onglet(/Comparer/)).toHaveFocus()
    await userEvent.keyboard("{Home}")
    expect(onglet(/situation/)).toHaveFocus()
    expect(tabulables()).toEqual([onglet(/situation/)])
    expect(document.title).toBe("Ma situation — Simulation de test")
  })

  it("suit l'adresse : retour arrière vers une vue, retour à l'adresse d'origine, et adresse sans vue ignorée", async () => {
    await renderApp()
    allerA("/#comparer")
    expect(onglet(/Comparer/)).toHaveAttribute("aria-selected", "true")
    expect(titreDeLaVue("Comparer et optimiser")).toHaveFocus()

    // Le lien d'évitement (#contenu) ne désigne aucune vue : la vue reste celle affichée.
    allerA("/#contenu")
    expect(onglet(/Comparer/)).toHaveAttribute("aria-selected", "true")

    allerA("/")
    expect(onglet(/situation/)).toHaveAttribute("aria-selected", "true")
  })

  it("un lien de la barre de résumé ouvre la vue de son détail", async () => {
    await renderApp()
    const alertes = within(screen.getByRole("region", { name: "Résumé de l'année" })).getByRole("link", { name: /^Alertes/ })
    expect(alertes).toHaveAttribute("href", "#resultats-titre")
    allerA("/#resultats-titre")

    expect(onglet(/résultats/)).toHaveAttribute("aria-selected", "true")
    // Le détail reçoit le focus, pour que la tabulation reprenne de là.
    expect(screen.getByRole("heading", { name: "Résultats de simulation" })).toHaveFocus()
  })

  it("s'ouvre sur la vue de l'adresse, sans prendre le focus", async () => {
    window.history.replaceState(null, "", "/#comparer")
    await renderApp()
    expect(onglet(/Comparer/)).toHaveAttribute("aria-selected", "true")
    expect(document.title).toBe("Comparer et optimiser — Simulation de test")
    expect(document.body).toHaveFocus()
  })

  it("un clic sur l'onglet déjà choisi ne change rien", async () => {
    await renderApp()
    const longueur = window.history.length
    fireEvent.click(onglet(/situation/))
    expect(window.history).toHaveLength(longueur)
    expect(window.location.hash).toBe("")
  })

  it("en quittant l'affichage « Trois vues », la page redevient d'un seul tenant et la fenêtre reprend son titre", async () => {
    await renderApp()
    await userEvent.click(screen.getByRole("combobox", { name: "Affichage : Trois vues" }))
    await userEvent.click(await screen.findByRole("option", { name: "Résumé" }))

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument()
    expect(document.title).toBe(TITRE_D_ORIGINE)
  })

  it("les autres affichages n'ont ni onglets ni vues, et ignorent l'adresse", async () => {
    window.history.replaceState(null, "", "/#resultats")
    await renderApp("resume")
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    expect(document.title).toBe(TITRE_D_ORIGINE)
  })
})
