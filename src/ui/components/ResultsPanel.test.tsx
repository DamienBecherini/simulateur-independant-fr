// src/ui/components/ResultsPanel.test.tsx

import { render, screen, within } from "@testing-library/react"
import { useState, type ReactNode } from "react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Affichage, FoyerFiscalResult, PersonResult, SalarieDeLActivite, SimulationReport, UserPreferences } from "@/types"
import { reglesPubliees } from "@/backend/logic/regles"
import { runMetaSimulation } from "@/backend/logic/simulation-engine"
import { SANS_EPARGNE_RETRAITE } from "@/backend/logic/testing/foyer-de-test"
import { chiffreDAffairesPour } from "@/backend/logic/testing/revenus-exacts"
import { exercant, micro, personne, relation, session, societe, type Flux } from "@/backend/logic/testing/session-de-test"
import { LIMITES } from "@/lib/limites-du-modele"
import { emptyReport } from "@/ui/testing/fixtures"
import { AffichageContext } from "../hooks/useAffichage"
import { retrouverLaPosition } from "../hooks/useDetailsDesCartes"
import { MemoireDesSectionsContext, useMemoireDesSections } from "../hooks/useSectionOuverte"
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
    epargneRetraite: SANS_EPARGNE_RETRAITE,
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
        reserves: {
          auDebut: { reserves: 15000, reserveLegale: 100, deficitReportable: 0 },
          aLaFin: { reserves: 25000, reserveLegale: 100, deficitReportable: 0 },
          deficitImpute: 0,
          dotationReserveLegale: 0,
          beneficeDistribuableDeLAnnee: 10000,
          distribuable: 25000,
          dividendesPrisSurLesReserves: 0
        },
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
    expect(screen.getByText(avertissement).tagName).toBe("LI")
  })

  it("replie sous le titre les hypothèses et limites du modèle, la liste du rapport Markdown", async () => {
    render(<ResultsPanel report={emptyReport()} error={null} />)
    const resume = screen.getByText("Hypothèses et limites")
    const depliable = resume.closest("details")!
    expect(depliable).not.toHaveAttribute("open")

    await userEvent.setup({ delay: null }).click(resume)

    expect(depliable).toHaveAttribute("open")
    expect(within(depliable).getAllByRole("listitem").map(li => li.textContent)).toEqual(LIMITES)
  })

  it("donne au versement libératoire sa propre ligne, sans ligne du barème quand celui-ci est vide", () => {
    const report = makeReport()
    report.foyers = [makeFoyer("person-bob", { impotSurLeRevenu: 792, versementLiberatoire: 792, revenuImposableGlobal: 0 })]
    render(<ResultsPanel report={report} error={null} />)

    const carte = screen.getAllByRole("article").find(a => a.textContent?.includes("Bob Durand"))!
    expect(rowValue(carte, "Impôt payé avec les cotisations (versement libératoire)")).toHaveTextContent(`− ${money(792)}`)
    expect(within(carte).queryByText("Impôt sur le revenu", { selector: "dt" })).not.toBeInTheDocument()
  })

  it("garde la ligne du barème à côté du versement libératoire quand il y a un impôt au barème", () => {
    const report = makeReport()
    report.foyers = [makeFoyer("person-bob", { impotSurLeRevenu: 2792, versementLiberatoire: 792 })]
    render(<ResultsPanel report={report} error={null} />)

    const carte = screen.getAllByRole("article").find(a => a.textContent?.includes("Bob Durand"))!
    expect(rowValue(carte, "Impôt sur le revenu")).toHaveTextContent(`− ${money(2000)}sur ${money(27000)} imposables au barème`)
  })

  it("donne le revenu fiscal de référence de chaque foyer", () => {
    render(<ResultsPanel report={makeReport()} error={null} />)

    const carte = screen.getAllByRole("article").find(a => a.textContent?.includes("Bob Durand"))!
    expect(rowValue(carte, "Revenu fiscal de référence")).toHaveTextContent(`${money(27000)}pour le versement libératoire dans deux ans`)
  })

  it("activité exonérée en zone : une ligne « Bénéfice exonéré d'impôt », et sa part dans le revenu fiscal de référence (ADR 017)", () => {
    const report = makeReport()
    report.activities = [{ ...report.activities[0], exonerationDeZone: { regime: "zfuTe", nom: "ZFU-TE", partExoneree: 2 / 3, partDansLaZone: 1, beneficeExonere: 40000, plafond: 50000, plafondAtteint: false, hypotheses: [] } }]
    report.foyers = [{ ...report.foyers[0], beneficesExoneres: 12000 }, ...report.foyers.slice(1)]
    render(<ResultsPanel report={report} error={null} />)

    const activite = screen.getAllByRole("article").find(a => a.textContent?.includes("Ma SASU"))!
    expect(normalize(rowValue(activite, "Bénéfice exonéré d'impôt").textContent!)).toBe(`${money(40000)}ZFU-TE, exonéré à 66,7 %`)
    const foyer = screen.getAllByRole("article").find(a => a.textContent?.includes("Revenu fiscal de référence"))!
    expect(normalize(rowValue(foyer, "Revenu fiscal de référence").textContent!)).toContain(`dont ${money(12000)} de bénéfice exonéré en zone ; pour le versement libératoire dans deux ans`)
  })

  it("sans bénéfice exonéré (case non cochée, exonération terminée), aucune ligne de plus", () => {
    const report = makeReport()
    report.activities = [{ ...report.activities[0], exonerationDeZone: { regime: "zfuTe", nom: "ZFU-TE", partExoneree: 0, partDansLaZone: 1, beneficeExonere: 0, plafondAtteint: false, sansExoneration: "terminee", hypotheses: [] } }]
    render(<ResultsPanel report={report} error={null} />)
    expect(screen.queryByText("Bénéfice exonéré d'impôt")).not.toBeInTheDocument()
  })

  it.each([
    ["calcule", true, "le vôtre, de 29 040 €, calculé par la simulation, y donne accès"],
    ["saisi", false, "le vôtre, de 29 040 €, saisi dans la fiche, le dépasse"]
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

    expect(screen.getByText(/revenu fiscal de référence 2024 inconnu : ajoutez l'année 2024 à la simulation/)).toBeInTheDocument()
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
    expect(rowValue(card, "Ajouté aux réserves")).toHaveTextContent(money(10000))
    expect(rowValue(card, "Réserves au 31 décembre")).toHaveTextContent(`${money(25000)}plus ${money(100)} de réserve légale`)
    expect(rowValue(card, "Versé avant impôt sur le revenu")).toHaveTextContent(`${money(38000)}48 % du CA`)
    expect(within(card).getByRole("listitem")).toHaveTextContent("Rémunération inférieure au seuil de validation de trimestres.")
    expect(within(card).queryByText(/Coût employeur/)).not.toBeInTheDocument()
  })

  it("montre les dividendes pris sur les réserves, la réserve légale dotée et un déficit reporté", () => {
    const report = makeReport()
    const sasu = report.activities[0]
    const reserves = sasu.reserves!
    report.activities = [{ ...sasu, resultatConserve: -5000, reserves: { ...reserves, aLaFin: { ...reserves.aLaFin, reserves: 10000 }, dividendesPrisSurLesReserves: 5000 } }]
    const { rerender } = render(<ResultsPanel report={report} error={null} />)
    const card = () => screen.getAllByRole("article").find(article => within(article).queryByText("Ma SASU"))!

    expect(rowValue(card(), "Dividendes pris sur les réserves")).toHaveTextContent(`− ${money(5000)}`)
    expect(within(card()).queryByText("Ajouté aux réserves")).not.toBeInTheDocument()

    const legale = { ...sasu, reserves: { ...reserves, dotationReserveLegale: 500, aLaFin: { ...reserves.aLaFin, reserveLegale: 600 } } }
    rerender(<ResultsPanel report={{ ...report, activities: [legale] }} error={null} />)
    expect(rowValue(card(), "Ajouté aux réserves")).toHaveTextContent(`${money(10000)}dont ${money(500)} de réserve légale`)

    const deficitaire = { ...sasu, resultatConserve: -4000, reserves: { ...reserves, auDebut: { ...reserves.auDebut, reserves: 0 }, aLaFin: { reserves: -4000, reserveLegale: 100, deficitReportable: 4000 } } }
    rerender(<ResultsPanel report={{ ...report, activities: [deficitaire] }} error={null} />)
    expect(rowValue(card(), "Déficit de la société")).toHaveTextContent(`− ${money(4000)}`)
    expect(rowValue(card(), "Pertes à combler au 31 décembre")).toHaveTextContent(money(4000))

    const reporte = { ...sasu, reserves: { ...reserves, auDebut: { ...reserves.auDebut, deficitReportable: 3000 }, deficitImpute: 3000 } }
    rerender(<ResultsPanel report={{ ...report, activities: [reporte] }} error={null} />)
    expect(rowValue(card(), "Déficit des années précédentes déduit")).toHaveTextContent(`${money(3000)}avant l'impôt sur les sociétés`)
    expect(within(card()).queryByText("Déficit de la société")).not.toBeInTheDocument()
  })

  it("affiche le coût de la rémunération du président et celui des salariés", () => {
    // Seuls les montants affichés sont renseignés ; chaque ligne du bulletin vaut zéro (le détail des cotisations, qui
    // ne rejoint alors pas le total de l'activité, n'est pas affiché).
    const lignesNulles = new Proxy({}, { get: () => ({ salariale: 0, patronale: 0 }) }) as SalarieDeLActivite["cotisations"]
    const bulletin = (personId: string, brut: number, totalPatronal: number, reductionGenerale: number) =>
      ({ personId, statut: "salarie", brut, totalPatronal, reductionGenerale, coutEmployeur: brut + totalPatronal - reductionGenerale, cotisations: lignesNulles }) as SalarieDeLActivite
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
    const frais = { revenusSalariaux: 28000, tauxDeductionForfaitaire: 0.1, deductionForfaitaire: 2800, fraisReels: 4508, fraisDeTrajet: 4508, distanceRetenue: 8720, nombreDeTrajets: 1, voitures: [], autresFrais: 0, retenue: "reels" as const, deduction: 4508 }
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

    // Le taux nommé est celui des règles de l'année du résultat, pas un « 10 % » écrit en dur.
    report.persons = [report.persons[0], { ...bob, fraisProfessionnels: { ...frais, tauxDeductionForfaitaire: 0.12 } }]
    rerender(<ResultsPanel report={{ ...report }} error={null} />)
    expect(rowValue(card, "Frais réels retenus")).toHaveTextContent(`plutôt que ${money(2800)} de déduction de 12 %`)
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

  it("détaille la formation professionnelle d'une micro-entreprise, comprise dans ses cotisations", () => {
    const report = makeReport()
    report.activities = [{ ...report.activities[0], name: "Mon atelier", type: "micro-entreprise", statut: "Micro-entreprise", formationProfessionnelle: 80 }]
    render(<ResultsPanel report={report} error={null} />)

    const card = screen.getAllByRole("article").find(article => within(article).queryByText("Mon atelier"))!
    expect(rowValue(card, "dont formation professionnelle")).toHaveTextContent(normalize(`${money(80)}contribution sur le chiffre d'affaires, non réduite par l'ACRE`))
  })

  it("annonce la sortie du régime micro et les dispositifs de l'année, à part des avertissements", () => {
    const report = makeReport()
    const sortie = "Sortie du régime micro au 1er janvier 2028 : chiffre d'affaires au-delà des plafonds en 2026 et 2027."
    report.activities = [{ ...report.activities[0], name: "Mon atelier", statut: "EI au réel", sortieDuRegimeMicro: { depuis: 2028, depassements: [2026, 2027] }, dispositifs: [sortie], warnings: [] }]
    render(<ResultsPanel report={report} error={null} />)

    const card = screen.getAllByRole("article").find(article => within(article).queryByText("Mon atelier"))!
    expect(within(card).getByText("EI au réel · sortie du régime micro au 1er janvier 2028")).toBeInTheDocument()
    expect(within(card).getByRole("list", { name: "Dispositifs de l'année" })).toHaveTextContent(sortie)
  })

  it("l'année de création : la date et les mois d'activité sous le nom, la note avec les dispositifs", () => {
    const report = makeReport()
    const note = "Année de création (avril 2026, 9 mois d'activité) : les cotisations se calculent sur un plafond de la sécurité sociale réduit aux mois d'activité."
    report.activities = [{ ...report.activities[0], name: "Conseil de Sophie", statut: "EI au réel", anneeDeCreation: { creation: "2026-04", mois: 9 }, dispositifs: [note], warnings: [] }]
    render(<ResultsPanel report={report} error={null} />)

    const card = screen.getAllByRole("article").find(article => within(article).queryByText("Conseil de Sophie"))!
    expect(within(card).getByText("EI au réel · créée en avril 2026, 9 mois d'activité")).toBeInTheDocument()
    expect(within(card).getByRole("list", { name: "Dispositifs de l'année" })).toHaveTextContent(note)
  })

  it("exonération en zone : l'avertissement des conditions tient en une phrase, « Voir les conditions » déplie le reste et le texte officiel", async () => {
    const user = userEvent.setup()
    const resume = "Exonération ZFU-TE appliquée sans vérifier ses conditions"
    const avertissement = `${resume} : moins de 50 salariés, activité hors des secteurs exclus. Hypothèses du calcul dans la fiche de l'activité.`
    const autre = "Société déficitaire cette année."
    const report = makeReport()
    report.activities = [
      {
        ...report.activities[0],
        name: "Mon atelier",
        warnings: [autre, avertissement],
        exonerationDeZone: { regime: "zfuTe", nom: "ZFU-TE", partExoneree: 1, partDansLaZone: 1, beneficeExonere: 30000, plafond: 50000, plafondAtteint: false, hypotheses: [], conditionsNonVerifiees: { resume, avertissement, source: "https://bofip.impots.gouv.fr/regime" } }
      }
    ]
    render(<ResultsPanel report={report} error={null} />)
    const card = screen.getAllByRole("article").find(article => within(article).queryByText("Mon atelier"))!

    // Repliée : la phrase d'annonce seule ; les autres avertissements restent entiers.
    const bouton = within(card).getByRole("button", { name: "Voir les conditions" })
    expect(bouton).toHaveAttribute("aria-expanded", "false")
    expect(within(card).getByText(`${resume}.`)).toBeVisible()
    expect(within(card).getByText(autre)).toBeVisible()
    const detail = document.getElementById(bouton.getAttribute("aria-controls")!)!
    // Le texte entier reste dans la page, masqué à l'écran et montré à l'impression (export PDF).
    expect(detail).toHaveClass("hidden", "print:inline")
    expect(detail).toHaveTextContent(avertissement)

    await user.click(bouton)
    expect(within(card).getByRole("button", { name: "Masquer les conditions" })).toHaveAttribute("aria-expanded", "true")
    expect(detail).not.toHaveClass("hidden")
    expect(within(card).getByText(`${resume}.`)).toHaveClass("hidden")
    expect(within(card).getByRole("link", { name: "Texte officiel" })).toHaveAttribute("href", "https://bofip.impots.gouv.fr/regime")

    await user.click(within(card).getByRole("button", { name: "Masquer les conditions" }))
    expect(detail).toHaveClass("hidden")
  })

  it("n'affiche pas de liste de dispositifs quand aucun ne joue", () => {
    render(<ResultsPanel report={makeReport()} error={null} />)
    expect(screen.queryByRole("list", { name: "Dispositifs de l'année" })).not.toBeInTheDocument()
  })
})

describe("détail des cartes de résultats", () => {
  /** Deux foyers et deux activités. */
  function rapportAvecDeuxActivites(): SimulationReport {
    const report = makeReport()
    report.activities = [...report.activities, { ...report.activities[0], entityId: "micro-atelier", name: "Atelier", type: "micro-entreprise", statut: "Micro-entreprise", impotSocietes: 0, resultatConserve: 0, warnings: [] }]
    return report
  }
  const afficher = (affichage: Affichage, report = rapportAvecDeuxActivites()) => render(<AffichageContext.Provider value={affichage}><ResultsPanel report={report} error={null} /></AffichageContext.Provider>)
  const TOUTES = /le détail \(toutes les cartes\)$/
  const boutons = () => screen.getAllByRole("button", { name: TOUTES })
  const carte = (nom: string) => screen.getAllByRole("article").find(article => within(article).queryByText(nom))!
  /** Une ligne de détail est masquée à l'écran (classe `hidden`), mais reste imprimée. */
  const masquee = (conteneur: HTMLElement, libelle: string) => within(conteneur).getByText(libelle, { selector: "dt" }).closest(".hidden") !== null

  it("affichage classique : tout est affiché, et un clic sur un foyer masque le détail de toutes les cartes, foyers et activités", async () => {
    afficher("classique")
    expect(boutons()).toHaveLength(4)
    for (const bouton of boutons()) expect(bouton).toHaveAttribute("aria-expanded", "true")
    expect(masquee(carte("Bob Durand"), "Total encaissé")).toBe(false)

    const clique = within(carte("Bob Durand")).getByRole("button", { name: TOUTES })
    await userEvent.click(clique)

    for (const bouton of boutons()) {
      expect(bouton).toHaveAttribute("aria-expanded", "false")
      expect(bouton).toHaveAccessibleName("Afficher le détail (toutes les cartes)")
    }
    expect(clique).toHaveFocus()
    // L'impôt et le revenu fiscal de référence restent affichés ; le reste se masque à sa place, dans chaque foyer.
    for (const nom of ["Alice Martin", "Bob Durand"]) {
      expect(masquee(carte(nom), "Total encaissé")).toBe(true)
      expect(masquee(carte(nom), "Net après impôts")).toBe(true)
      expect(masquee(carte(nom), "Impôt sur le revenu")).toBe(false)
      expect(masquee(carte(nom), "Revenu fiscal de référence")).toBe(false)
    }
    expect(masquee(carte("Ma SASU"), "Chiffre d'affaires")).toBe(true)
  })

  it("affichage « Résumé » : le détail est replié, et un clic sur une activité ouvre celui de toutes les cartes", async () => {
    afficher("resume")
    for (const bouton of boutons()) expect(bouton).toHaveAttribute("aria-expanded", "false")
    expect(masquee(carte("Ma SASU"), "Chiffre d'affaires")).toBe(true)
    expect(masquee(carte("Ma SASU"), "Versé avant impôt sur le revenu")).toBe(false)

    const clique = within(carte("Atelier")).getByRole("button", { name: TOUTES })
    await userEvent.click(clique)

    for (const bouton of boutons()) expect(bouton).toHaveAttribute("aria-expanded", "true")
    expect(clique).toHaveFocus()
    expect(clique).toHaveAccessibleName("Masquer le détail (toutes les cartes)")
    expect(masquee(carte("Ma SASU"), "Chiffre d'affaires")).toBe(false)
    expect(masquee(carte("Bob Durand"), "Total encaissé")).toBe(false)

    // Au clavier aussi : Entrée referme toutes les cartes.
    await userEvent.keyboard("{Enter}")
    for (const bouton of boutons()) expect(bouton).toHaveAttribute("aria-expanded", "false")
  })

  it("chaque bouton désigne le détail de sa carte ; seul, il ne parle pas de « toutes »", () => {
    const report = makeReport()
    report.foyers = [report.foyers[1]]
    report.activities = []
    afficher("resume", report)
    const bouton = within(carte("Bob Durand")).getByRole("button", { name: "Afficher le détail" })
    expect(document.getElementById(bouton.getAttribute("aria-controls")!)).toHaveTextContent("Total encaissé")
  })
})

describe("détail des cartes retenu dans les préférences", () => {
  function AvecPreferences({ initiales, suivre, children }: { initiales: UserPreferences; suivre: (preferences: UserPreferences) => void; children: ReactNode }) {
    const [preferences, setPreferences] = useState(initiales)
    const memoire = useMemoireDesSections(preferences.sectionsOuvertes, setPreferences)
    suivre(preferences)
    return <MemoireDesSectionsContext.Provider value={memoire}>{children}</MemoireDesSectionsContext.Provider>
  }
  const afficher = (initiales: UserPreferences, suivre: (preferences: UserPreferences) => void = () => {}) =>
    render(
      <AvecPreferences initiales={initiales} suivre={suivre}>
        <AffichageContext.Provider value="resume">
          <ResultsPanel report={makeReport()} error={null} />
        </AffichageContext.Provider>
      </AvecPreferences>
    )
  const boutons = () => screen.getAllByRole("button", { name: /le détail \(toutes les cartes\)$/ })

  it("reprend l'état retenu, et retient la bascule sous un seul identifiant", async () => {
    let preferences: UserPreferences = { slotOrder: [] }
    afficher({ slotOrder: [], sectionsOuvertes: { "details-des-cartes": true } }, p => (preferences = p))
    for (const bouton of boutons()) expect(bouton).toHaveAttribute("aria-expanded", "true")

    await userEvent.click(boutons()[0])

    expect(preferences.sectionsOuvertes).toEqual({ "details-des-cartes": false })
    for (const bouton of boutons()) expect(bouton).toHaveAttribute("aria-expanded", "false")
  })
})

describe("retrouverLaPosition", () => {
  afterEach(() => vi.restoreAllMocks())

  it("fait défiler la page d'autant que l'élément s'est déplacé, sans animation, et lui rend le focus", () => {
    const bouton = document.body.appendChild(document.createElement("button"))
    let haut = 540
    vi.spyOn(bouton, "getBoundingClientRect").mockImplementation(() => ({ top: haut }) as DOMRect)
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(((options: ScrollToOptions) => {
      haut -= options.top ?? 0
    }) as typeof window.scrollBy)

    retrouverLaPosition({ element: bouton, haut: 300 })

    expect(scrollBy).toHaveBeenCalledTimes(1)
    expect(scrollBy).toHaveBeenCalledWith({ top: 240, behavior: "instant" })
    expect(haut).toBe(300)
    expect(bouton).toHaveFocus()
    bouton.remove()
  })

  it("ne fait rien défiler quand l'élément n'a pas bougé", () => {
    const bouton = document.body.appendChild(document.createElement("button"))
    vi.spyOn(bouton, "getBoundingClientRect").mockImplementation(() => ({ top: 300.2 }) as DOMRect)
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {})
    retrouverLaPosition({ element: bouton, haut: 300 })
    expect(scrollBy).not.toHaveBeenCalled()
    bouton.remove()
  })
})

describe("épargne retraite (PER) sur la carte du foyer", () => {
  // Le couple de la maquette 3 (ADR 021), calculé par le moteur avec les règles de 2026 : Paul verse 12 000 €, dont
  // 3 000 € pris sur le plafond de Sophie ; 3 600 € d'impôt économisé.
  const nommee = (id: string, name: string, plafondEpargneRetraite: number) => ({ ...personne(id), name, plafondEpargneRetraite })
  const couple = (versement: number) => runMetaSimulation(session([nommee("p", "Paul", 9000), nommee("s", "Sophie", 4710)], [relation("p", "s", "Marié(e)")], [["p", "salary", 100000], ...(versement > 0 ? [["p", "versement_per", versement] satisfies Flux] : [])]), reglesPubliees(2026), { annee: 2026 })
  const afficher = (affichage: Affichage, report: SimulationReport) => render(<AffichageContext.Provider value={affichage}><ResultsPanel report={report} error={null} /></AffichageContext.Provider>)
  const carte = () => screen.getAllByRole("article").find(article => within(article).queryByText("Paul, Sophie"))!
  const bloc = () => within(carte()).getByRole("region", { name: "Épargne retraite (PER)" })
  const masquee = (conteneur: HTMLElement, libelle: string) => within(conteneur).getByText(libelle, { selector: "dt" }).closest(".hidden") !== null

  it("sans versement, la carte ne dit rien de l'épargne retraite", () => {
    afficher("classique", couple(0))

    expect(within(carte()).queryByRole("region", { name: "Épargne retraite (PER)" })).toBeNull()
    expect(carte()).not.toHaveTextContent("épargne retraite")
    expect(rowValue(carte(), "Revenu fiscal de référence")).toHaveTextContent(`${money(90000)}pour le versement libératoire dans deux ans`)
  })

  it("affichage classique : le net dit sa part d'épargne bloquée, le revenu fiscal de référence que la déduction y est rajoutée, et le bloc détaille le versement", () => {
    afficher("classique", couple(12000))

    expect(normalize(rowValue(carte(), "Net après impôts").textContent!)).toBe(`${money(100000 - 9608)}dont ${money(12000)} d'épargne retraite (PER), bloqués jusqu'à la retraite`)
    expect(normalize(rowValue(carte(), "Revenu fiscal de référence").textContent!)).toBe(`${money(90000)}versement PER déduit, puis rajouté ; pour le versement libératoire dans deux ans`)
    expect(normalize(rowValue(carte(), "Impôt sur le revenu").textContent!)).toBe(`− ${money(9608)}sur ${money(78000)} imposables au barème`)

    expect(within(bloc()).getAllByRole("term").map(terme => terme.textContent)).toEqual(["Versé en 2026 par Paul", "Déduit du revenu", "Impôt économisé", "Reste à Sophie", "Plafonds calculés sur 2026"])
    expect(normalize(rowValue(bloc(), "Déduit du revenu").textContent!)).toBe(`− ${money(12000)}${money(9000)} sur le plafond de Paul, ${money(3000)} sur celui de Sophie`)
    expect(normalize(rowValue(bloc(), "Impôt économisé").textContent!)).toBe(`${money(3600)}impôt recalculé sans le versement ; tranche marginale : 30 % (indicatif)`)
    expect(normalize(within(bloc()).getByRole("note").textContent!)).toBe(`Plafonds mis en commun. Pour déduire les ${money(3000)} pris sur le plafond de Sophie, cochez la case 6QR de la déclaration de revenus. Sans elle, ils ne seraient pas déduits : ${money(900)} d'impôt en plus.`)
  })

  it("le bilan dit sous le net la part d'épargne retraite de tous les foyers", () => {
    afficher("classique", couple(12000))

    expect(normalize(document.getElementById("bilan")!.textContent!)).toContain(`dont ${money(12000)} d'épargne retraite (PER), bloqués jusqu'à la retraite`)
  })

  it("affichage classique, détail fermé : l'impôt économisé reste affiché, le reste du bloc et la consigne se masquent", async () => {
    afficher("classique", couple(12000))
    await userEvent.click(within(carte()).getByRole("button", { name: /le détail/ }))

    expect(masquee(bloc(), "Impôt économisé")).toBe(false)
    for (const libelle of ["Versé en 2026 par Paul", "Déduit du revenu", "Reste à Sophie", "Plafonds calculés sur 2026"]) expect(masquee(bloc(), libelle)).toBe(true)
    expect(within(bloc()).getByRole("note")).toHaveClass("hidden")
  })

  it("affichage « Résumé » : l'impôt économisé suit le revenu fiscal de référence, le reste du bloc est dans le détail", async () => {
    afficher("resume", couple(12000))

    expect(masquee(carte(), "Impôt économisé (versement PER)")).toBe(false)
    expect(rowValue(carte(), "Impôt économisé (versement PER)")).toHaveTextContent(money(3600))
    expect(masquee(carte(), "Versé en 2026 par Paul")).toBe(true)
    // La ligne du bloc n'y est pas répétée.
    expect(within(bloc()).queryByText("Impôt économisé", { selector: "dt" })).toBeNull()

    await userEvent.click(within(carte()).getByRole("button", { name: /le détail/ }))
    expect(masquee(carte(), "Versé en 2026 par Paul")).toBe(false)
    expect(within(bloc()).getByRole("note")).toBeVisible()
  })

  it("au-delà du plafond, une entreprise individuelle porte la déduction de son bénéfice, sans changer ce qu'elle verse (maquette 5)", async () => {
    // Cas 1 de l'étude : 60 000 € de bénéfice imposable, 6 000 € versés, 4 710 € sur le revenu global, 1 290 € sur le bénéfice.
    const conseil = { ...societe("ei", "EI"), name: "Conseil de Sophie" }
    const sophie = { ...personne("s"), name: "Sophie" }
    const flux: Flux[] = [["ei", "ca_services", chiffreDAffairesPour(60000, reglesPubliees(2026))], ["s", "versement_per", 6000]]
    afficher("classique", runMetaSimulation(session([sophie, conseil], exercant("s", "ei", "EI"), flux), reglesPubliees(2026), { annee: 2026 }))
    const activite = screen.getAllByRole("article").find(article => within(article).queryByText("Conseil de Sophie"))!
    const foyer = screen.getAllByRole("article").find(article => within(article).queryByText("Foyer fiscal · 1 part"))!

    expect(normalize(rowValue(activite, "Versement PER déduit du bénéfice").textContent!)).toBe(
      `${money(1290)}au-delà du plafond du revenu global ; limite de ${money(7791)} : 10 % du bénéfice, plus 15 % de sa part au-delà du plafond de la sécurité sociale. Seul le revenu imposable baisse : ni les cotisations ni ce que l'activité verse ne changent`
    )
    const epargne = within(foyer).getByRole("region", { name: "Épargne retraite (PER)" })
    expect(within(epargne).getAllByRole("term").map(terme => terme.textContent)).toEqual(["Versé en 2026", "Déduit du revenu global", "Déduit du bénéfice", "Impôt économisé", "Plafond calculé sur 2026"])
    expect(normalize(rowValue(epargne, "Déduit du bénéfice").textContent!)).toBe(`− ${money(1290)}sous sa limite de ${money(7791)}`)
    expect(normalize(rowValue(foyer, "Revenu fiscal de référence").textContent!)).toBe(`${money(58710)}versement PER déduit du revenu global, puis rajouté ; versement PER déduit du bénéfice, non rajouté ; pour le versement libératoire dans deux ans`)

    // Détail fermé : la ligne de l'activité se masque avec le calcul, comme les autres.
    await userEvent.click(within(activite).getByRole("button", { name: /le détail/ }))
    expect(masquee(activite, "Versement PER déduit du bénéfice")).toBe(true)
  })

  it("un versement sans effet est annoncé parmi les avertissements de la carte", () => {
    const atelier = { ...micro("m1", { opteVFL: true }), rfrN2: 20000 }
    const report = runMetaSimulation(session([{ ...personne("k"), name: "Karim", plafondEpargneRetraite: 4710 }, atelier], [relation("k", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 50000], ["k", "versement_per", 4710]]), reglesPubliees(2026), { annee: 2026 })
    afficher("classique", report)
    const karim = screen.getAllByRole("article").find(article => within(article).queryByText("Karim"))!

    expect(karim).toHaveTextContent("Versement PER sans effet sur l'impôt : avec le versement libératoire, le foyer n'a aucun revenu au barème dont le déduire.")
    expect(normalize(rowValue(karim, "Déduit du revenu").textContent!)).toBe(`${money(0)}aucun revenu imposable au barème`)
  })
})
