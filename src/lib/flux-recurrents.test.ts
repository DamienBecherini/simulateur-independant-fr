// src/lib/flux-recurrents.test.ts

import { describe, expect, it } from "vitest"
import type { FinancialFlow, MonthlyGridData } from "@/types"
import { modifierSerie, moisCibles, recopierFlux, supprimerSerie } from "./flux-recurrents"

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

describe("modifierSerie", () => {
  /** Loyer de 800 € de janvier à juin, 850 € de juillet à décembre, et une autre charge en mars. */
  function annee(): MonthlyGridData {
    return Array.from({ length: 12 }, (_, month) => ({
      month,
      flows: [{ id: `loyer-${month}`, entityId: "personne-alice", type: "expense" as const, label: "Loyer", amount: month < 6 ? 800 : 850 }, ...(month === 2 ? [{ id: "autre", entityId: "personne-alice", type: "expense" as const, label: "Assurance", amount: 40 }] : [])]
    }))
  }
  const loyerDe = (grille: MonthlyGridData) => grille.map(mois => mois.flows.find(f => f.label === "Loyer" || f.label === "Logement")?.amount)

  it("ne modifie que le mois ouvert, par défaut", () => {
    const grille = annee()
    const { grille: resultat, touches } = modifierSerie(grille, grille[6].flows[0], 6, "mois", { amount: 900 })
    expect(touches).toBe(0)
    expect(loyerDe(resultat)).toEqual([800, 800, 800, 800, 800, 800, 900, 850, 850, 850, 850, 850])
  })

  it("reporte un nouveau montant sur les mois suivants, sans toucher aux précédents", () => {
    const grille = annee()
    const { grille: resultat, touches } = modifierSerie(grille, grille[6].flows[0], 6, "suivants", { amount: 900 })
    expect(touches).toBe(5)
    expect(loyerDe(resultat)).toEqual([800, 800, 800, 800, 800, 800, 900, 900, 900, 900, 900, 900])
  })

  it("renomme toute la série sur l'année, quels que soient les montants, sans toucher aux autres flux", () => {
    const grille = annee()
    const { grille: resultat, touches } = modifierSerie(grille, grille[2].flows[0], 2, "annee", { label: "Logement" })
    expect(touches).toBe(11)
    expect(resultat.every(mois => mois.flows[0].label === "Logement")).toBe(true)
    expect(loyerDe(resultat)).toEqual([800, 800, 800, 800, 800, 800, 850, 850, 850, 850, 850, 850])
    expect(resultat[2].flows[1]).toEqual(grille[2].flows[1])
  })
})

describe("séries : cas limites", () => {
  /** Abonnement d'Alice à 30 € chaque mois ; le flux de chaque mois a son propre identifiant. */
  const abonnement = (month: number, amount = 30): FinancialFlow => ({ id: `abo-${month}`, entityId: "personne-alice", type: "expense", label: "Abonnement", amount })
  const chaqueMois = (): MonthlyGridData => Array.from({ length: 12 }, (_, month) => ({ month, flows: [abonnement(month)] }))
  const montants = (grille: MonthlyGridData) => grille.map(mois => mois.flows.map(f => f.amount))

  it("recopier deux fois sur toute l'année n'ajoute rien la seconde fois", () => {
    const grille = grilleVide()
    grille[0] = { month: 0, flows: [loyer] }

    const premiere = recopierFlux(grille, loyer, 0, "annee", compteur())
    const seconde = recopierFlux(premiere.grille, loyer, 0, "annee", compteur())

    expect(premiere.ajouts).toBe(11)
    expect(seconde).toEqual({ grille: premiere.grille, ajouts: 0 })
    expect(seconde.grille).toBe(premiere.grille)
  })

  it("modifie depuis janvier les onze mois suivants, depuis décembre le seul mois de décembre", () => {
    const grille = chaqueMois()

    const depuisJanvier = modifierSerie(grille, grille[0].flows[0], 0, "suivants", { amount: 35 })
    expect(depuisJanvier.touches).toBe(11)
    expect(montants(depuisJanvier.grille)).toEqual(Array.from({ length: 12 }, () => [35]))

    const depuisDecembre = modifierSerie(grille, grille[11].flows[0], 11, "suivants", { amount: 35 })
    expect(depuisDecembre.touches).toBe(0)
    expect(montants(depuisDecembre.grille)).toEqual([...Array.from({ length: 11 }, () => [30]), [35]])
  })

  it("supprime toute la série sur l'année, même là où le montant diffère", () => {
    // 30 € de janvier à juin, 35 € ensuite : même acteur, même type, même libellé, c'est la même série.
    const grille: MonthlyGridData = Array.from({ length: 12 }, (_, month) => ({ month, flows: [abonnement(month, month < 6 ? 30 : 35)] }))

    const { grille: resultat, touches } = supprimerSerie(grille, grille[2].flows[0], 2, "annee")

    expect(touches).toBe(11)
    expect(resultat.every(mois => mois.flows.length === 0)).toBe(true)
  })

  it("ne touche pas au flux de même libellé d'un autre acteur, ni à celui d'un autre type", () => {
    // Bob a lui aussi un « Abonnement » ; Alice a un revenu nommé « Abonnement » (type différent).
    const deBob = (month: number): FinancialFlow => ({ ...abonnement(month), id: `bob-${month}`, entityId: "personne-bob" })
    const revenu = (month: number): FinancialFlow => ({ ...abonnement(month), id: `revenu-${month}`, type: "other_taxable_income" })
    const grille: MonthlyGridData = Array.from({ length: 12 }, (_, month) => ({ month, flows: [abonnement(month), deBob(month), revenu(month)] }))
    const autres = (g: MonthlyGridData) => g.map(mois => mois.flows.filter(f => !f.id.startsWith("abo-")))

    const modifiee = modifierSerie(grille, grille[0].flows[0], 0, "annee", { amount: 99, label: "Abonnement presse" })
    const supprimee = supprimerSerie(grille, grille[0].flows[0], 0, "annee")
    const recopiee = recopierFlux(grille, { ...abonnement(0), id: "nouveau" }, 0, "annee", compteur())

    expect(autres(modifiee.grille)).toEqual(autres(grille))
    expect(modifiee.grille.every(mois => mois.flows[0].amount === 99)).toBe(true)
    expect(autres(supprimee.grille)).toEqual(autres(grille))
    expect(supprimee.grille.every(mois => mois.flows.length === 2)).toBe(true)
    // Le flux d'Alice est déjà présent chaque mois : rien à recopier, malgré les homonymes.
    expect(recopiee.ajouts).toBe(0)
  })

  it("reconnaît la série d'après le flux avant modification : un changement de libellé emporte les mois suivants", () => {
    const grille = chaqueMois()

    const { grille: renommee } = modifierSerie(grille, grille[6].flows[0], 6, "suivants", { label: "Abonnement pro" })

    expect(renommee.map(mois => mois.flows[0].label)).toEqual([...Array.from({ length: 6 }, () => "Abonnement"), ...Array.from({ length: 6 }, () => "Abonnement pro")])
    // Les mois renommés forment désormais une autre série : la supprimer depuis juillet laisse le premier semestre.
    expect(supprimerSerie(renommee, renommee[6].flows[0], 6, "annee").grille.map(mois => mois.flows.length)).toEqual([...Array.from({ length: 6 }, () => 1), ...Array.from({ length: 6 }, () => 0)])
  })
})

describe("supprimerSerie", () => {
  function annee(): MonthlyGridData {
    return Array.from({ length: 12 }, (_, month) => ({ month, flows: [{ id: `abo-${month}`, entityId: "personne-alice", type: "expense" as const, label: "Abonnement", amount: 30 }] }))
  }

  it("supprime le flux du mois ouvert seulement, par défaut", () => {
    const grille = annee()
    const { grille: resultat, touches } = supprimerSerie(grille, grille[3].flows[0], 3, "mois")
    expect(touches).toBe(0)
    expect(resultat.map(mois => mois.flows.length)).toEqual([1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1])
  })

  it("supprime la série sur les mois suivants ou sur toute l'année", () => {
    const grille = annee()
    expect(supprimerSerie(grille, grille[9].flows[0], 9, "suivants").grille.map(mois => mois.flows.length)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0])
    const { grille: vide, touches } = supprimerSerie(grille, grille[9].flows[0], 9, "annee")
    expect(touches).toBe(11)
    expect(vide.every(mois => mois.flows.length === 0)).toBe(true)
  })

  it("ne touche pas aux mois sans flux de la série", () => {
    const grille = annee()
    grille[11] = { month: 11, flows: [] }
    const { grille: resultat, touches } = supprimerSerie(grille, grille[9].flows[0], 9, "suivants")
    expect(touches).toBe(1)
    expect(resultat[11]).toBe(grille[11])
  })
})
