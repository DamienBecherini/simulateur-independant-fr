// src/ui/App.panneaux.test.tsx
// Affichage « Panneaux » (proposition C) : le panneau d'un acteur s'ouvre depuis la liste, la grille ou les
// résultats, rend le focus en se fermant, applique les modifications à mesure (une étape d'annulation chacune),
// suit l'année affichée et se ferme quand l'acteur disparaît.

import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { grilleVide, type SessionState } from "@/types"
import { emptyReport, emptySession, makeMicro, makePerson } from "@/ui/testing/fixtures"
import App from "./App"

function session(): SessionState {
  return { ...emptySession(), name: "Simulation de test", entities: [makePerson(), makeMicro()], annees: [{ annee: 2025, monthlyData: grilleVide() }, { annee: 2026, monthlyData: grilleVide() }] }
}

async function renderApp(affichage: "panneaux" | "resume" = "panneaux") {
  vi.mocked(window.api.getCurrentSession).mockResolvedValue(session())
  vi.mocked(window.api.getUserPreferences).mockResolvedValue({ slotOrder: [], affichage })
  render(<App />)
  await screen.findByRole("heading", { name: "Simulation de test" })
}

const liste = () => screen.getByRole("list", { name: "Acteurs de la Simulation" })
const panneau = (nom: string) => screen.queryByRole("complementary", { name: nom })
const annuler = () => screen.getByRole("button", { name: "Annuler" })

async function ouvrirDepuisLaListe(nom: RegExp) {
  const bouton = within(liste()).getByRole("button", { name: nom })
  await userEvent.click(bouton)
  return bouton
}

describe("App : affichage « Panneaux »", () => {
  it("liste les acteurs en bref ; choisir l'un d'eux ouvre son panneau et y mène le focus", async () => {
    await renderApp()
    const bouton = await ouvrirDepuisLaListe(/^Mon atelier/)

    expect(panneau("Mon atelier")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: "Mon atelier" })).toHaveFocus()
    expect(bouton).toHaveAttribute("aria-expanded", "true")
    expect(bouton).toHaveAttribute("aria-controls", "panneau-acteur")
    // Le panneau n'est pas modal : la page reste utilisable.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("Échap ferme le panneau et rend le focus à l'acteur qui l'a ouvert", async () => {
    await renderApp()
    const bouton = await ouvrirDepuisLaListe(/^Mon atelier/)
    await userEvent.keyboard("{Escape}")

    expect(panneau("Mon atelier")).not.toBeInTheDocument()
    expect(bouton).toHaveFocus()
    expect(bouton).toHaveAttribute("aria-expanded", "false")
  })

  it("le bouton de fermeture rend lui aussi le focus ; choisir de nouveau l'acteur referme son panneau", async () => {
    await renderApp()
    const bouton = await ouvrirDepuisLaListe(/^Alice Martin/)
    await userEvent.click(screen.getByRole("button", { name: "Fermer le panneau" }))
    expect(panneau("Alice Martin")).not.toBeInTheDocument()
    expect(bouton).toHaveFocus()

    await userEvent.click(bouton)
    expect(panneau("Alice Martin")).toBeInTheDocument()
    await userEvent.click(bouton)
    expect(panneau("Alice Martin")).not.toBeInTheDocument()
  })

  it("s'ouvre aussi depuis le nom de l'acteur dans la grille, et passe d'un acteur à l'autre", async () => {
    await renderApp()
    await ouvrirDepuisLaListe(/^Alice Martin/)
    // Deux boutons « Mon atelier » : celui de la liste, puis celui de la grille.
    const [, dansLaGrille] = screen.getAllByRole("button", { name: /^Mon atelier.*réglages et résultats/ })
    await userEvent.click(dansLaGrille)

    expect(panneau("Alice Martin")).not.toBeInTheDocument()
    expect(panneau("Mon atelier")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: "Mon atelier" })).toHaveFocus()
    await userEvent.keyboard("{Escape}")
    expect(dansLaGrille).toHaveFocus()
  })

  it("s'ouvre depuis le nom d'une activité dans les résultats", async () => {
    const rapport = { ...emptyReport(), annee: 2026, activities: [{ entityId: "micro-atelier", name: "Mon atelier", type: "micro-entreprise", statut: "Micro-entreprise", chiffreAffaires: 40000, charges: 0, cotisationsSociales: 9000, impotSocietes: 0, resultatConserve: 0, revenuVerse: 31000, beneficiaireIds: ["person-alice"], warnings: [] }] }
    vi.mocked(window.api.simulerLesAnnees).mockImplementation(async s => ({ annees: s.annees.map(({ annee }) => ({ annee, report: { ...rapport, annee } as never, erreur: null })) }))
    await renderApp()
    const activites = await screen.findByRole("list", { name: "Par activité" })
    await userEvent.click(within(activites).getByRole("button", { name: /^Mon atelier/ }))

    const ouvert = panneau("Mon atelier")
    expect(ouvert).toBeInTheDocument()
    expect(within(ouvert!).getByText("31 000 €", { normalizer: t => t.replace(/\s/g, " ") })).toBeInTheDocument()
  })

  it("un interrupteur s'applique aussitôt, en une étape d'annulation", async () => {
    await renderApp()
    await ouvrirDepuisLaListe(/^Mon atelier/)
    expect(annuler()).toBeDisabled()
    const acre = within(panneau("Mon atelier")!).getByRole("switch", { name: /ACRE/ })
    await userEvent.click(acre)

    expect(acre).toBeChecked()
    expect(annuler()).toBeEnabled()
    await userEvent.click(annuler())
    expect(within(panneau("Mon atelier")!).getByRole("switch", { name: /ACRE/ })).not.toBeChecked()
    expect(annuler()).toBeDisabled()
  })

  it("une saisie s'applique en quittant le champ, en une seule étape d'annulation ; Échap l'annule sans fermer le panneau", async () => {
    await renderApp()
    await ouvrirDepuisLaListe(/^Alice Martin/)
    const parts = within(panneau("Alice Martin")!).getByLabelText("Parts propres")
    await userEvent.clear(parts)
    await userEvent.type(parts, "2")
    // Pendant la frappe, rien n'est encore enregistré.
    expect(annuler()).toBeDisabled()
    await userEvent.tab()
    expect(within(liste()).getByRole("button", { name: /^Alice Martin/ })).toHaveTextContent("2 parts")
    await userEvent.click(annuler())
    expect(annuler()).toBeDisabled()

    const nom = within(panneau("Alice Martin")!).getByLabelText("Nom")
    await userEvent.type(nom, " Durand")
    await userEvent.keyboard("{Escape}")
    expect(nom).toHaveValue("Alice Martin")
    expect(panneau("Alice Martin")).toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
    expect(panneau("Alice Martin")).not.toBeInTheDocument()
  })

  it("Entrée valide un nouveau nom, que suivent le titre du panneau et la liste", async () => {
    await renderApp()
    await ouvrirDepuisLaListe(/^Alice Martin/)
    const nom = within(panneau("Alice Martin")!).getByLabelText("Nom")
    await userEvent.clear(nom)
    await userEvent.type(nom, "Alice Durand{Enter}")

    expect(panneau("Alice Durand")).toBeInTheDocument()
    expect(within(liste()).getByRole("button", { name: /^Alice Durand/ })).toBeInTheDocument()
  })

  it("reste ouvert sur le même acteur quand l'année affichée change", async () => {
    await renderApp()
    await ouvrirDepuisLaListe(/^Mon atelier/)
    await userEvent.click(screen.getByRole("combobox", { name: "Année affichée" }))
    await userEvent.click(await screen.findByRole("option", { name: "2025" }))

    expect(screen.getByRole("combobox", { name: "Année affichée" })).toHaveTextContent("2025")
    expect(panneau("Mon atelier")).toBeInTheDocument()
  })

  it("se ferme quand l'acteur est supprimé, et le focus revient à la liste des acteurs", async () => {
    await renderApp()
    await ouvrirDepuisLaListe(/^Mon atelier/)
    await userEvent.click(screen.getByRole("button", { name: "Supprimer « Mon atelier »" }))

    expect(panneau("Mon atelier")).not.toBeInTheDocument()
    expect(within(liste()).queryByRole("button", { name: /^Mon atelier/ })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Acteurs de la Simulation" })).toHaveFocus()
    // L'annulation rend l'acteur, sans rouvrir son panneau.
    await userEvent.click(annuler())
    expect(within(liste()).getByRole("button", { name: /^Mon atelier/ })).toBeInTheDocument()
    expect(panneau("Mon atelier")).not.toBeInTheDocument()
  })

  it("« Comparer ses statuts » choisit l'activité dans le comparateur et y mène le focus", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(rappel => {
      rappel(0)
      return 0
    })
    Element.prototype.scrollIntoView = vi.fn()
    await renderApp()
    await ouvrirDepuisLaListe(/^Mon atelier/)
    await act(async () => userEvent.click(screen.getByRole("button", { name: /Comparer ses statuts/ })))

    expect(await screen.findByRole("heading", { name: "Comparateur de statuts" })).toHaveFocus()
    expect(screen.getByRole("combobox", { name: "Activité comparée" })).toHaveTextContent("Mon atelier")
  })

  it("prépare pour l'impression les réglages de chaque acteur, que le panneau ne montre qu'à l'écran", async () => {
    await renderApp()
    expect(screen.getByText(/Parts propres : 1 · Frais sur les salaires : déduction de 10 %/)).toHaveClass("text-slate-600")
    expect(screen.getByText(/ACRE : non · Versement libératoire : non · RFR N-2 : non renseigné/).closest("ul")).toHaveClass("hidden", "print:block")
  })

  it("n'existe pas dans l'affichage « Résumé » : les acteurs y restent en lignes", async () => {
    await renderApp("resume")
    expect(screen.queryByRole("list", { name: "Acteurs de la Simulation" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /réglages et résultats/ })).not.toBeInTheDocument()
  })
})
