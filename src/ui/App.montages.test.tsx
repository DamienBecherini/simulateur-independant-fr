// src/ui/App.montages.test.tsx
// Montages types dans l'application entière : chargés depuis les paramètres ou depuis une simulation vide, ils
// remplacent la session, restent annulables, et la page remonte en haut.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { SessionState } from "@/types"
import { emptySession, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { delaiDesTestsDIntegration } from "@/ui/testing/delais"
import { PLATEFORME_DE_BUREAU, PlateformeContext } from "./plateforme"
import App from "./App"

// L'application entière, pilotée comme par un utilisateur : un délai plus long, expliqué dans testing/delais.ts.
delaiDesTestsDIntegration()

/** Une simulation d'exemple, reconnue par la plateforme comme celle d'une démo à son premier lancement. */
const EXEMPLE: SessionState = { ...emptySession(), name: "Exemple du premier lancement", entities: [makePerson({ name: "Camille" }), makeMicro()] }
const DEMO = { ...PLATEFORME_DE_BUREAU, web: true, estLaSessionDExemple: (session: SessionState) => session.name === EXEMPLE.name && session.entities[0]?.name === "Camille" }

async function renderApp(session: SessionState, plateforme = PLATEFORME_DE_BUREAU) {
  vi.mocked(window.api.getCurrentSession).mockResolvedValue(session)
  const user = userEvent.setup({ delay: null })
  render(
    <PlateformeContext value={plateforme}>
      <App />
    </PlateformeContext>
  )
  await screen.findByRole("heading", { level: 1, name: session.name })
  return user
}

const undoButton = () => screen.getByRole("button", { name: "Annuler" })

describe("App : montages types", () => {
  it("depuis une simulation vide, charge un montage sans confirmation, le nomme et remonte en haut", async () => {
    const remonter = vi.spyOn(window, "scrollTo")
    const user = await renderApp(emptySession())

    await user.click(screen.getByRole("button", { name: "Partir d'une situation type..." }))
    await user.click(screen.getByRole("button", { name: "Charger la situation « SASU sans salaire, tout en dividendes »" }))

    expect(await screen.findByRole("heading", { level: 1, name: "SASU sans salaire, tout en dividendes" })).toBeInTheDocument()
    expect(screen.getAllByText("SASU de Thomas").length).toBeGreaterThan(0)
    expect(remonter).toHaveBeenCalledWith(0, 0)
    expect(undoButton()).toBeEnabled()
  })

  it("sur l'exemple de la démo non modifié, charge un montage directement, annulable en une étape", async () => {
    const user = await renderApp(EXEMPLE, DEMO)

    await user.click(within(screen.getByRole("navigation", { name: "Barre d'outils" })).getByRole("button", { name: "Situations types" }))
    await user.click(screen.getByRole("button", { name: "Charger la situation « SASU sans salaire, tout en dividendes »" }))

    expect(await screen.findByRole("heading", { level: 1, name: "SASU sans salaire, tout en dividendes" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Remplacer la simulation en cours ?" })).not.toBeInTheDocument()
    await user.click(undoButton())
    expect(await screen.findByRole("heading", { level: 1, name: EXEMPLE.name })).toBeInTheDocument()
  })

  it("sur l'exemple de la démo modifié, demande confirmation avant de le remplacer", async () => {
    const user = await renderApp(EXEMPLE, DEMO)
    await user.clear(screen.getAllByRole("textbox", { name: "Nom" })[0])
    await user.type(screen.getAllByRole("textbox", { name: "Nom" })[0], "Bob{Enter}")

    await user.click(within(screen.getByRole("navigation", { name: "Barre d'outils" })).getByRole("button", { name: "Situations types" }))
    await user.click(screen.getByRole("button", { name: "Charger la situation « SASU sans salaire, tout en dividendes »" }))
    expect(screen.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })).toHaveTextContent(`« ${EXEMPLE.name} »`)
  })

  it("depuis les paramètres, demande confirmation avant de remplacer une simulation non enregistrée, puis reste annulable", async () => {
    const session = { ...emptySession(), name: "Mon brouillon", entities: [makePerson()] }
    const user = await renderApp(session)
    await user.clear(screen.getByRole("textbox", { name: "Nom" }))
    await user.type(screen.getByRole("textbox", { name: "Nom" }), "Bob{Enter}")
    expect(undoButton()).toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Paramètres" }))
    await user.click(screen.getByRole("button", { name: "Partir d'une situation type..." }))
    await user.click(screen.getByRole("button", { name: "Détails de la situation « Salarié avec une micro-entreprise à côté »" }))
    await user.click(screen.getByRole("button", { name: "Charger cette situation" }))
    const confirmation = screen.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })
    expect(confirmation).toHaveTextContent("« Mon brouillon »")
    await user.click(within(confirmation).getByRole("button", { name: "Remplacer" }))

    expect(await screen.findByRole("heading", { level: 1, name: "Salarié avec une micro-entreprise à côté" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(undoButton()).toBeEnabled()
  })
  it("depuis la barre d'outils, ouvre la même fenêtre et demande confirmation avant de remplacer une simulation non enregistrée", async () => {
    const user = await renderApp({ ...emptySession(), name: "Mon brouillon", entities: [makePerson()] })
    await user.clear(screen.getByRole("textbox", { name: "Nom" }))
    await user.type(screen.getByRole("textbox", { name: "Nom" }), "Bob{Enter}")

    await user.click(within(screen.getByRole("navigation", { name: "Barre d'outils" })).getByRole("button", { name: "Situations types" }))
    await user.click(screen.getByRole("button", { name: "Charger la situation « SASU sans salaire, tout en dividendes »" }))
    await user.click(within(screen.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })).getByRole("button", { name: "Remplacer" }))

    expect(await screen.findByRole("heading", { level: 1, name: "SASU sans salaire, tout en dividendes" })).toBeInTheDocument()
    expect(undoButton()).toBeEnabled()
  })
})
