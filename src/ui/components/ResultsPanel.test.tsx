// src/ui/components/ResultsPanel.test.tsx

import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { FoyerFiscalResult, PersonResult, SalarieDeLActivite, SimulationReport } from "@/types"
import { emptyReport } from "@/ui/testing/fixtures"
import { ResultsPanel } from "./ResultsPanel"

/**
 * Formatage attendu d'un montant (« 12 345 € ») et d'un pourcentage (« 34 % »). Le français sépare par des espaces
 * insécables, que les requêtes de Testing Library ramènent à des espaces simples : on fait de même.
 */
const normalize = (text: string) => text.replace(/\s+/g, " ")
const money = (amount: number) => normalize(`${amount.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`)
const percent = (ratio: number) => normalize(ratio.toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 1 }))

function makePersonResult(entityId: string, name: string, salaires: number): PersonResult {
  return {
    entityId,
    name,
    revenusDirects: salaires,
    revenusActivites: 0,
    detail: { salaires, allocationsChomage: 0, autresRevenus: 0, remunerationsDirigeant: 0, dividendes: 0, benefices: 0 },
    cotisationsSalariales: 0,
    depenses: 0
  }
}

function makeFoyer(personId: string, overrides: Partial<FoyerFiscalResult> = {}): FoyerFiscalResult {
  return {
    personIds: [personId],
    totalParts: 1,
    revenusEncaisses: 30000,
    revenuImposableGlobal: 27000,
    revenuFiscalDeReference: 27000,
    impotSurLeRevenu: 2000,
    prelevementsSociaux: 0,
    optionDividendes: null,
    netApresImpots: 28000,
    revenusAvantPrelevements: 40000,
    totalPrelevements: 12000,
    resultatConserve: 0,
    depenses: 0,
    warnings: [],
    ...overrides
  }
}

/**
 * Rapport fixe : Alice dirige une SASU qui conserve 10 000 € de bénéfice, Bob est salarié.
 * Revenus avant prélèvements 100 000 € = prélèvements 34 000 € + conservé 10 000 € + net 56 000 €.
 */
function makeReport(): SimulationReport {
  return {
    ...emptyReport(),
    annee: 2025,
    bilan: {
      chiffreAffaires: 80000,
      charges: 10000,
      revenusDirects: 28000,
      cotisationsSalariales: 2000,
      revenusAvantPrelevements: 100000,
      cotisationsSociales: 20000,
      impotSocietes: 2000,
      impotSurLeRevenu: 10000,
      prelevementsSociaux: 0,
      totalPrelevements: 34000,
      resultatConserve: 10000,
      nonRattache: 0
    },
    activities: [
      {
        entityId: "company-sasu",
        name: "Ma SASU",
        type: "company",
        statut: "SASU",
        chiffreAffaires: 80000,
        charges: 10000,
        cotisationsSociales: 20000,
        impotSocietes: 2000,
        revenuVerse: 38000,
        resultatConserve: 10000,
        beneficiaireIds: ["person-alice"],
        warnings: ["Rémunération inférieure au seuil de validation de trimestres."]
      }
    ],
    persons: [makePersonResult("person-alice", "Alice Martin", 0), makePersonResult("person-bob", "Bob Durand", 28000)],
    foyers: [makeFoyer("person-alice", { revenusAvantPrelevements: 70000, totalPrelevements: 24000, resultatConserve: 10000, netApresImpots: 36000 }), makeFoyer("person-bob", { netApresImpots: 20000 })],
    totalNetApresImpots: 56000
  }
}

/** Valeur affichée en face d'un libellé de ligne (`<dt>` / `<dd>`), dans un conteneur donné. */
function rowValue(container: HTMLElement, label: string) {
  const term = within(container).getByText(label, { selector: "dt" })
  return term.nextElementSibling as HTMLElement
}

describe("ResultsPanel", () => {
  it("invite à ajouter une entité quand le rapport est vide", () => {
    render(<ResultsPanel report={emptyReport()} error={null} />)
    expect(screen.getByText("Ajoutez une personne ou une activité pour voir les résultats.")).toBeInTheDocument()
  })

  it("donne l'année simulée, celle des règles appliquées, et les avertissements de l'année", () => {
    const avertissement = "Les règles de 2027 ne sont pas encore connues : 2027 est simulée avec celles de 2026."
    render(<ResultsPanel report={{ ...emptyReport(), annee: 2027, anneeDesRegles: 2026, avertissements: [avertissement] }} error={null} />)

    expect(screen.getByText(/année 2027 avec les règles fiscales 2026/)).toBeInTheDocument()
    expect(screen.getByRole("listitem")).toHaveTextContent(avertissement)
  })

  it("donne le revenu fiscal de référence de chaque foyer", () => {
    render(<ResultsPanel report={makeReport()} error={null} />)

    const carte = screen.getAllByRole("article").find(a => a.textContent?.includes("Bob Durand"))!
    expect(rowValue(carte, "Revenu fiscal de référence")).toHaveTextContent(`${money(27000)}pour le versement libératoire dans deux ans`)
  })

  it.each([
    ["calcule", true, "votre RFR 2024 de 29 040 €, calculé par la simulation, y donne accès"],
    ["saisi", false, "votre RFR 2024 de 29 040 €, saisi dans la fiche, le dépasse"]
  ] as const)("dit d'où vient le revenu fiscal de référence du versement libératoire (%s)", (origineRfr, eligible, attendu) => {
    const report = makeReport()
    report.activities = [{ ...report.activities[0], type: "micro-entreprise", statut: "Micro-entreprise", versementLiberatoire: { plafondRfr: 29315, partsFiscales: 1, rfrN2: 29040, anneeRfr: 2024, origineRfr, eligible, applique: eligible } }]
    render(<ResultsPanel report={report} error={null} />)

    expect(normalize(screen.getByText(/^Versement libératoire$/).parentElement!.textContent!)).toContain(normalize(attendu))
  })

  it("invite à ajouter l'année N-2 quand le revenu fiscal de référence est inconnu", () => {
    const report = makeReport()
    report.activities = [{ ...report.activities[0], versementLiberatoire: { plafondRfr: 29315, partsFiscales: 1, rfrN2: null, anneeRfr: 2024, origineRfr: null, eligible: null, applique: false } }]
    render(<ResultsPanel report={report} error={null} />)

    expect(screen.getByText(/RFR 2024 inconnu : ajoutez l'année 2024 à la simulation/)).toBeInTheDocument()
  })

  it("affiche l'erreur de simulation", () => {
    render(<ResultsPanel report={null} error="Entrée invalide" />)
    expect(screen.getByText("Entrée invalide")).toBeInTheDocument()
  })

  it("présente le bilan : net dans la poche, taux global et répartition", () => {
    render(<ResultsPanel report={makeReport()} error={null} />)

    expect(screen.getByText(/règles fiscales 2025/)).toBeInTheDocument()
    expect(screen.getByText(`${percent(0.56)} des revenus`)).toBeInTheDocument()
    expect(screen.getByText("Taux global de prélèvement").nextElementSibling).toHaveTextContent(percent(0.34))
    expect(screen.getByRole("img", { name: "Répartition des revenus avant prélèvements" })).toBeInTheDocument()

    const bilan = screen.getByText("Taux global de prélèvement").closest("div.rounded-lg") as HTMLElement
    expect(rowValue(bilan, "Revenus avant prélèvements")).toHaveTextContent(money(100000))
    expect(rowValue(bilan, "Cotisations salariales")).toHaveTextContent(`− ${money(2000)}`)
    expect(rowValue(bilan, "Impôt sur les sociétés")).toHaveTextContent(`− ${money(2000)}`)
    expect(rowValue(bilan, "Conservé dans les sociétés")).toHaveTextContent(money(10000))
    // Sans dividendes, la ligne des prélèvements sociaux n'apparaît pas.
    expect(within(bilan).queryByText("Prélèvements sociaux sur dividendes")).not.toBeInTheDocument()
  })

  it("explique que le bénéfice conservé n'a pas encore payé l'impôt personnel", () => {
    render(<ResultsPanel report={makeReport()} error={null} />)
    expect(screen.getByText(/Le bénéfice conservé dans une société a payé l'impôt sur les sociétés/)).toBeInTheDocument()
  })

  it("n'affiche pas cette note sans bénéfice conservé", () => {
    const report = makeReport()
    report.bilan = { ...report.bilan, resultatConserve: 0 }
    render(<ResultsPanel report={report} error={null} />)
    expect(screen.queryByText(/Le bénéfice conservé dans une société/)).not.toBeInTheDocument()
  })

  it("affiche une carte par foyer, avec son taux de prélèvement quand il y a plusieurs foyers", () => {
    render(<ResultsPanel report={makeReport()} error={null} />)

    const cards = screen.getAllByRole("article")
    const alice = cards.find(card => within(card).queryByText("Alice Martin"))!
    const bob = cards.find(card => within(card).queryByText("Bob Durand"))!

    expect(within(bob).getByText("Foyer fiscal · 1 part")).toBeInTheDocument()
    expect(rowValue(bob, "Salaires")).toHaveTextContent(money(28000))
    expect(rowValue(bob, "Net après impôts")).toHaveTextContent(money(20000))
    expect(rowValue(alice, "Prélèvements du foyer")).toHaveTextContent(`${money(24000)}${percent(24000 / 70000)}`)
    expect(rowValue(alice, "Sa part conservée en société")).toHaveTextContent(money(10000))
  })

  it("n'explique le partage à parts égales que pour une société à plusieurs associés", () => {
    const report = makeReport()
    render(<ResultsPanel report={report} error={null} />)
    expect(screen.queryByText(/partagés à parts égales entre les associés/)).not.toBeInTheDocument()
  })

  it("nomme la société dont les revenus sont partagés entre plusieurs associés", () => {
    const report = makeReport()
    report.activities = [{ ...report.activities[0], beneficiaireIds: ["person-alice", "person-bob"] }]
    render(<ResultsPanel report={report} error={null} />)
    expect(screen.getByText(/« Ma SASU » : l'impôt sur les sociétés et le bénéfice conservé sont partagés à parts égales entre les associés/)).toBeInTheDocument()
  })

  it("n'affiche pas de taux par foyer quand il n'y a qu'un foyer", () => {
    const report = makeReport()
    report.foyers = [report.foyers[1]]
    render(<ResultsPanel report={report} error={null} />)

    expect(screen.getByText("Bob Durand")).toBeInTheDocument()
    expect(screen.queryByText("Prélèvements du foyer")).not.toBeInTheDocument()
  })

  it("détaille chaque activité et ses avertissements", () => {
    render(<ResultsPanel report={makeReport()} error={null} />)

    const card = screen.getAllByRole("article").find(article => within(article).queryByText("Ma SASU"))!
    expect(rowValue(card, "Charges déductibles")).toHaveTextContent(`− ${money(10000)}`)
    expect(rowValue(card, "Conservé dans la société")).toHaveTextContent(money(10000))
    expect(rowValue(card, "Versé avant impôt sur le revenu")).toHaveTextContent(`${money(38000)}48 % du CA`)
    expect(within(card).getByRole("listitem")).toHaveTextContent("Rémunération inférieure au seuil de validation de trimestres.")
    expect(within(card).queryByText(/Coût employeur/)).not.toBeInTheDocument()
  })

  it("affiche le coût de la rémunération du président et celui des salariés", () => {
    // Seuls les montants affichés sont renseignés.
    const bulletin = (personId: string, brut: number, totalPatronal: number, reductionGenerale: number) =>
      ({ personId, statut: "salarie", brut, totalPatronal, reductionGenerale, coutEmployeur: brut + totalPatronal - reductionGenerale }) as SalarieDeLActivite
    const report = makeReport()
    const sasu = report.activities[0]
    const president = { ...bulletin("person-alice", 20000, 7000, 0), statut: "president" as const }
    report.activities = [{ ...sasu, cotisationsPresident: president, salaries: [bulletin("person-bob", 30000, 12000, 6000)] }]
    const { rerender } = render(<ResultsPanel report={report} error={null} />)

    const card = screen.getAllByRole("article").find(article => within(article).queryByText("Ma SASU"))!
    expect(rowValue(card, "Coût de la rémunération du président")).toHaveTextContent(`${money(27000)}dont ${money(20000)} bruts`)
    expect(rowValue(card, "Coût employeur du salarié")).toHaveTextContent(`${money(36000)}${money(30000)} bruts + ${money(12000)} de cotisations patronales − ${money(6000)} de réduction générale`)

    report.activities = [{ ...sasu, salaries: [bulletin("person-bob", 30000, 12000, 6000), bulletin("person-carl", 20000, 8000, 7000)] }]
    rerender(<ResultsPanel report={{ ...report }} error={null} />)
    expect(rowValue(card, "Coût employeur des 2 salariés")).toHaveTextContent(money(57000))
  })

  it("indique la déduction retenue pour une personne qui a saisi des frais réels", () => {
    const report = makeReport()
    const bob = report.persons[1]
    const frais = { revenusSalariaux: 28000, deductionForfaitaire: 2800, fraisReels: 4508, fraisDeTrajet: 4508, distanceRetenue: 8720, retenue: "reels" as const, deduction: 4508 }
    report.persons = [report.persons[0], { ...bob, fraisProfessionnels: frais }]
    const { rerender } = render(<ResultsPanel report={report} error={null} />)

    const card = screen.getAllByRole("article").find(article => within(article).queryByText("Bob Durand"))!
    expect(rowValue(card, "Frais réels retenus")).toHaveTextContent(`− ${money(4508)}plutôt que ${money(2800)} de déduction de 10 %`)
    expect(rowValue(card, "dont trajets domicile-travail")).toHaveTextContent(normalize(`${money(4508)}${(8720).toLocaleString("fr-FR")} km au barème`))

    report.persons = [report.persons[0], { ...bob, fraisProfessionnels: { ...frais, fraisReels: 1000, fraisDeTrajet: 1000, distanceRetenue: 2000, retenue: "forfait", deduction: 2800 } }]
    rerender(<ResultsPanel report={{ ...report }} error={null} />)
    expect(rowValue(card, "Déduction de 10 % retenue")).toHaveTextContent(`− ${money(2800)}plutôt que ${money(1000)} de frais réels`)
    expect(rowValue(card, "trajets domicile-travail")).toHaveTextContent(money(1000))

    report.persons = [report.persons[0], { ...bob, fraisProfessionnels: { ...frais, fraisReels: 500, fraisDeTrajet: 0, distanceRetenue: 0, retenue: "forfait", deduction: 2800 } }]
    rerender(<ResultsPanel report={{ ...report }} error={null} />)
    expect(within(card).queryByText("trajets domicile-travail")).not.toBeInTheDocument()
  })

  it("affiche les déplacements professionnels d'une activité, déductibles ou non", () => {
    const report = makeReport()
    const sasu = report.activities[0]
    report.activities = [{ ...sasu, fraisDeDeplacement: { kilometres: 8720, montant: 4508, deductible: true } }]
    const { rerender } = render(<ResultsPanel report={report} error={null} />)

    const card = screen.getAllByRole("article").find(article => within(article).queryByText("Ma SASU"))!
    expect(rowValue(card, "dont déplacements professionnels")).toHaveTextContent(normalize(`${money(4508)}${(8720).toLocaleString("fr-FR")} km au barème kilométrique, déductibles`))

    report.activities = [{ ...sasu, type: "micro-entreprise", statut: "Micro-entreprise", fraisDeDeplacement: { kilometres: 8720, montant: 4508, deductible: false } }]
    rerender(<ResultsPanel report={{ ...report }} error={null} />)
    expect(rowValue(card, "dont déplacements professionnels")).toHaveTextContent(/non déductibles$/)
  })
})
