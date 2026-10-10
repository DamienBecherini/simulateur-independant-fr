// src/lib/grille-mensuelle.test.ts

import { describe, expect, it } from "vitest"
import { grilleVide, type Entity, type FinancialFlow, type MonthlyGridData } from "@/types"
import { DEFAULT_FLOW_COLORS } from "./color-constants"
import { deMois, donneesDeLaGrille, nombreDeFluxParMois, numerosDesTypesDeFlux } from "./grille-mensuelle"

const alice: Entity = { id: "alice", type: "person", name: "Alice", fiscalParts: 1, avatar: { type: "initials", value: "A", color: "#000000" }, locked: false }
const atelier: Entity = { id: "atelier", type: "micro-entreprise", name: "Atelier", beneficieACRE: false, opteVFL: false, avatar: { type: "icon", value: "Store", color: "#000000" }, locked: false }

let compteur = 0
const flux = (entityId: string, type: FinancialFlow["type"], amount: number): FinancialFlow => ({ id: `f${++compteur}`, entityId, type, label: type, amount })

/** Grille vide où l'on dépose des flux dans les mois donnés (0 = janvier). */
function grilleAvec(parMois: Record<number, FinancialFlow[]>): MonthlyGridData {
  return grilleVide().map(mois => ({ ...mois, flows: parMois[mois.month] ?? [] }))
}

describe("numéros des types de flux", () => {
  it("numérote de 1 à n les types présents, dans l'ordre alphabétique de leur identifiant", () => {
    const grille = grilleAvec({ 0: [flux("alice", "salary", 1), flux("alice", "expense", 1)], 5: [flux("atelier", "ca_micro_vente", 1), flux("alice", "salary", 2)] })
    expect([...numerosDesTypesDeFlux(grille)]).toEqual([
      ["ca_micro_vente", 1],
      ["expense", 2],
      ["salary", 3]
    ])
  })

  it("aucun numéro pour une grille vide", () => {
    expect(numerosDesTypesDeFlux(grilleVide()).size).toBe(0)
  })
})

describe("nombre de flux par mois", () => {
  it("ne compte que les flux des acteurs affichés", () => {
    const grille = grilleAvec({ 0: [flux("alice", "salary", 1), flux("disparu", "salary", 1)], 11: [flux("alice", "expense", 1)] })
    const nombres = nombreDeFluxParMois(grille, [alice])
    expect(nombres).toHaveLength(12)
    expect(nombres[0]).toBe(1)
    expect(nombres[11]).toBe(1)
    expect(nombres.slice(1, 11).every(n => n === 0)).toBe(true)
  })
})

describe("données de la grille", () => {
  const grille = grilleAvec({
    0: [flux("alice", "salary", 2000), flux("alice", "salary", 500), flux("alice", "expense", 300), flux("atelier", "ca_micro_vente", 4000)],
    1: [flux("alice", "expense", 3000)]
  })
  const numeros = numerosDesTypesDeFlux(grille)

  it("une ligne par acteur, chaque case regroupe ses flux par type, gains et dépenses à part", () => {
    const [ligneAlice, ligneAtelier] = donneesDeLaGrille([alice, atelier], grille, undefined, numeros)
    expect(ligneAlice.entity).toBe(alice)
    expect(ligneAtelier.entity).toBe(atelier)
    expect(ligneAlice.monthlyCellData).toHaveLength(12)
    expect(ligneAlice.monthlyCellData[0]).toEqual({
      gains: [{ amount: 2500, color: DEFAULT_FLOW_COLORS.salary, number: numeros.get("salary") }],
      expenses: [{ amount: 300, color: DEFAULT_FLOW_COLORS.expense, number: numeros.get("expense") }],
      totalGains: 2500,
      totalExpenses: 300,
      flowCount: 3
    })
    expect(ligneAlice.monthlyCellData[2]).toEqual({ gains: [], expenses: [], totalGains: 0, totalExpenses: 0, flowCount: 0 })
  })

  it("le total annuel additionne les mois, type par type", () => {
    const [ligneAlice] = donneesDeLaGrille([alice], grille, undefined, numeros)
    expect(ligneAlice.annualCellData.gains.map(s => s.amount)).toEqual([2500])
    expect(ligneAlice.annualCellData.expenses.map(s => s.amount)).toEqual([3300])
    expect(ligneAlice.annualCellData.flowCount).toBe(4)
  })

  it("échelles : le plus grand total d'un mois pour les mois, le plus grand segment de l'année pour le total, avec 10 % de marge", () => {
    const [ligneAlice] = donneesDeLaGrille([alice], grille, undefined, numeros)
    // Février : 3 000 € de dépenses, plus que les 2 500 € de gains de janvier.
    expect(ligneAlice.monthlyScale).toBeCloseTo(3300)
    expect(ligneAlice.annualScale).toBeCloseTo(3630)
  })

  it("sans aucun montant, les échelles restent positives : aucune division par zéro", () => {
    const [ligne] = donneesDeLaGrille([alice], grilleVide(), undefined, new Map())
    expect(ligne.monthlyScale).toBe(1)
    expect(ligne.annualScale).toBeCloseTo(1.1)
  })

  it("les couleurs choisies remplacent celles par défaut ; un type sans numéro ni couleur reçoit 0 et du gris", () => {
    const [ligneAlice] = donneesDeLaGrille([alice], grille, { salary: "#123456" }, new Map())
    expect(ligneAlice.monthlyCellData[0].gains[0]).toEqual({ amount: 2500, color: "#123456", number: 0 })
    const inconnu = { ...flux("alice", "salary", 10), type: "type_inconnu" } as unknown as FinancialFlow
    const [ligne] = donneesDeLaGrille([alice], grilleAvec({ 3: [inconnu] }), undefined, new Map())
    expect(ligne.monthlyCellData[3].gains[0].color).toBe("#cccccc")
  })
})

describe("élision du nom du mois", () => {
  it("« de » devant une consonne, « d’ » devant une voyelle", () => {
    expect(deMois("Mars")).toBe("de mars")
    expect(deMois("Avril")).toBe("d’avril")
    expect(deMois("Août")).toBe("d’août")
    expect(deMois("Octobre")).toBe("d’octobre")
  })
})
