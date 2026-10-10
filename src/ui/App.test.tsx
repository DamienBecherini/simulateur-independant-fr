// src/ui/App.test.tsx
// Historique d'annulation, vérifié sur l'application entière : la session initiale vient du faux `window.api`,
// les saisies passent par les vrais composants, et Ctrl+Z / Ctrl+Y pilotent l'historique de `useSessionManager`.

import { act, render, screen, within } from "@testing-library/react"
import userEvent, { type UserEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { SessionState } from "@/types"
import { emptySession, makeFlow, makePerson } from "@/ui/testing/fixtures"
import App from "./App"

/** Session de départ : Alice, avec un revenu de 1 000 € en janvier. */
function initialSession(): SessionState {
  const session = emptySession()
  session.name = "Simulation de test"
  session.entities = [makePerson()]
  session.annees[0].monthlyData[0].flows = [makeFlow({ id: "flow-janvier", label: "Loyer perçu", amount: 1000 })]
  return session
}

/** Rend l'application dans l'affichage classique, où chaque acteur a sa carte, et attend la session initiale. */
async function renderApp() {
  vi.mocked(window.api.getCurrentSession).mockResolvedValue(initialSession())
  vi.mocked(window.api.getUserPreferences).mockResolvedValue({ slotOrder: [], affichage: "classique" })
  const user = userEvent.setup({ delay: null })
  render(<App />)
  await screen.findByRole("heading", { name: "Simulation de test" })
  return user
}

const undoButton = () => screen.getByRole("button", { name: "Annuler" })
const redoButton = () => screen.getByRole("button", { name: "Rétablir" })
const nameInput = () => screen.getByRole("textbox", { name: "Nom" })

/** Compte les étapes d'annulation disponibles en annulant jusqu'au bout, puis rétablit tout. */
async function countUndoSteps(user: UserEvent) {
  let steps = 0
  while (!undoButton().hasAttribute("disabled")) {
    await user.keyboard("{Control>}z{/Control}")
    steps++
  }
  for (let i = 0; i < steps; i++) await user.keyboard("{Control>}y{/Control}")
  return steps
}

async function openMonth(user: UserEvent, month: string) {
  await user.click(screen.getByRole("button", { name: `Flux de ${month} : Alice Martin` }))
  return screen.getByRole("dialog")
}

describe("App : historique d'annulation", () => {
  it("démarre sans étape d'annulation ni de rétablissement", async () => {
    await renderApp()
    expect(undoButton()).toBeDisabled()
    expect(redoButton()).toBeDisabled()
  })

  it("compte un renommage saisi lettre à lettre comme une seule étape", async () => {
    const user = await renderApp()

    await user.clear(nameInput())
    await user.type(nameInput(), "Bob Durand{Enter}")
    expect(nameInput()).toHaveValue("Bob Durand")
    expect(await countUndoSteps(user)).toBe(1)

    await user.keyboard("{Control>}z{/Control}")
    expect(nameInput()).toHaveValue("Alice Martin")
    expect(undoButton()).toBeDisabled()

    await user.keyboard("{Control>}y{/Control}")
    expect(nameInput()).toHaveValue("Bob Durand")
  })

  it("ne crée pas d'étape quand la valeur validée est inchangée", async () => {
    const user = await renderApp()

    await user.clear(nameInput())
    await user.type(nameInput(), "Alice Martin{Enter}")
    const parts = screen.getByRole("textbox", { name: "Parts propres" })
    await user.clear(parts)
    await user.type(parts, "1{Enter}")

    expect(undoButton()).toBeDisabled()
  })

  it("compte la création d'un flux au clavier comme une seule étape", async () => {
    const user = await renderApp()

    const dialog = await openMonth(user, "février")
    await user.keyboard("Prime{Tab}1500{Enter}")
    expect(within(dialog).getByRole("textbox", { name: "Libellé" })).toHaveValue("Prime")
    await user.click(within(dialog).getByRole("button", { name: "Terminé" }))

    expect(await countUndoSteps(user)).toBe(1)
    await user.keyboard("{Control>}z{/Control}")
    const reopened = await openMonth(user, "février")
    expect(within(reopened).queryByRole("textbox", { name: "Libellé" })).not.toBeInTheDocument()
  })

  it("compte la modification d'un montant saisi chiffre à chiffre comme une seule étape", async () => {
    const user = await renderApp()

    const dialog = await openMonth(user, "janvier")
    const amount = within(dialog).getByRole("textbox", { name: "Montant" })
    await user.clear(amount)
    await user.type(amount, "1250{Enter}")
    // Revalider la même valeur ne crée rien de plus.
    await user.clear(amount)
    await user.type(amount, "1250{Enter}")
    // Ctrl+Z fonctionne aussi fenêtre ouverte, hors d'un champ : le montant d'origine revient aussitôt.
    act(() => amount.blur())
    await user.keyboard("{Control>}z{/Control}")
    expect(amount).toHaveValue((1000).toLocaleString("fr-FR"))
    await user.keyboard("{Control>}y{/Control}")
    await user.click(within(dialog).getByRole("button", { name: "Terminé" }))

    expect(await countUndoSteps(user)).toBe(1)
  })

  it("laisse Ctrl+Z et Ctrl+Y au champ texte qui a le focus : l'historique de la simulation n'est pas touché", async () => {
    const user = await renderApp()

    await user.clear(nameInput())
    await user.type(nameInput(), "Bob{Enter}")
    expect(undoButton()).toBeEnabled()

    // De retour dans le champ, la frappe est annulée par le navigateur, pas la modification validée.
    await user.click(nameInput())
    const touches: KeyboardEvent[] = []
    const garder = (event: KeyboardEvent) => touches.push(event)
    window.addEventListener("keydown", garder)
    await user.keyboard("{Control>}z{/Control}{Control>}y{/Control}")
    window.removeEventListener("keydown", garder)

    expect(touches.filter(event => event.ctrlKey && event.key !== "Control").map(event => event.defaultPrevented)).toEqual([false, false])
    expect(nameInput()).toHaveValue("Bob")
    expect(undoButton()).toBeEnabled()
    expect(redoButton()).toBeDisabled()
  })

  it("enchaîne autant d'étapes que de modifications validées", async () => {
    const user = await renderApp()

    await user.clear(nameInput())
    await user.type(nameInput(), "Bob{Enter}")
    const parts = screen.getByRole("textbox", { name: "Parts propres" })
    await user.clear(parts)
    await user.type(parts, "2{Enter}")

    expect(await countUndoSteps(user)).toBe(2)
    await user.click(undoButton())
    expect(parts).toHaveValue("1")
    expect(nameInput()).toHaveValue("Bob")
  })
})

describe("App : flux qui reviennent chaque mois", () => {
  /** Montants des flux « ARE » d'Alice, mois par mois, dans la dernière session envoyée au moteur. */
  function montantsDeLARE(): number[][] {
    const [session] = vi.mocked(window.api.simulerLesAnnees).mock.lastCall ?? []
    return (session?.annees[0].monthlyData ?? []).map(mois => mois.flows.filter(f => f.label === "ARE").map(f => f.amount))
  }

  async function appliquerA(user: UserEvent, dialog: HTMLElement, portee: "suivants" | "annee") {
    await user.selectOptions(within(dialog).getByLabelText("Appliquer à :"), portee)
  }

  it("ajouter sur l'année, modifier à partir de juillet, supprimer sur l'année : une étape d'annulation chacune", async () => {
    const user = await renderApp()

    // 1 200 € d'ARE chaque mois, saisis en mars pour toute l'année.
    let dialog = await openMonth(user, "mars")
    await appliquerA(user, dialog, "annee")
    await user.type(within(dialog).getByLabelText("Libellé du nouveau flux"), "ARE")
    await user.type(within(dialog).getByLabelText("Montant du nouveau flux"), "1200{Enter}")
    await user.click(within(dialog).getByRole("button", { name: "Terminé" }))
    await vi.waitFor(() => expect(montantsDeLARE()).toEqual(Array.from({ length: 12 }, () => [1200])))

    // 1 300 € à partir de juillet.
    dialog = await openMonth(user, "juillet")
    await appliquerA(user, dialog, "suivants")
    const montant = within(dialog).getByRole("textbox", { name: "Montant" })
    await user.clear(montant)
    await user.type(montant, "1300{Enter}")
    await user.click(within(dialog).getByRole("button", { name: "Terminé" }))
    const avantSuppression = [...Array.from({ length: 6 }, () => [1200]), ...Array.from({ length: 6 }, () => [1300])]
    await vi.waitFor(() => expect(montantsDeLARE()).toEqual(avantSuppression))

    // Suppression depuis décembre, sur toute l'année : les deux montants disparaissent.
    dialog = await openMonth(user, "décembre")
    await appliquerA(user, dialog, "annee")
    await user.click(within(dialog).getByRole("button", { name: "Supprimer le flux" }))
    await user.click(within(dialog).getByRole("button", { name: "Terminé" }))
    await vi.waitFor(() => expect(montantsDeLARE()).toEqual(Array.from({ length: 12 }, () => [])))

    expect(await countUndoSteps(user)).toBe(3)
    // Une seule annulation rend toute la série supprimée, avec ses deux montants.
    await user.keyboard("{Control>}z{/Control}")
    await vi.waitFor(() => expect(montantsDeLARE()).toEqual(avantSuppression))
  })
})

describe("App : plusieurs années", () => {
  /** La case de janvier d'Alice, qui affiche le total de ses flux du mois. */
  const caseDeJanvier = () => screen.getByRole("button", { name: "Flux de janvier : Alice Martin" })

  async function ajouterLAnneeSuivante(user: UserEvent) {
    await user.click(screen.getByRole("button", { name: "Ajouter une année" }))
    await user.click(screen.getByRole("button", { name: "Ajouter 2027" }))
  }

  it("ajoute l'année suivante en recopiant les flux, l'affiche, puis revient à la précédente", async () => {
    const user = await renderApp()
    await ajouterLAnneeSuivante(user)

    expect(screen.getByRole("button", { name: "2027" })).toHaveAttribute("aria-pressed", "true")
    expect(caseDeJanvier()).toHaveTextContent(/1\s000/)
    await vi.waitFor(() => expect(window.api.simulerLesAnnees).toHaveBeenLastCalledWith(expect.objectContaining({ annees: [expect.objectContaining({ annee: 2026 }), expect.objectContaining({ annee: 2027 })] })))
    // Les résultats portent sur l'année affichée, la synthèse sur toutes.
    expect(await screen.findByText(/année 2027 avec les règles fiscales/)).toBeInTheDocument()
    expect(screen.getByRole("table", { name: /chaque année de la session/ })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "2026" }))
    expect(screen.getByRole("button", { name: "2026" })).toHaveAttribute("aria-pressed", "true")
    expect(await screen.findByText(/année 2026 avec les règles fiscales/)).toBeInTheDocument()
  })

  it("ajoute une année vide, qui ne touche pas à la grille de l'autre année", async () => {
    const user = await renderApp()

    await user.click(screen.getByRole("button", { name: "Ajouter une année" }))
    await user.click(screen.getByRole("radio", { name: "2025, avant 2026" }))
    await user.click(screen.getByRole("radio", { name: "Commencer avec une grille vide" }))
    await user.click(screen.getByRole("button", { name: "Ajouter 2025" }))

    expect(screen.getByRole("button", { name: "2025" })).toHaveAttribute("aria-pressed", "true")
    expect(caseDeJanvier()).not.toHaveTextContent(/1\s000/)
    await user.click(screen.getByRole("button", { name: "2026" }))
    expect(caseDeJanvier()).toHaveTextContent(/1\s000/)
  })

  it("modifie la grille de l'année affichée seulement", async () => {
    const user = await renderApp()
    await ajouterLAnneeSuivante(user)

    const dialog = await openMonth(user, "janvier")
    const amount = within(dialog).getByRole("textbox", { name: "Montant" })
    await user.clear(amount)
    await user.type(amount, "2500{Enter}")
    await user.click(within(dialog).getByRole("button", { name: "Terminé" }))

    expect(caseDeJanvier()).toHaveTextContent(/2\s500/)
    await user.click(screen.getByRole("button", { name: "2026" }))
    expect(caseDeJanvier()).toHaveTextContent(/1\s000/)
  })

  it("annule l'ajout d'une année en une étape, revient sur une année existante, puis le rétablit avec ses flux", async () => {
    const user = await renderApp()
    await ajouterLAnneeSuivante(user)
    expect(await countUndoSteps(user)).toBe(1)

    await user.keyboard("{Control>}z{/Control}")
    expect(screen.queryByRole("button", { name: "2027" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "2026" })).toHaveAttribute("aria-pressed", "true")
    // Une seule année : ni suppression ni synthèse des années.
    expect(screen.queryByRole("button", { name: /^Supprimer 20/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("table", { name: /chaque année de la session/ })).not.toBeInTheDocument()

    await user.keyboard("{Control>}y{/Control}")
    expect(screen.getByRole("button", { name: "2027" })).toHaveAttribute("aria-pressed", "true")
    expect(caseDeJanvier()).toHaveTextContent(/1\s000/)
  })

  it("annule l'ajout d'une année avant la plus ancienne, puis sa suppression", async () => {
    const user = await renderApp()
    await user.click(screen.getByRole("button", { name: "Ajouter une année" }))
    await user.click(screen.getByRole("radio", { name: "2025, avant 2026" }))
    await user.click(screen.getByRole("button", { name: "Ajouter 2025" }))
    // La plus ancienne se supprime ; 2026, désormais la plus récente, aussi.
    await user.click(screen.getByRole("button", { name: "Supprimer 2025" }))
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer 2025" }))

    expect(within(screen.getByRole("group", { name: "Année affichée" })).getByRole("button", { pressed: true })).toHaveTextContent("2026")
    expect(await countUndoSteps(user)).toBe(2)
    await user.keyboard("{Control>}z{/Control}")
    expect(within(screen.getByRole("group", { name: "Année affichée" })).getAllByRole("button").map(b => b.textContent)).toEqual(["2025", "2026"])
    await user.keyboard("{Control>}z{/Control}")
    expect(within(screen.getByRole("group", { name: "Année affichée" })).getAllByRole("button").map(b => b.textContent)).toEqual(["2026"])
  })

  it("supprime une année en une étape d'annulation, et revient à la plus récente", async () => {
    const user = await renderApp()
    await ajouterLAnneeSuivante(user)

    await user.click(screen.getByRole("button", { name: "Supprimer 2027" }))
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer 2027" }))

    expect(screen.queryByRole("button", { name: "2027" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "2026" })).toHaveAttribute("aria-pressed", "true")
    expect(await countUndoSteps(user)).toBe(2)
    await user.keyboard("{Control>}z{/Control}")
    expect(screen.getByRole("button", { name: "2027" })).toBeInTheDocument()
  })
})
