// src/ui/App.preferences.test.tsx
// Préférences retenues d'une ouverture à l'autre, vérifiées sur l'application entière : le zoom et l'état de la
// légende des flux, section repliable de l'affichage « Résumé ».

import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { UserPreferences } from "@/types"
import { emptySession } from "@/ui/testing/fixtures"
import App from "./App"

async function renderApp(preferences: UserPreferences) {
  vi.mocked(window.api.getCurrentSession).mockResolvedValue({ ...emptySession(), name: "Préférences" })
  vi.mocked(window.api.getUserPreferences).mockResolvedValue(preferences)
  render(<App />)
  await screen.findByRole("heading", { name: "Préférences" })
}

/** Préférences enregistrées à la fermeture de la fenêtre. */
function enregistreesALaFermeture(): UserPreferences {
  window.dispatchEvent(new Event("beforeunload"))
  return vi.mocked(window.api.saveUserPreferences).mock.lastCall![0]
}

afterEach(() => {
  document.body.style.zoom = ""
})

describe("préférences retenues par l'application", () => {
  it("applique le zoom retenu, et retient le nouveau zoom choisi", async () => {
    await renderApp({ slotOrder: [], zoom: 1.3 })
    expect(document.body.style.zoom).toBe("1.3")

    await userEvent.click(screen.getByRole("button", { name: "Zoom avant" }))

    expect(document.body.style.zoom).toBe("1.4")
    expect(enregistreesALaFermeture()).toMatchObject({ zoom: 1.4 })
  })

  it("part de 100 % sans zoom retenu", async () => {
    await renderApp({ slotOrder: [] })
    expect(document.body.style.zoom).toBe("1")
  })

  it("rouvre la légende des flux retenue ouverte, et retient sa fermeture", async () => {
    await renderApp({ slotOrder: [], affichage: "resume", sectionsOuvertes: { "legende-des-flux": true } })
    const legende = screen.getByText("Légende des flux").closest("details")!
    expect(legende.open).toBe(true)

    act(() => {
      legende.open = false
      fireEvent(legende, new Event("toggle"))
    })

    expect(enregistreesALaFermeture().sectionsOuvertes).toEqual({ "legende-des-flux": false })
  })
})
