// src/ui/App.conjoint.test.tsx
// « Ajouter un conjoint » dans l'application entière, avec le vrai moteur : la carte du foyer d'une personne seule le
// propose ; l'ajout forme un foyer de deux personnes sur deux parts, et s'annule en une étape.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { MONTAGES_TYPES, sessionDUnMontage } from "@/lib/montages/montages"
import type { SessionState } from "@/types"
import { delaiDesTestsDIntegration } from "@/ui/testing/delais"
import { PLATEFORME_DE_BUREAU, PlateformeContext } from "./plateforme"
import App from "./App"

delaiDesTestsDIntegration()

const situation = (id: string): SessionState => sessionDUnMontage(MONTAGES_TYPES.find(m => m.id === id)!)

async function afficher(session: SessionState) {
  vi.mocked(window.api.getCurrentSession).mockResolvedValue(session)
  vi.mocked(window.api.simulerLesAnnees).mockImplementation(async s => simulerLesAnnees(s))
  const user = userEvent.setup({ delay: null })
  render(
    <PlateformeContext value={PLATEFORME_DE_BUREAU}>
      <App />
    </PlateformeContext>
  )
  await screen.findByRole("heading", { level: 1, name: session.name })
  return user
}

describe("App : ajouter un conjoint", () => {
  it("ajoute le conjoint et son salaire en une étape : un foyer de deux personnes, sur deux parts", async () => {
    const user = await afficher(situation("micro-bnc-seule"))
    await user.click(await screen.findByRole("button", { name: "Ajouter un conjoint" }))
    const fenetre = screen.getByRole("dialog", { name: "Ajouter le conjoint de Sophie" })
    await user.type(within(fenetre).getByRole("textbox", { name: "Prénom" }), "Nadia")
    await user.type(within(fenetre).getByRole("spinbutton", { name: "Son salaire net par mois (€), facultatif" }), "2500")
    await user.click(within(fenetre).getByRole("button", { name: "Ajouter au foyer" }))

    expect(await screen.findByText("Foyer fiscal · 2 parts")).toBeInTheDocument()
    expect(screen.getByText("Sophie, Nadia")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Ajouter un conjoint" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Annuler" }))
    expect(await screen.findByText("Foyer fiscal · 1 part")).toBeInTheDocument()
    expect(screen.queryByText("Sophie, Nadia")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ajouter un conjoint" })).toBeInTheDocument()
  })

  it("pas de raccourci pour un couple déjà marié, ni pour un couple en union libre", async () => {
    await afficher(situation("conjoint-salarie-sasu"))
    expect(await screen.findByText("Foyer fiscal · 2 parts")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Ajouter un conjoint" })).not.toBeInTheDocument()
  })

  it("en union libre, aucun des deux foyers ne le propose", async () => {
    await afficher(situation("couple-union-libre"))
    expect(await screen.findAllByText("Foyer fiscal · 1 part")).toHaveLength(2)
    expect(screen.queryByRole("button", { name: "Ajouter un conjoint" })).not.toBeInTheDocument()
  })
})
