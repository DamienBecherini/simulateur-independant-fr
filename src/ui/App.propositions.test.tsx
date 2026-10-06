// src/ui/App.propositions.test.tsx
// Propositions d'un client d'IA reçues par la boîte aux propositions (voir l'ADR 011), sur l'application entière :
// la fenêtre de relecture montre le récapitulatif, le résumé et l'effet sur le net ; « Appliquer » fait une seule étape
// d'annulation, « Refuser » ne change rien, une proposition périmée ou refusée ne peut que se retirer.

import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { SessionState } from "@/types"
import type { PropositionRecue } from "@/backend/mcp/proposition-en-attente"
import { executerOutil } from "@/backend/logic/outils/catalogue"
import { emptySession, makeFlow, makePerson } from "@/ui/testing/fixtures"
import App from "./App"

function initialSession(): SessionState {
  const session = emptySession()
  session.name = "Simulation de test"
  session.entities = [makePerson()]
  session.annees[0].monthlyData[0].flows = [makeFlow({ id: "flow-janvier", label: "Loyer perçu", amount: 1000 })]
  return session
}

/** Une proposition reçue, construite par l'outil sur une session donnée. */
function propositionRecue(session: SessionState, id = "2026-10-06T08-30-00-000Z-abc.json"): PropositionRecue {
  const reponse = executerOutil("proposer_acteur", session, { genre: "personne", nom: "Bruno Durand" })
  if (!reponse.ok) throw new Error(reponse.erreur)
  const { proposition } = reponse.resultat as { proposition: PropositionRecue["proposition"] }
  return { id, creeeLe: "2026-10-06T08:30:00.000Z", proposition }
}

async function renderApp(propositions: PropositionRecue[]) {
  vi.mocked(window.api.getCurrentSession).mockResolvedValue(initialSession())
  vi.mocked(window.api.getUserPreferences).mockResolvedValue({ slotOrder: [], affichage: "classique" })
  vi.mocked(window.api.propositionsEnAttente).mockResolvedValue(propositions)
  const user = userEvent.setup({ delay: null })
  render(<App />)
  // Une fenêtre ouverte masque le reste de la page aux technologies d'assistance : on cherche le titre par son texte.
  await screen.findByText("Simulation de test", { selector: "h1" })
  return user
}

const noms = () => screen.queryAllByRole("textbox", { name: "Nom", hidden: true }).map(champ => (champ as HTMLInputElement).value)
const undoButton = () => screen.getByRole("button", { name: "Annuler" })

describe("App : propositions d'un client d'IA", () => {
  it("montre la proposition, l'applique en une seule étape d'annulation et la retire de la boîte", async () => {
    const recue = propositionRecue(initialSession())
    const user = await renderApp([recue])

    const fenetre = await screen.findByRole("dialog", { name: "Proposition de votre IA" })
    expect(within(fenetre).getByText(/Ajouter 1 acteur \?/)).toBeInTheDocument()
    expect(within(fenetre).getByText(/Ajouter l'acteur « Bruno Durand » \(personne/)).toBeInTheDocument()
    expect(within(fenetre).getByRole("table", { name: /Net après impôts des foyers/ })).toBeInTheDocument()
    expect(within(fenetre).getByRole("rowheader", { name: "2026" })).toBeInTheDocument()
    expect(noms()).toEqual(["Alice Martin"])

    await user.click(within(fenetre).getByRole("button", { name: "Appliquer" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(noms()).toEqual(["Alice Martin", "Bruno Durand"])
    expect(window.api.retirerProposition).toHaveBeenCalledWith(recue.id)

    // Une seule étape : « Annuler » revient à la session d'avant, puis plus rien à annuler.
    await user.click(undoButton())
    expect(noms()).toEqual(["Alice Martin"])
    expect(undoButton()).toBeDisabled()
  })

  it("refuser ne change rien et retire la proposition", async () => {
    const recue = propositionRecue(initialSession())
    const user = await renderApp([recue])
    const fenetre = await screen.findByRole("dialog", { name: "Proposition de votre IA" })
    await user.click(within(fenetre).getByRole("button", { name: "Refuser" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(noms()).toEqual(["Alice Martin"])
    expect(undoButton()).toBeDisabled()
    expect(window.api.retirerProposition).toHaveBeenCalledWith(recue.id)
  })

  it("montre une proposition périmée sans permettre de l'appliquer", async () => {
    const recue = propositionRecue({ ...initialSession(), name: "Version précédente" })
    const user = await renderApp([recue])
    const fenetre = await screen.findByRole("dialog", { name: "Proposition de votre IA" })
    expect(within(fenetre).getByRole("alert")).toHaveTextContent(/Proposition périmée\..*\(1 opération\)/)
    expect(within(fenetre).queryByRole("button", { name: "Appliquer" })).not.toBeInTheDocument()
    await user.click(within(fenetre).getByRole("button", { name: "Retirer" }))
    expect(window.api.retirerProposition).toHaveBeenCalledWith(recue.id)
    expect(noms()).toEqual(["Alice Martin"])
  })

  it("montre le motif d'une proposition que le simulateur refuse", async () => {
    const session = initialSession()
    const recue = propositionRecue(session)
    const fluxInconnu = { type: "ajouter_flux" as const, annee: 2026, acteurId: "acteur-inconnu", typeFlux: "salary" as const, libelle: "Salaire", montant: 100, mois: [1] }
    await renderApp([{ ...recue, proposition: { ...recue.proposition, operations: [fluxInconnu] } }])
    const fenetre = await screen.findByRole("dialog", { name: "Proposition de votre IA" })
    expect(within(fenetre).getByRole("alert")).toHaveTextContent(/Proposition refusée par le simulateur\..*acteur-inconnu/)
    expect(within(fenetre).queryByRole("button", { name: "Appliquer" })).not.toBeInTheDocument()
  })

  it("« Plus tard » garde la proposition dans la boîte et passe à la suivante", async () => {
    const premiere = propositionRecue(initialSession(), "a.json")
    const seconde = propositionRecue(initialSession(), "b.json")
    const user = await renderApp([premiere, seconde])
    const fenetre = await screen.findByRole("dialog", { name: "Proposition de votre IA" })
    expect(within(fenetre).getByText(/1 sur 2 en attente/)).toBeInTheDocument()
    await user.click(within(fenetre).getByRole("button", { name: "Plus tard" }))
    const suivante = await screen.findByRole("dialog", { name: "Proposition de votre IA" })
    expect(within(suivante).queryByText(/en attente/)).not.toBeInTheDocument()
    await user.click(within(suivante).getByRole("button", { name: "Plus tard" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(window.api.retirerProposition).not.toHaveBeenCalled()
  })

  it("affiche une proposition déposée pendant que l'application tourne", async () => {
    let transmettre: (propositions: PropositionRecue[]) => void = () => undefined
    vi.mocked(window.api.onPropositionsEnAttente).mockImplementation(rappel => {
      transmettre = rappel
      return () => undefined
    })
    await renderApp([])
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    act(() => transmettre([propositionRecue(initialSession())]))
    expect(await screen.findByRole("dialog", { name: "Proposition de votre IA" })).toBeInTheDocument()
  })
})
