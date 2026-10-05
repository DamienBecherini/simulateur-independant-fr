// src/ui/App.test.tsx
// Historique d'annulation, vérifié sur l'application entière : la session initiale vient du faux `window.api`,
// les saisies passent par les vrais composants, et Ctrl+Z / Ctrl+Y pilotent l'historique de `useSessionManager`.

import { render, screen, within } from "@testing-library/react"
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

/** Rend l'application et attend que la session initiale soit chargée. */
async function renderApp() {
  vi.mocked(window.api.getCurrentSession).mockResolvedValue(initialSession())
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
    // Ctrl+Z fonctionne aussi fenêtre ouverte : le montant d'origine revient aussitôt.
    await user.keyboard("{Control>}z{/Control}")
    expect(amount).toHaveValue((1000).toLocaleString("fr-FR"))
    await user.keyboard("{Control>}y{/Control}")
    await user.click(within(dialog).getByRole("button", { name: "Terminé" }))

    expect(await countUndoSteps(user)).toBe(1)
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
