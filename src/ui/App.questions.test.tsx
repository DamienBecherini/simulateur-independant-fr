// src/ui/App.questions.test.tsx
// L'encart « Que voulez-vous savoir ? » dans l'application entière : affiché sur une simulation vide ou sur l'exemple
// du premier lancement, absent ailleurs ; une question remplace l'exemple après confirmation ; « Partir de zéro »
// mène à la saisie, dans sa vue ; la fermeture est retenue dans les préférences.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionState, UserPreferences } from "@/types"
import { emptySession, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { delaiDesTestsDIntegration } from "@/ui/testing/delais"
import { PLATEFORME_DE_BUREAU, PlateformeContext, type Plateforme } from "./plateforme"
import App from "./App"

// L'application entière, pilotée comme par un utilisateur : un délai plus long, expliqué dans testing/delais.ts.
delaiDesTestsDIntegration()

/** Une simulation d'exemple, reconnue par la plateforme comme celle d'une démo à son premier lancement. */
const EXEMPLE: SessionState = { ...emptySession(), name: "Exemple du premier lancement", entities: [makePerson({ name: "Camille" }), makeMicro()] }
const PLATEFORME_AVEC_EXEMPLE: Plateforme = { ...PLATEFORME_DE_BUREAU, web: true, estLaSessionDExemple: session => session.name === EXEMPLE.name }

beforeEach(() => window.history.replaceState(null, "", "/"))

async function renderApp(session: SessionState, preferences: UserPreferences = { slotOrder: [] }, plateforme: Plateforme = PLATEFORME_DE_BUREAU) {
  vi.mocked(window.api.getCurrentSession).mockResolvedValue(session)
  vi.mocked(window.api.getUserPreferences).mockResolvedValue(preferences)
  const user = userEvent.setup({ delay: null })
  render(
    <PlateformeContext value={plateforme}>
      <App />
    </PlateformeContext>
  )
  await screen.findByRole("heading", { level: 1, name: session.name })
  return user
}

const encart = () => screen.queryByRole("region", { name: "Que voulez-vous savoir ?" })

/** Préférences enregistrées à la fermeture de la fenêtre. */
function enregistreesALaFermeture(): UserPreferences {
  window.dispatchEvent(new Event("beforeunload"))
  return vi.mocked(window.api.saveUserPreferences).mock.lastCall![0]
}

describe("App : encart « Que voulez-vous savoir ? »", () => {
  it("s'affiche sur une simulation vide, au-dessus du contenu", async () => {
    await renderApp(emptySession())
    expect(encart()).toBeInTheDocument()
    expect(encart()!.compareDocumentPosition(screen.getByRole("main")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("ne s'affiche pas sur une simulation de l'utilisateur", async () => {
    await renderApp({ ...emptySession(), name: "Ma simulation", entities: [makePerson()] })
    expect(encart()).not.toBeInTheDocument()
  })

  it("une fois fermé, ne revient pas, même sur une simulation vide", async () => {
    await renderApp(emptySession(), { slotOrder: [], questionsFermees: true })
    expect(encart()).not.toBeInTheDocument()
  })

  it("se ferme, rend le focus au contenu et retient sa fermeture", async () => {
    const user = await renderApp(emptySession())
    await user.click(screen.getByRole("button", { name: "Fermer « Que voulez-vous savoir ? »" }))
    expect(encart()).not.toBeInTheDocument()
    expect(screen.getByRole("main")).toHaveFocus()
    expect(enregistreesALaFermeture()).toMatchObject({ questionsFermees: true })
  })

  it("sur l'exemple de la démo, une question le remplace par sa situation type après confirmation, et l'encart s'efface", async () => {
    const user = await renderApp(EXEMPLE, undefined, PLATEFORME_AVEC_EXEMPLE)
    await user.click(within(encart()!).getByRole("button", { name: "Mariage ou Pacs ?" }))
    await user.click(within(screen.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })).getByRole("button", { name: "Remplacer" }))

    expect(await screen.findByRole("heading", { level: 1, name: "Couple en union libre, puis marié ou pacsé" })).toBeInTheDocument()
    expect(encart()).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Annuler" })).toBeEnabled()
  })

  it("« Partir de zéro » depuis l'exemple, dans l'affichage « Trois vues » : simulation vierge, vue de la saisie, focus sur l'ajout d'une personne", async () => {
    window.history.replaceState(null, "", "/#comparer")
    const user = await renderApp(EXEMPLE, { slotOrder: [], affichage: "vues" }, PLATEFORME_AVEC_EXEMPLE)
    await user.click(within(encart()!).getByRole("button", { name: "Partir de zéro" }))
    await user.click(within(screen.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })).getByRole("button", { name: "Remplacer" }))

    expect(await screen.findByRole("heading", { level: 1, name: "Nouvelle Simulation" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /situation/i })).toHaveAttribute("aria-selected", "true")
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "+ Ajouter une personne" })).toHaveFocus())
    // Simulation vide : l'encart reste là, pour choisir une question plus tard.
    expect(encart()).toBeInTheDocument()
  })
})
