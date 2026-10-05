// src/ui/App.affichage.test.tsx
// Affichage choisi dans la barre d'outils : une préférence de l'utilisateur, relue au démarrage et enregistrée à
// chaque changement, jamais dans la simulation.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { emptySession, makePerson } from "@/ui/testing/fixtures"
import App from "./App"

async function renderApp(preferences: Awaited<ReturnType<typeof window.api.getUserPreferences>>) {
  vi.mocked(window.api.getCurrentSession).mockResolvedValue({ ...emptySession(), name: "Simulation de test", entities: [makePerson()] })
  vi.mocked(window.api.getUserPreferences).mockResolvedValue(preferences)
  render(<App />)
  await screen.findByRole("heading", { name: "Simulation de test" })
}

describe("App : affichage de la page", () => {
  it("s'ouvre dans l'affichage classique par défaut, sans barre de résumé", async () => {
    await renderApp({ slotOrder: [] })
    expect(screen.getByRole("combobox", { name: "Affichage : Classique" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Résumé de l'année" })).not.toBeInTheDocument()
  })

  it("reprend l'affichage retenu dans les préférences", async () => {
    await renderApp({ slotOrder: [], affichage: "resume" })
    expect(await screen.findByRole("region", { name: "Résumé de l'année" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Affichage : Résumé" })).toBeInTheDocument()
  })

  it("ignore un affichage pas encore disponible", async () => {
    await renderApp({ slotOrder: [], affichage: "vues" })
    expect(screen.getByRole("combobox", { name: "Affichage : Classique" })).toBeInTheDocument()
  })

  it("enregistre le choix dans les préférences de l'utilisateur, pas dans la session", async () => {
    await renderApp({ slotOrder: [] })
    await userEvent.click(screen.getByRole("combobox", { name: "Affichage : Classique" }))
    await userEvent.click(await screen.findByRole("option", { name: "Résumé" }))

    expect(await screen.findByRole("region", { name: "Résumé de l'année" })).toBeInTheDocument()
    await vi.waitFor(() => expect(window.api.saveUserPreferences).toHaveBeenLastCalledWith(expect.objectContaining({ affichage: "resume" })), { timeout: 3000 })
    for (const [session] of vi.mocked(window.api.saveCurrentSession).mock.calls) expect(session).not.toHaveProperty("affichage")
  })
})
