// src/ui/App.modification-directe.test.tsx
// L'IA modifie directement la simulation (ADR 011, addendum du 2026-10-14) : la case de la fenêtre de relecture,
// cochée avant « Appliquer », l'active et l'enregistre dans les préférences ; une proposition valide et à jour
// s'applique alors dès son arrivée (une étape d'annulation, une notification avec « Annuler »), une proposition
// périmée reste dans la fenêtre ; la pastille en bas de la page y met fin.

import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import type { SessionState, UserPreferences } from "@/types"
import type { PropositionRecue } from "@/backend/mcp/proposition-en-attente"
import { executerOutil } from "@/backend/logic/outils/catalogue"
import { sessionApresLaProposition } from "@/backend/logic/outils/propositions"
import { emptySession, makeFlow, makePerson } from "@/ui/testing/fixtures"
import App from "./App"

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() }) }))

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.info).mockClear()
})

function initialSession(): SessionState {
  const session = emptySession()
  session.name = "Simulation de test"
  session.entities = [makePerson()]
  session.annees[0].monthlyData[0].flows = [makeFlow({ id: "flow-janvier", label: "Loyer perçu", amount: 1000 })]
  return session
}

/** Une proposition d'ajouter un acteur, construite par l'outil sur une session donnée. */
function propositionRecue(session: SessionState, nom: string, id: string): PropositionRecue {
  const reponse = executerOutil("proposer_acteur", session, { genre: "personne", nom })
  if (!reponse.ok) throw new Error(reponse.erreur)
  const { proposition } = reponse.resultat as { proposition: PropositionRecue["proposition"] }
  return { id, creeeLe: "2026-10-14T08:30:00.000Z", proposition }
}

/** Bruno, puis Chloé construite sur la simulation qui a Bruno : deux propositions qui se suivent. */
function deuxPropositions(): [PropositionRecue, PropositionRecue] {
  const bruno = propositionRecue(initialSession(), "Bruno Durand", "a-bruno.json")
  const chloe = propositionRecue(sessionApresLaProposition(initialSession(), bruno.proposition), "Chloé Petit", "b-chloe.json")
  return [bruno, chloe]
}

/** Lance l'application ; la fonction rendue simule une boîte aux propositions mise à jour pendant qu'elle tourne. */
async function renderApp(propositions: PropositionRecue[], preferences: Partial<UserPreferences> = {}) {
  let transmettre: (liste: PropositionRecue[]) => void = () => undefined
  vi.mocked(window.api.onPropositionsEnAttente).mockImplementation(rappel => {
    transmettre = rappel
    return () => undefined
  })
  vi.mocked(window.api.getCurrentSession).mockResolvedValue(initialSession())
  vi.mocked(window.api.getUserPreferences).mockResolvedValue({ slotOrder: [], affichage: "classique", ...preferences })
  vi.mocked(window.api.propositionsEnAttente).mockResolvedValue(propositions)
  const user = userEvent.setup({ delay: null })
  render(<App />)
  await screen.findByText("Simulation de test", { selector: "h1" })
  return { user, deposer: (liste: PropositionRecue[]) => act(() => transmettre(liste)) }
}

const noms = () => screen.queryAllByRole("textbox", { name: "Nom", hidden: true }).map(champ => (champ as HTMLInputElement).value)
const undoButton = () => screen.getByRole("button", { name: "Annuler" })
const pastille = () => screen.queryByRole("region", { name: "Modification directe de la simulation par l'IA" })
const dernier = <T,>(liste: T[]): T | undefined => liste[liste.length - 1]
const derniereNotification = () => dernier(vi.mocked(toast.success).mock.calls)!
/** Le bouton « Annuler » d'une notification de sonner. */
const actionDe = (options: unknown) => (options as { action: { label: string; onClick: () => void } }).action
/** Les préférences enregistrées en dernier (sauvegarde différée d'une seconde). */
const preferencesEnregistrees = () => dernier(vi.mocked(window.api.saveUserPreferences).mock.calls)?.[0]

describe("App : l'IA modifie directement la simulation", () => {
  it("case cochée puis « Appliquer » : la proposition s'applique, le choix est enregistré, la suivante s'applique dès son arrivée", async () => {
    const [bruno, chloe] = deuxPropositions()
    const { user, deposer } = await renderApp([bruno])
    expect(pastille()).not.toBeInTheDocument()

    const fenetre = await screen.findByRole("dialog", { name: "Proposition de votre IA" })
    const caseACocher = within(fenetre).getByRole("checkbox", { name: "Laisser l'IA modifier directement la simulation" })
    expect(caseACocher).not.toBeChecked()
    expect(caseACocher).toHaveAccessibleDescription(/ses modifications suivantes, et celles qui attendent déjà, s'appliqueront aussitôt\. Chacune reste annulable/)
    await user.click(caseACocher)
    await user.click(within(fenetre).getByRole("button", { name: "Appliquer" }))

    expect(noms()).toEqual(["Alice Martin", "Bruno Durand"])
    expect(derniereNotification()[0]).toBe("Proposition appliquée : Ajouter 1 acteur. « Annuler » la défait. L'IA modifiera désormais directement la simulation.")
    expect(pastille()).toBeInTheDocument()
    // Une préférence enregistrée, comme le zoom ou l'affichage : elle vaut d'une ouverture à l'autre.
    await waitFor(() => expect(preferencesEnregistrees()).toMatchObject({ iaModifieDirectement: true }), { timeout: 3000 })

    // La proposition suivante n'ouvre aucune fenêtre : appliquée, retirée de la boîte, annoncée par une notification.
    deposer([chloe])
    await waitFor(() => expect(noms()).toEqual(["Alice Martin", "Bruno Durand", "Chloé Petit"]))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(window.api.retirerProposition).toHaveBeenCalledWith(chloe.id)
    const [message, options] = derniereNotification()
    expect(message).toBe("Modifié par l'IA : Ajouter 1 acteur")
    const action = actionDe(options)
    expect(action.label).toBe("Annuler")

    // « Annuler » de la notification défait cette modification seule, en une étape.
    act(() => action.onClick())
    expect(noms()).toEqual(["Alice Martin", "Bruno Durand"])
    await user.click(undoButton())
    expect(noms()).toEqual(["Alice Martin"])
    expect(undoButton()).toBeDisabled()
  })

  it("case cochée puis « Refuser » : rien ne change, l'IA ne modifie pas directement la simulation", async () => {
    const [bruno] = deuxPropositions()
    const { user } = await renderApp([bruno])
    const fenetre = await screen.findByRole("dialog", { name: "Proposition de votre IA" })
    await user.click(within(fenetre).getByRole("checkbox", { name: "Laisser l'IA modifier directement la simulation" }))
    await user.click(within(fenetre).getByRole("button", { name: "Refuser" }))
    expect(noms()).toEqual(["Alice Martin"])
    expect(pastille()).not.toBeInTheDocument()
    expect(vi.mocked(window.api.saveUserPreferences).mock.calls.some(([prefs]) => prefs.iaModifieDirectement === true)).toBe(false)
  })

  it("choix enregistré : au démarrage, plusieurs propositions s'appliquent dans l'ordre, chacune relue sur la précédente, chacune une étape d'annulation", async () => {
    const [bruno, chloe] = deuxPropositions()
    const { user } = await renderApp([bruno, chloe], { iaModifieDirectement: true })
    await waitFor(() => expect(noms()).toEqual(["Alice Martin", "Bruno Durand", "Chloé Petit"]))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(pastille()).toBeInTheDocument()
    expect(vi.mocked(window.api.retirerProposition).mock.calls.map(([id]) => id)).toEqual([bruno.id, chloe.id])

    await user.click(undoButton())
    expect(noms()).toEqual(["Alice Martin", "Bruno Durand"])
    await user.click(undoButton())
    expect(noms()).toEqual(["Alice Martin"])
    expect(undoButton()).toBeDisabled()
  })

  it("une proposition périmée n'est pas appliquée : elle reste dans la fenêtre, et la suivante attend son tour", async () => {
    const perimee = propositionRecue({ ...initialSession(), name: "Version précédente" }, "Zoé Ancienne", "a-perimee.json")
    const bruno = propositionRecue(initialSession(), "Bruno Durand", "b-bruno.json")
    const { user } = await renderApp([perimee, bruno], { iaModifieDirectement: true })

    const fenetre = await screen.findByRole("dialog", { name: "Proposition de votre IA" })
    expect(within(fenetre).getByRole("alert")).toHaveTextContent(/Proposition périmée/)
    expect(within(fenetre).queryByRole("checkbox")).not.toBeInTheDocument()
    expect(noms()).toEqual(["Alice Martin"])
    expect(window.api.retirerProposition).not.toHaveBeenCalled()

    await user.click(within(fenetre).getByRole("button", { name: "Retirer" }))
    await waitFor(() => expect(noms()).toEqual(["Alice Martin", "Bruno Durand"]))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("décocher la pastille revient aux propositions à relire, et l'enregistre", async () => {
    const [bruno] = deuxPropositions()
    const { user, deposer } = await renderApp([], { iaModifieDirectement: true })
    const caseDeLaPastille = within(pastille()!).getByRole("checkbox", { name: "L'IA modifie directement la simulation" })
    expect(caseDeLaPastille).toBeChecked()
    expect(caseDeLaPastille).toHaveAccessibleDescription("Décochez pour revenir aux propositions à relire.")

    await user.click(caseDeLaPastille)
    expect(pastille()).not.toBeInTheDocument()
    await waitFor(() => expect(preferencesEnregistrees()).toBeDefined(), { timeout: 3000 })
    expect(preferencesEnregistrees()!.iaModifieDirectement).toBeUndefined()

    deposer([bruno])
    expect(await screen.findByRole("dialog", { name: "Proposition de votre IA" })).toBeInTheDocument()
    expect(noms()).toEqual(["Alice Martin"])
  })

  it("« Annuler » d'une notification ne défait pas une modification faite après elle", async () => {
    const [bruno, chloe] = deuxPropositions()
    await renderApp([bruno, chloe], { iaModifieDirectement: true })
    await waitFor(() => expect(noms()).toEqual(["Alice Martin", "Bruno Durand", "Chloé Petit"]))
    // La notification de Bruno : Chloé l'a suivie, son « Annuler » ne touche à rien et renvoie à la barre d'outils.
    const action = actionDe(vi.mocked(toast.success).mock.calls[0][1])
    act(() => action.onClick())
    expect(noms()).toEqual(["Alice Martin", "Bruno Durand", "Chloé Petit"])
    expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/utilisez « Annuler » dans la barre d'outils/))
  })
})
