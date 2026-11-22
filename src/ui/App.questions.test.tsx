// src/ui/App.questions.test.tsx
// « Par où commencer ? » dans la page, dans l'application entière : affiché sur une simulation vide ou sur l'exemple du
// premier lancement, absent ailleurs ; une question remplace l'exemple directement (annulable), puis mène à la zone qui
// y répond ; « Partir de zéro » mène à la saisie, dans sa vue ; la fermeture est retenue dans les préférences.

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

const encart = () => screen.queryByRole("region", { name: "Par où commencer ?" })
const QUESTION_DU_COUPLE = "Charger la situation qui répond à « Le mariage ou le Pacs réduirait-il notre impôt ? »"

/** Préférences enregistrées à la fermeture de la fenêtre. */
function enregistreesALaFermeture(): UserPreferences {
  window.dispatchEvent(new Event("beforeunload"))
  return vi.mocked(window.api.saveUserPreferences).mock.lastCall![0]
}

describe("App : « Par où commencer ? » dans la page", () => {
  it("s'affiche sur une simulation vide, au-dessus du contenu, sur l'onglet des questions", async () => {
    await renderApp(emptySession())
    expect(encart()).toBeInTheDocument()
    expect(within(encart()!).getByRole("tab", { name: /^Questions/ })).toHaveAttribute("aria-selected", "true")
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
    await user.click(screen.getByRole("button", { name: "Fermer « Par où commencer ? »" }))
    expect(encart()).not.toBeInTheDocument()
    expect(screen.getByRole("main")).toHaveFocus()
    expect(enregistreesALaFermeture()).toMatchObject({ questionsFermees: true })
  })

  it("sur l'exemple de la démo, une question le remplace directement par sa situation type, annulable en une étape, et le bloc s'efface", async () => {
    const user = await renderApp(EXEMPLE, undefined, PLATEFORME_AVEC_EXEMPLE)
    await user.click(within(encart()!).getByRole("button", { name: QUESTION_DU_COUPLE }))

    expect(await screen.findByRole("heading", { level: 1, name: "Couple en union libre, puis marié ou pacsé" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Remplacer la simulation en cours ?" })).not.toBeInTheDocument()
    expect(encart()).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Annuler" }))
    expect(await screen.findByRole("heading", { level: 1, name: EXEMPLE.name })).toBeInTheDocument()
    expect(encart()).toBeInTheDocument()
  })

  it("sur une simulation vide, une question charge directement sa situation type", async () => {
    const user = await renderApp(emptySession(), undefined, PLATEFORME_AVEC_EXEMPLE)
    await user.click(within(encart()!).getByRole("button", { name: QUESTION_DU_COUPLE }))

    expect(await screen.findByRole("heading", { level: 1, name: "Couple en union libre, puis marié ou pacsé" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Remplacer la simulation en cours ?" })).not.toBeInTheDocument()
  })

  it("après le chargement, mène à la zone qui répond à la question : le titre des résultats, signalé et avec le focus", async () => {
    const user = await renderApp(emptySession(), undefined, PLATEFORME_AVEC_EXEMPLE)
    await user.click(within(encart()!).getByRole("button", { name: "Charger la situation qui répond à « Quelles cotisations paie la micro-entreprise ? »" }))

    await screen.findByRole("heading", { level: 1, name: "Salarié avec une micro-entreprise à côté" })
    await vi.waitFor(() => expect(document.getElementById("resultats-titre")).toHaveFocus(), { timeout: 3000 })
    expect(document.querySelector("[data-reperee]")).toContainElement(document.getElementById("resultats-titre"))
  })

  it("« Partir de zéro » depuis l'exemple, sans confirmation, dans l'affichage « Trois vues » : simulation vierge, vue de la saisie, focus sur l'ajout d'une personne", async () => {
    window.history.replaceState(null, "", "/#comparer")
    const user = await renderApp(EXEMPLE, { slotOrder: [], affichage: "vues" }, PLATEFORME_AVEC_EXEMPLE)
    await user.click(within(encart()!).getByRole("button", { name: "Partir de zéro" }))

    expect(await screen.findByRole("heading", { level: 1, name: "Nouvelle Simulation" })).toBeInTheDocument()
    expect(within(screen.getByRole("tablist", { name: "Vues de la page" })).getByRole("tab", { name: /situation/i })).toHaveAttribute("aria-selected", "true")
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "+ Ajouter une personne" })).toHaveFocus())
    // Le choix est fait : le bloc s'efface, sans que sa fermeture soit retenue (il revient au prochain lancement).
    expect(encart()).toBeNull()
  })
})
