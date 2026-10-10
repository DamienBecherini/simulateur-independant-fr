// src/ui/components/AffichageResume.test.tsx
// Affichage « Résumé » (proposition A) : choix de l'affichage, barre de résumé, détail replié des résultats,
// verdict et tableau réduit du comparateur, acteurs en lignes.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import type { Affichage, ComparaisonResult, ScenarioStatut, SimulationReport, StatutCompare } from "@/types"
import { emptyReport, emptySession, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { ComparateurDeTest } from "@/ui/testing/comparateur"
import { AffichageContext } from "../hooks/useAffichage"
import { BarreDeResume } from "./BarreDeResume"
import EntitiesManager from "./EntitiesManager"
import { ResultsPanel } from "./ResultsPanel"
import { SelecteurAffichage } from "./SelecteurAffichage"

const espaces = (texte: string) => texte.replace(/\s/g, " ")

function dans(affichage: Affichage, contenu: ReactNode) {
  return <AffichageContext.Provider value={affichage}>{contenu}</AffichageContext.Provider>
}

function scenario(statut: StatutCompare, libelle: string, net: number, autres: Partial<ScenarioStatut> = {}): ScenarioStatut {
  return { statut, libelle, actuel: false, telleQueSaisie: false, ecartDeFrais: { total: 0, postes: {} }, resultatConserveActivite: 0, horsPlafond: false, protectionSociale: { etoiles: 3, trimestres: 4, resume: `Couverture ${libelle}.` }, netApresImpots: net, revenusAvantPrelevements: 50000, totalPrelevements: 50000 - net, cotisationsSociales: 10000, impotSocietes: 0, impotSurLeRevenu: 1000, prelevementsSociaux: 0, resultatConserve: 0, warnings: [], ...autres }
}

/** La micro actuelle est la situation saisie ; la SASU compte 2 050 € de frais de gestion en plus ; le versement libératoire donne le meilleur net. */
function comparaison(): ComparaisonResult {
  const sasu = scenario("SASU", "SASU", 30000, { ecartDeFrais: { total: 2050, postes: { expertComptable: 2000, banque: 100, logiciel: 50, assurance: -100 } } })
  return { scenarios: [sasu, scenario("micro", "Micro-entreprise", 32000, { actuel: true, telleQueSaisie: true }), scenario("micro-vfl", "Micro + versement libératoire", 35000)], meilleur: "micro-vfl", situationSaisie: { statut: "micro", libelle: "Micro-entreprise", netApresImpots: 32000 }, couples: [], warnings: [] }
}

function report(): SimulationReport {
  const vide = emptyReport()
  const foyer = { personIds: ["person-alice"], totalParts: 1, revenusEncaisses: 80000, revenuImposableGlobal: 70000, revenuFiscalDeReference: 70000, impotSurLeRevenu: 12600, prelevementsSociaux: 0, optionDividendes: null, netApresImpots: 67400, revenusAvantPrelevements: 100000, totalPrelevements: 32600, resultatConserve: 0, depenses: 0, warnings: [] }
  return { ...vide, annee: 2026, foyers: [foyer], bilan: { ...vide.bilan, chiffreAffaires: 100000, revenusAvantPrelevements: 100000, cotisationsSociales: 20000, impotSurLeRevenu: 12600, totalPrelevements: 32600 }, totalNetApresImpots: 67400 }
}

const session = () => ({ ...emptySession(), entities: [makePerson(), makeMicro({ name: "Mon atelier" })] })

describe("choix de l'affichage", () => {
  it("propose les trois affichages, tous disponibles, « Résumé » d'abord, et transmet le choix", async () => {
    const onChange = vi.fn()
    render(<SelecteurAffichage affichage="classique" onChange={onChange} />)
    await userEvent.click(screen.getByRole("combobox", { name: "Affichage : Classique" }))

    expect(await screen.findByText("Bêta : dites-nous quel affichage vous préférez.")).toBeInTheDocument()
    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["Résumé", "Classique", "Trois vues"])
    for (const option of screen.getAllByRole("option")) expect(option).not.toHaveAttribute("aria-disabled")
    await userEvent.click(screen.getByRole("option", { name: "Résumé" }))
    expect(onChange).toHaveBeenCalledWith("resume")
  })
})

describe("barre de résumé", () => {
  it("affiche le net, le taux, le meilleur statut et les alertes, chacun lié à son détail", () => {
    render(<BarreDeResume report={report()} annees={[2026]} annee={2026} onAnnee={() => {}} comparaison={{ activite: "Mon atelier", result: comparaison() }} />)
    const barre = screen.getByRole("region", { name: "Résumé de l'année" })

    expect(within(barre).getByRole("link", { name: /Net du foyer.*67.400.€.*voir le détail/ })).toHaveAttribute("href", "#bilan")
    expect(within(barre).getByRole("link", { name: /Prélèvements.*32,6.%/ })).toHaveAttribute("href", "#bilan")
    expect(espaces(within(barre).getByRole("link", { name: /Meilleur statut pour « Mon atelier »/ }).textContent ?? "")).toContain("Micro + versement libératoire, +3 000 €")
    expect(within(barre).getByRole("link", { name: /Alertes.*0/ })).toHaveAttribute("href", "#resultats-titre")
    expect(barre).toHaveTextContent("2026")
  })

  it("propose de changer d'année quand la session en compte plusieurs", async () => {
    const onAnnee = vi.fn()
    render(<BarreDeResume report={report()} annees={[2026, 2027]} annee={2026} onAnnee={onAnnee} comparaison={null} />)
    await userEvent.click(screen.getByRole("combobox", { name: "Année affichée" }))
    await userEvent.click(await screen.findByRole("option", { name: "2027" }))
    expect(onAnnee).toHaveBeenCalledWith(2027)
  })
})

describe("résultats dans l'affichage « Résumé »", () => {
  it("garde le net et le taux visibles, replie le détail du calcul et place la synthèse sous le bilan", () => {
    const { container } = render(dans("resume", <ResultsPanel report={report()} error={null} apresLeBilan={<p>Synthèse des années</p>} />))
    const resume = within(container)
    expect(resume.getByText("Détail du calcul")).toBeVisible()
    expect(resume.getByText("Cotisations sociales des activités").closest("details")).not.toHaveAttribute("open")
    expect(resume.getByText("Synthèse des années")).toBeInTheDocument()
  })

  it("reste entièrement déplié dans l'affichage classique", () => {
    render(dans("classique", <ResultsPanel report={report()} error={null} />))
    expect(screen.queryByText("Détail du calcul")).not.toBeInTheDocument()
    expect(screen.getByText("Cotisations sociales des activités").closest("details")).toBeNull()
  })
})

describe("comparateur dans l'affichage « Résumé »", () => {
  it("donne le verdict, réduit le tableau au net, à l'écart et à la protection, et montre le reste à la demande", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparaison())
    render(dans("resume", <ComparateurDeTest annee={2026} session={session()} />))

    expect(espaces((await screen.findByText(/^Pour « Mon atelier »/)).textContent ?? "")).toBe("Pour « Mon atelier », Micro + versement libératoire donnerait le meilleur net : 35 000 €, soit +3 000 € par rapport à votre situation telle que saisie (Micro-entreprise, 32 000 €).")
    const table = screen.getByRole("table", { name: "Comparaison des statuts" })
    const lignes = within(table).getAllByRole("row").map(ligne => within(ligne).queryByRole("rowheader")?.textContent)
    expect(lignes.slice(1, 4)).toEqual(["Net dans la poche", "Écart avec votre situation actuelle", "Protection sociale"])
    // Les autres lignes sont masquées à l'écran (classe `hidden`), affichées à l'impression.
    expect(within(table).getByRole("rowheader", { name: "Impôt sur le revenu" }).closest("tbody")).toHaveClass("hidden", "print:table-row-group")

    const detail = screen.getByRole("button", { name: /Voir le détail/ })
    expect(detail).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(detail)
    expect(screen.getByRole("button", { name: "Masquer le détail" })).toHaveAttribute("aria-expanded", "true")
    expect(within(table).getByRole("rowheader", { name: "Impôt sur le revenu" }).closest("tbody")).not.toHaveClass("hidden")
    // Sur téléphone, une carte par statut, triées par net.
    const cartes = within(screen.getByRole("list", { name: "Net dans la poche selon le statut" })).getAllByRole("listitem")
    expect(cartes.map(carte => carte.querySelector("p")?.textContent)).toEqual(["Micro + versement libératoire", "Micro-entreprise", "SASU"])
  })

  it("garde le tableau complet, sans verdict, dans l'affichage classique", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparaison())
    render(dans("classique", <ComparateurDeTest annee={2026} session={session()} />))
    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    expect(within(table).getByRole("rowheader", { name: "Impôt sur le revenu" })).toBeVisible()
    expect(screen.queryByText(/^Pour « Mon atelier »/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Voir le détail/ })).not.toBeInTheDocument()
  })

  it.each(["classique", "resume"] as const)("affichage %s : écrit l'écart de frais de gestion dans la cellule du net, et rappelle que les frais réels sont dans la grille", async affichage => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue(comparaison())
    render(dans(affichage, <ComparateurDeTest annee={2026} session={session()} />))
    const table = await screen.findByRole("table", { name: "Comparaison des statuts" })
    // La colonne actuelle est la situation saisie : aucune mention de frais supposés.
    expect(within(table).getByRole("columnheader", { name: /^Micro-entreprise\s*actuel$/ })).toBeInTheDocument()
    const net = within(table).getByRole("rowheader", { name: "Net dans la poche" }).closest("tr")!
    const cellules = within(net).getAllByRole("cell")
    expect(espaces(cellules[0].textContent ?? "")).toContain("30 000 €dont environ 2 050 € de frais de gestion en plus qu'en micro-entreprise")
    expect(cellules[1]).toHaveTextContent(/^32.000.€$/)
    expect(screen.getByText(/^Vos frais réels sont ceux que vous avez saisis dans la grille/)).toBeInTheDocument()
  })
})

describe("acteurs dans l'affichage « Résumé »", () => {
  it("présente chaque acteur sur une ligne : nom modifiable, type, relations et commandes", async () => {
    const setSession = vi.fn()
    const avecRelation = { ...session(), relationships: [{ id: "r", fromId: "person-alice", toId: "micro-atelier", type: "Titulaire" as const }] }
    render(dans("resume", <EntitiesManager session={avecRelation} setSession={setSession} annee={2026} />))

    expect(screen.getByText("Personne · 1 part")).toBeInTheDocument()
    expect(screen.getByText("Micro-entreprise")).toBeInTheDocument()
    expect(screen.getAllByText("1 relation")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Supprimer la relation avec Mon atelier" })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Versement libératoire" })).toBeInTheDocument()

    const nom = screen.getAllByRole("textbox", { name: "Nom" })[0]
    await userEvent.clear(nom)
    await userEvent.type(nom, "Alice Durand{Enter}")
    expect(setSession).toHaveBeenLastCalledWith(expect.objectContaining({ entities: expect.arrayContaining([expect.objectContaining({ name: "Alice Durand" })]) }))

    await userEvent.click(screen.getByRole("button", { name: "Supprimer « Mon atelier »" }))
    expect(setSession).toHaveBeenLastCalledWith(expect.objectContaining({ entities: [expect.objectContaining({ id: "person-alice" })] }))
  })
})
