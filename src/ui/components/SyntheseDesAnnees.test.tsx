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

  it("défile dans une région nommée, atteignable au clavier, et garde la colonne des années fixe, sur un fond opaque", () => {
    const simulation = { annees: [2025, 2026, 2027].map(annee => ({ annee, report: rapport(annee, 1000, 500), erreur: null })) }
    render(<SyntheseDesAnnees simulation={simulation} annee={2026} />)

    expect(screen.getByRole("region", { name: "Synthèse des années" })).toHaveAttribute("tabindex", "0")
    const enTetes = [screen.getByRole("columnheader", { name: "Année" }), ...screen.getAllByRole("rowheader")]
    for (const cellule of enTetes) expect(cellule).toHaveClass("sticky", "left-0")
    expect(screen.getByRole("rowheader", { name: "2026" })).toHaveClass("bg-blue-50")
    expect(screen.getByRole("rowheader", { name: "2025" })).toHaveClass("bg-background")
  })
})
