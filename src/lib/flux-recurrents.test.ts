// src/lib/flux-recurrents.test.ts

import { describe, expect, it } from "vitest"
import type { FinancialFlow, MonthlyGridData } from "@/types"
import { moisCibles, recopierFlux } from "./flux-recurrents"

const grilleVide = (): MonthlyGridData => Array.from({ length: 12 }, (_, month) => ({ month, flows: [] }))
const loyer: FinancialFlow = { id: "flux-mars", entityId: "personne-alice", type: "expense", label: "Loyer", amount: 800 }

function compteur() {
  let n = 0
  return () => `copie-${++n}`
}

describe("moisCibles", () => {
  it("ne vise aucun autre mois pour « ce mois seulement »", () => {
    expect(moisCibles(2, "mois")).toEqual([])
  })

  it("vise les mois suivants jusqu'en décembre", () => {
    expect(moisCibles(9, "suivants")).toEqual([10, 11])
    expect(moisCibles(11, "suivants")).toEqual([])
  })

  it("vise tous les autres mois de l'année", () => {
    expect(moisCibles(2, "annee")).toEqual([0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })
})

describe("recopierFlux", () => {
  it("recopie le flux sur les mois suivants, avec de nouveaux identifiants", () => {
    const grille = grilleVide()
    grille[2] = { month: 2, flows: [loyer] }

    const { grille: resultat, ajouts } = recopierFlux(grille, loyer, 2, "suivants", compteur())

    expect(ajouts).toBe(9)
    expect(resultat[1].flows).toEqual([])
    expect(resultat[2].flows).toEqual([loyer])
    expect(resultat[3].flows).toEqual([{ ...loyer, id: "copie-1" }])
    expect(resultat[11].flows).toEqual([{ ...loyer, id: "copie-9" }])
  })

  it("garde le brut d'un salaire dans les copies", () => {
    const salaire: FinancialFlow = { id: "s", entityId: "personne-alice", type: "salary", label: "Salaire", amount: 2000, grossAmount: 2564.1 }
    const { grille } = recopierFlux(grilleVide(), salaire, 0, "annee", compteur())
    expect(grille[5].flows[0]).toMatchObject({ amount: 2000, grossAmount: 2564.1 })
  })

  it("ne crée pas de doublon là où un flux identique existe déjà", () => {
    const grille = grilleVide()
    grille[4] = { month: 4, flows: [{ ...loyer, id: "deja-la" }] }
    grille[5] = { month: 5, flows: [{ ...loyer, id: "autre-montant", amount: 850 }] }

    const { grille: resultat, ajouts } = recopierFlux(grille, loyer, 2, "suivants", compteur())

    expect(ajouts).toBe(8)
    expect(resultat[4].flows.map(f => f.id)).toEqual(["deja-la"])
    expect(resultat[5].flows.map(f => f.amount)).toEqual([850, 800])
  })

  it("rend la grille inchangée, même référence, quand il n'y a rien à ajouter", () => {
    const grille = grilleVide()
    expect(recopierFlux(grille, loyer, 2, "mois", compteur())).toEqual({ grille, ajouts: 0 })
    expect(recopierFlux(grille, loyer, 11, "suivants", compteur()).grille).toBe(grille)
  })

  it("ne touche pas aux mois non visés, qui gardent la même référence", () => {
    const grille = grilleVide()
    const { grille: resultat } = recopierFlux(grille, loyer, 9, "suivants", compteur())
    expect(resultat[0]).toBe(grille[0])
    expect(resultat[10]).not.toBe(grille[10])
  })
})
