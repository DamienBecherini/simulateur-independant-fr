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
  it("s'ouvre dans l'affichage « Résumé » par défaut, avec la barre de résumé", async () => {
    await renderApp({ slotOrder: [] })
    expect(screen.getByRole("combobox", { name: "Affichage : Résumé" })).toBeInTheDocument()
    expect(await screen.findByRole("region", { name: "Résumé de l'année" })).toBeInTheDocument()
  })

  it("reprend l'affichage retenu dans les préférences", async () => {
    await renderApp({ slotOrder: [], affichage: "classique" })
    expect(screen.getByRole("combobox", { name: "Affichage : Classique" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Résumé de l'année" })).not.toBeInTheDocument()
  })

  it.each(["retire", "panneaux"])("ignore un affichage inconnu ou retiré après la bêta (%s)", async affichage => {
    await renderApp({ slotOrder: [], affichage: affichage as never })
    expect(screen.getByRole("combobox", { name: "Affichage : Résumé" })).toBeInTheDocument()
  })

  it("enregistre le choix dans les préférences de l'utilisateur, pas dans la session", async () => {
    await renderApp({ slotOrder: [] })
    await userEvent.click(screen.getByRole("combobox", { name: "Affichage : Résumé" }))
    await userEvent.click(await screen.findByRole("option", { name: "Classique" }))

    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "Résumé de l'année" })).not.toBeInTheDocument())
    await vi.waitFor(() => expect(window.api.saveUserPreferences).toHaveBeenLastCalledWith(expect.objectContaining({ affichage: "classique" })), { timeout: 3000 })
    for (const [session] of vi.mocked(window.api.saveCurrentSession).mock.calls) expect(session).not.toHaveProperty("affichage")
  })
})
