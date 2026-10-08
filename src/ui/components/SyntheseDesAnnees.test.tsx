// src/ui/components/SyntheseDesAnnees.test.tsx

import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { SimulationReport } from "@/types"
import { emptyReport } from "@/ui/testing/fixtures"
import { SyntheseDesAnnees } from "./SyntheseDesAnnees"

const rapport = (annee: number, net: number, prelevements: number, anneeDesRegles = annee): SimulationReport => {
  const vide = emptyReport()
  return { ...vide, annee, anneeDesRegles, totalNetApresImpots: net, bilan: { ...vide.bilan, totalPrelevements: prelevements, revenusAvantPrelevements: net + prelevements } }
}

const texte = (element: HTMLElement) => element.textContent!.replace(/\s/g, " ")

describe("SyntheseDesAnnees", () => {
  it("n'affiche rien pour une seule année", () => {
    const { container } = render(<SyntheseDesAnnees simulation={{ annees: [{ annee: 2026, report: rapport(2026, 1000, 500), erreur: null }] }} annee={2026} />)

    expect(container).toBeEmptyDOMElement()
  })

  it("donne une ligne par année, l'année affichée mise en évidence, et les règles reprises d'une autre année", () => {
    const simulation = {
      annees: [
        { annee: 2023, report: null, erreur: "Le simulateur ne connaît pas les règles d'avant 2024 : l'année 2023 n'est pas simulée." },
        { annee: 2026, report: rapport(2026, 30000, 12000), erreur: null },
        { annee: 2027, report: rapport(2027, 31000, 12500, 2026), erreur: null }
      ]
    }
    render(<SyntheseDesAnnees simulation={simulation} annee={2026} />)

    const lignes = within(screen.getByRole("table", { name: /chaque année de la session/ })).getAllByRole("row").slice(1)
    expect(lignes.map(texte)).toEqual(["2023Le simulateur ne connaît pas les règles d'avant 2024 : l'année 2023 n'est pas simulée.", "202630 000 €12 000 €42 000 €", "2027règles 202631 000 €12 500 €43 500 €"])
    expect(lignes[1]).toHaveAttribute("aria-current", "true")
    expect(lignes[2]).not.toHaveAttribute("aria-current")
  })

  it("ajoute les réserves des sociétés au 31 décembre dès qu'une année en a", () => {
    const avecReserves = (annee: number, conserve: number, aLaFin: number): SimulationReport => {
      const r = rapport(annee, 1000, 500)
      const etat = { reserveLegale: 100, deficitReportable: 0 }
      const reserves = { auDebut: { ...etat, reserves: aLaFin - conserve }, aLaFin: { ...etat, reserves: aLaFin }, deficitImpute: 0, dotationReserveLegale: 0, beneficeDistribuableDeLAnnee: Math.max(0, conserve), distribuable: aLaFin, dividendesPrisSurLesReserves: Math.max(0, -conserve) }
      return { ...r, activities: [{ entityId: "s1", name: "Ma SASU", type: "company", statut: "SASU", chiffreAffaires: 0, charges: 0, cotisationsSociales: 0, impotSocietes: 0, revenuVerse: 0, resultatConserve: conserve, beneficiaireIds: [], warnings: [], reserves }] }
    }
    render(<SyntheseDesAnnees simulation={{ annees: [{ annee: 2025, report: avecReserves(2025, 24625, 24625), erreur: null }, { annee: 2026, report: avecReserves(2026, -24625, 0), erreur: null }] }} annee={2026} />)

    expect(screen.getByRole("columnheader", { name: "Réserves des sociétés au 31 décembre" })).toBeInTheDocument()
    const lignes = within(screen.getByRole("table", { name: /réserves des sociétés/ })).getAllByRole("row").slice(1)
    expect(lignes.map(texte)).toEqual(["20251 000 €500 €1 500 €24 625 €", "20261 000 €500 €1 500 €0 €"])
  })

  it("sans société à l'IS, pas de colonne des réserves", () => {
    render(<SyntheseDesAnnees simulation={{ annees: [2025, 2026].map(annee => ({ annee, report: rapport(annee, 1000, 500), erreur: null })) }} annee={2026} />)

    expect(screen.queryByRole("columnheader", { name: /Réserves/ })).not.toBeInTheDocument()
  })

  it("défile dans une région nommée, atteignable au clavier, et garde la colonne des années fixe, sur un fond opaque", () => {
    const simulation = { annees: [2025, 2026, 2027].map(annee => ({ annee, report: rapport(annee, 1000, 500), erreur: null })) }
    render(<SyntheseDesAnnees simulation={simulation} annee={2026} />)

    expect(screen.getByRole("region", { name: "Synthèse des années" })).toHaveAttribute("tabindex", "0")
    const enTetes = [screen.getByRole("columnheader", { name: "Année" }), ...screen.getAllByRole("rowheader")]
    for (const cellule of enTetes) expect(cellule).toHaveClass("sticky", "left-0")
    expect(screen.getByRole("rowheader", { name: "2026" })).toHaveClass("bg-blue-50")
    expect(screen.getByRole("rowheader", { name: "2025" })).toHaveClass("bg-background")
  })

  it("liste les dispositifs de chaque année sous le tableau : ACRE, annonce et sortie du régime micro", () => {
    const avecNotes = (annee: number, notes: string[]): SimulationReport => {
      const r = rapport(annee, 1000, 500)
      return { ...r, activities: [{ entityId: "m1", name: "Mon atelier", type: "micro-entreprise", statut: "Micro-entreprise", chiffreAffaires: 0, charges: 0, cotisationsSociales: 0, impotSocietes: 0, revenuVerse: 0, resultatConserve: 0, beneficiaireIds: [], warnings: [], ...(notes.length > 0 ? { dispositifs: notes } : {}) }] }
    }
    const simulation = {
      annees: [
        { annee: 2026, report: avecNotes(2026, ["ACRE : cotisations réduites de 25 %."]), erreur: null },
        { annee: 2027, report: avecNotes(2027, ["Deuxième année de suite au-delà des plafonds (2026 et 2027)."]), erreur: null },
        { annee: 2028, report: avecNotes(2028, ["Sortie du régime micro au 1er janvier 2028 : chiffre d'affaires au-delà des plafonds en 2026 et 2027."]), erreur: null }
      ]
    }
    render(<SyntheseDesAnnees simulation={simulation} annee={2026} />)

    const liste = screen.getByRole("list", { name: "Dispositifs dans le temps" })
    expect(within(liste).getAllByRole("listitem").map(texte)).toEqual([
      "2026 · Mon atelier : ACRE : cotisations réduites de 25 %.",
      "2027 · Mon atelier : Deuxième année de suite au-delà des plafonds (2026 et 2027).",
      "2028 · Mon atelier : Sortie du régime micro au 1er janvier 2028 : chiffre d'affaires au-delà des plafonds en 2026 et 2027."
    ])
  })

  it("n'ajoute rien sous le tableau quand aucun dispositif ne joue", () => {
    const simulation = { annees: [2025, 2026].map(annee => ({ annee, report: rapport(annee, 1000, 500), erreur: null })) }
    render(<SyntheseDesAnnees simulation={simulation} annee={2026} />)
    expect(screen.queryByRole("list", { name: "Dispositifs dans le temps" })).not.toBeInTheDocument()
  })
})
