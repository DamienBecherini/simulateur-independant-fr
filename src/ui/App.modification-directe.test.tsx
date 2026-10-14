// src/ui/App.modification-directe.test.tsx
// L'IA modifie directement la simulation (ADR 011, addendum du 2026-10-14) : la case de la fenêtre de relecture,
// cochée avant « Appliquer », ou celle des paramètres, l'active et l'enregistre dans les préférences ; une proposition
// valide et à jour qui arrive ensuite s'applique dès son arrivée (une étape d'annulation, une notification avec
// « Annuler »). Restent dans la fenêtre : une suppression, une proposition qui attendait déjà (au démarrage ou à
// l'activation), une proposition périmée, sans retenir les suivantes. La pastille de la barre d'outils y met fin.

import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import type { SessionState, UserPreferences } from "@/types"
import type { PropositionRecue } from "@/backend/mcp/proposition-en-attente"
import { executerOutil } from "@/backend/logic/outils/catalogue"
import { sessionApresLaProposition } from "@/backend/logic/outils/propositions"
import type { InfosDuServeurMcp } from "@/lib/configuration-mcp"
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

/** Une proposition de supprimer la série « Loyer perçu » d'Alice, construite sur la session de départ. */
function propositionDeSuppression(id: string): PropositionRecue {
  const reponse = executerOutil("proposer_suppression", initialSession(), { suppressions: [{ cible: "serie", annee: 2026, serie: { acteurId: "person-alice", typeFlux: "other_taxable_income", libelle: "Loyer perçu" } }] })
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
// Masquée aux technologies d'assistance tant qu'une fenêtre est ouverte par-dessus : cherchée quand même.
const pastille = () => screen.queryByRole("checkbox", { name: "IA en direct", hidden: true })
const CASE = "Laisser l'IA modifier directement la simulation"
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
    const caseACocher = within(fenetre).getByRole("checkbox", { name: CASE })
    expect(caseACocher).not.toBeChecked()
    expect(caseACocher).toHaveAccessibleDescription(
      "Case cochée, « Appliquer » applique cette proposition, puis les suivantes de l'IA s'appliqueront aussitôt, chacune annulable (Ctrl+Z ou « Annuler »). Les suppressions, et les propositions qui attendent déjà, resteront à valider ici. Choix retenu d'une ouverture à l'autre : décochez la pastille « IA en direct » ou la case des paramètres pour y mettre fin."
    )
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
    await user.click(within(fenetre).getByRole("checkbox", { name: CASE }))
    await user.click(within(fenetre).getByRole("button", { name: "Refuser" }))
    expect(noms()).toEqual(["Alice Martin"])
    expect(pastille()).not.toBeInTheDocument()
    expect(vi.mocked(window.api.saveUserPreferences).mock.calls.some(([prefs]) => prefs.iaModifieDirectement === true)).toBe(false)
  })

  it("choix enregistré : les propositions qui arrivent s'appliquent dans l'ordre, chacune relue sur la précédente, chacune une étape d'annulation", async () => {
    const [bruno, chloe] = deuxPropositions()
    const { user, deposer } = await renderApp([], { iaModifieDirectement: true })
    deposer([bruno, chloe])
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

  it("choix enregistré : une proposition déjà là au démarrage reste à relire (elle peut venir d'une autre conversation), sans la case", async () => {
    const [bruno, chloe] = deuxPropositions()
    const { user, deposer } = await renderApp([bruno], { iaModifieDirectement: true })
    const fenetre = await screen.findByRole("dialog", { name: "Proposition de votre IA" })
    expect(noms()).toEqual(["Alice Martin"])
    expect(window.api.retirerProposition).not.toHaveBeenCalled()
    expect(within(fenetre).queryByRole("checkbox")).not.toBeInTheDocument()
    expect(within(fenetre).getByText("L'IA modifie directement la simulation, mais cette proposition attendait déjà : elle reste à valider ici.")).toBeInTheDocument()

    await user.click(within(fenetre).getByRole("button", { name: "Appliquer" }))
    expect(noms()).toEqual(["Alice Martin", "Bruno Durand"])
    // La suivante, arrivée après le démarrage, s'applique seule.
    deposer([chloe])
    await waitFor(() => expect(noms()).toEqual(["Alice Martin", "Bruno Durand", "Chloé Petit"]))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("à l'activation, les propositions qui attendaient restent à relire ; seules les suivantes s'appliquent seules", async () => {
    const [bruno, chloe] = deuxPropositions()
    const dan = propositionRecue(sessionApresLaProposition(initialSession(), bruno.proposition), "Dan Moreau", "c-dan.json")
    const { user, deposer } = await renderApp([bruno, chloe])
    const fenetre = await screen.findByRole("dialog", { name: "Proposition de votre IA" })
    await user.click(within(fenetre).getByRole("checkbox", { name: CASE }))
    await user.click(within(fenetre).getByRole("button", { name: "Appliquer" }))
    expect(pastille()).toBeInTheDocument()

    // Chloé attendait déjà : elle reste dans la fenêtre, bien qu'applicable.
    const suivante = await screen.findByRole("dialog", { name: "Proposition de votre IA" })
    expect(within(suivante).getByText(/cette proposition attendait déjà/)).toBeInTheDocument()
    expect(noms()).toEqual(["Alice Martin", "Bruno Durand"])
    await user.click(within(suivante).getByRole("button", { name: "Refuser" }))

    deposer([dan])
    await waitFor(() => expect(noms()).toEqual(["Alice Martin", "Bruno Durand", "Dan Moreau"]))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("une suppression ne s'applique jamais seule : elle attend dans la fenêtre, sans la case, avec ce qui l'explique", async () => {
    const suppression = propositionDeSuppression("a-suppression.json")
    const { user, deposer } = await renderApp([], { iaModifieDirectement: true })
    deposer([suppression])
    const fenetre = await screen.findByRole("dialog", { name: "Proposition de votre IA" })
    expect(window.api.retirerProposition).not.toHaveBeenCalled()
    expect(within(fenetre).queryByRole("checkbox")).not.toBeInTheDocument()
    expect(within(fenetre).getByText("L'IA modifie directement la simulation, mais une suppression attend toujours votre validation.")).toBeInTheDocument()
    expect(screen.getByText("Loyer perçu", { exact: false, selector: "li" })).toBeInTheDocument()

    await user.click(within(fenetre).getByRole("button", { name: "Appliquer" }))
    expect(window.api.retirerProposition).toHaveBeenCalledWith(suppression.id)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("une proposition périmée reste dans la fenêtre sans retenir les suivantes, appliquées chacune sur la simulation affichée", async () => {
    const perimee = propositionRecue({ ...initialSession(), name: "Version précédente" }, "Zoé Ancienne", "a-perimee.json")
    const [bruno, chloe] = deuxPropositions()
    const { user, deposer } = await renderApp([], { iaModifieDirectement: true })
    deposer([perimee, bruno])
    await waitFor(() => expect(noms()).toEqual(["Alice Martin", "Bruno Durand"]))

    const fenetre = await screen.findByRole("dialog", { name: "Proposition de votre IA" })
    expect(within(fenetre).getByRole("alert")).toHaveTextContent(/Proposition périmée/)
    expect(within(fenetre).queryByRole("checkbox")).not.toBeInTheDocument()
    expect(window.api.retirerProposition).not.toHaveBeenCalledWith(perimee.id)

    // Une autre arrive pendant que la périmée est affichée : elle s'applique quand même.
    deposer([perimee, chloe])
    await waitFor(() => expect(noms()).toEqual(["Alice Martin", "Bruno Durand", "Chloé Petit"]))
    expect(within(screen.getByRole("dialog", { name: "Proposition de votre IA" })).getByRole("alert")).toHaveTextContent(/Proposition périmée/)
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Retirer" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("une proposition arrivée périmée reste à relire, même devenue applicable ensuite", async () => {
    const [bruno, chloe] = deuxPropositions()
    const { user, deposer } = await renderApp([], { iaModifieDirectement: true })
    // Chloé, construite sur la simulation qui a Bruno, arrive avant lui : périmée, elle passe en relecture.
    deposer([chloe])
    expect(within(await screen.findByRole("dialog", { name: "Proposition de votre IA" })).getByRole("alert")).toHaveTextContent(/Proposition périmée/)
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Plus tard" }))
    deposer([chloe, bruno])
    await waitFor(() => expect(noms()).toEqual(["Alice Martin", "Bruno Durand"]))
    // Chloé s'appliquerait maintenant, mais elle a été écartée : elle n'est pas appliquée en silence.
    expect(noms()).toEqual(["Alice Martin", "Bruno Durand"])
    expect(window.api.retirerProposition).not.toHaveBeenCalledWith(chloe.id)
  })

  it("la case des paramètres et la pastille règlent la même préférence", async () => {
    const infos: InfosDuServeurMcp = { executable: "C:\\Simulateur.exe", script: "C:\\mcp\\serveur-mcp.mjs", donnees: "C:\\Donnees", plateforme: "win32" }
    vi.mocked(window.api.infosDuServeurMcp).mockResolvedValue(infos)
    const [bruno] = deuxPropositions()
    const { user, deposer } = await renderApp([])
    await user.click(screen.getByRole("button", { name: "Paramètres" }))
    await user.click(await screen.findByRole("button", { name: "Utiliser avec une IA (MCP)" }))
    const fenetreIA = screen.getByRole("dialog", { name: "Utiliser avec une IA (MCP)" })
    const caseDesParametres = within(fenetreIA).getByRole("checkbox", { name: CASE })
    expect(caseDesParametres).not.toBeChecked()
    expect(caseDesParametres).toHaveAccessibleDescription(
      "Les modifications suivantes de l'IA s'appliquent aussitôt, sans relecture, chacune annulable (Ctrl+Z ou « Annuler ») ; la pastille « IA en direct » le rappelle. Ses suppressions, et les propositions qui attendent déjà, restent à valider."
    )
    await user.click(caseDesParametres)
    expect(caseDesParametres).toBeChecked()
    expect(pastille()).toBeInTheDocument()
    await waitFor(() => expect(preferencesEnregistrees()).toMatchObject({ iaModifieDirectement: true }), { timeout: 3000 })
    await user.keyboard("{Escape}")
    await user.keyboard("{Escape}")

    deposer([bruno])
    await waitFor(() => expect(noms()).toEqual(["Alice Martin", "Bruno Durand"]))

    // La pastille décochée, la case des paramètres l'est aussi.
    await user.click(pastille()!)
    await user.click(screen.getByRole("button", { name: "Paramètres" }))
    await user.click(await screen.findByRole("button", { name: "Utiliser avec une IA (MCP)" }))
    expect(within(screen.getByRole("dialog", { name: "Utiliser avec une IA (MCP)" })).getByRole("checkbox", { name: CASE })).not.toBeChecked()
  })

  it("décocher la pastille revient aux propositions à relire, et l'enregistre", async () => {
    const [bruno] = deuxPropositions()
    const { user, deposer } = await renderApp([], { iaModifieDirectement: true })
    // Une pastille courte dans la barre d'outils ; l'explication complète dans sa description et son info-bulle.
    const caseDeLaPastille = within(screen.getByRole("navigation", { name: "Barre d'outils" })).getByRole("checkbox", { name: "IA en direct" })
    expect(caseDeLaPastille).toBeChecked()
    expect(caseDeLaPastille).toHaveAccessibleDescription("L'IA modifie directement la simulation ; chaque modification reste annulable (Ctrl+Z), et ses suppressions restent à valider. Décochez pour revenir aux propositions.")

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
    const { deposer } = await renderApp([], { iaModifieDirectement: true })
    deposer([bruno, chloe])
    await waitFor(() => expect(noms()).toEqual(["Alice Martin", "Bruno Durand", "Chloé Petit"]))
    // La notification de Bruno : Chloé l'a suivie, son « Annuler » ne touche à rien et renvoie à la barre d'outils.
    const action = actionDe(vi.mocked(toast.success).mock.calls[0][1])
    act(() => action.onClick())
    expect(noms()).toEqual(["Alice Martin", "Bruno Durand", "Chloé Petit"])
    expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/utilisez « Annuler » dans la barre d'outils/))
  })
})
