// src/lib/flux-recurrents.test.ts

import { describe, expect, it } from "vitest"
import type { AnneeSimulee, FinancialFlow, MonthlyGridData } from "@/types"
import { ajouterDansLesAnnees, listerAnnees, modifierDansLesAnnees, modifierSerie, moisCibles, moisDesAutresAnnees, recopierFlux, resumerMoisTouches, supprimerDansLesAnnees, supprimerSerie, type CibleDansLesAnnees, type PorteeRecurrence } from "./flux-recurrents"

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

describe("sur plusieurs années", () => {
  /** Trois années : 2025 et 2027 vides, 2026 avec le loyer en mars. */
  function session(): AnneeSimulee[] {
    const grille2026 = grilleVide()
    grille2026[2] = { month: 2, flows: [loyer] }
    return [
      { annee: 2025, monthlyData: grilleVide() },
      { annee: 2026, monthlyData: grille2026 },
      { annee: 2027, monthlyData: grilleVide() }
    ]
  }
  const nombreDeFlux = (a: AnneeSimulee) => a.monthlyData.map(mois => mois.flows.length)
  const nouveau: FinancialFlow = { id: "nouveau", entityId: "personne-alice", type: "expense", label: "Abonnement", amount: 30 }
  const cible = (portee: PorteeRecurrence, autresAnnees: number[], depuis = 6): CibleDansLesAnnees => ({ annee: 2026, depuis, portee, autresAnnees })

  it("vise dans les autres années les mêmes mois que dans l'année affichée, le mois ouvert compris", () => {
    expect(moisDesAutresAnnees(6, "mois")).toEqual([6])
    expect(moisDesAutresAnnees(9, "suivants")).toEqual([9, 10, 11])
    expect(moisDesAutresAnnees(2, "annee")).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  describe("ajouterDansLesAnnees", () => {
    it("« ce mois seulement » : le même mois dans les années cochées, pas dans les autres", () => {
      const annees = session()
      const { annees: resultat, touches } = ajouterDansLesAnnees(annees, nouveau, cible("mois", [2027]), compteur())
      expect(nombreDeFlux(resultat[1])[6]).toBe(1)
      expect(nombreDeFlux(resultat[2])).toEqual([0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0])
      expect(resultat[0]).toBe(annees[0])
      expect(touches).toEqual([{ annee: 2027, mois: 1 }])
    })

    it("« ce mois et les suivants » : les mêmes mois, de juillet à décembre, dans chaque année cochée", () => {
      const { annees: resultat, touches } = ajouterDansLesAnnees(session(), nouveau, cible("suivants", [2025, 2027]), compteur())
      const juilletADecembre = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]
      expect(nombreDeFlux(resultat[0])).toEqual(juilletADecembre)
      expect(nombreDeFlux(resultat[2])).toEqual(juilletADecembre)
      expect(touches).toEqual([
        { annee: 2025, mois: 6 },
        { annee: 2026, mois: 5 },
        { annee: 2027, mois: 6 }
      ])
    })

    it("« tous les mois de l'année » : chaque mois de chaque année cochée, avec de nouveaux identifiants", () => {
      const { annees: resultat, touches } = ajouterDansLesAnnees(session(), nouveau, cible("annee", [2025]), compteur())
      expect(resultat[0].monthlyData.every(mois => mois.flows.length === 1)).toBe(true)
      expect(touches).toEqual([
        { annee: 2025, mois: 12 },
        { annee: 2026, mois: 11 }
      ])
      const ids = resultat.flatMap(a => a.monthlyData.flatMap(mois => mois.flows.filter(f => f.label === "Abonnement").map(f => f.id)))
      expect(new Set(ids).size).toBe(24)
    })

    it("ne crée pas de doublon là où un flux identique existe déjà dans une autre année", () => {
      const annees = session()
      annees[2].monthlyData[8] = { month: 8, flows: [{ ...nouveau, id: "deja-la" }] }
      const { annees: resultat, touches } = ajouterDansLesAnnees(annees, nouveau, cible("suivants", [2027]), compteur())
      expect(resultat[2].monthlyData[8].flows.map(f => f.id)).toEqual(["deja-la"])
      expect(touches).toContainEqual({ annee: 2027, mois: 5 })
    })

    it("ignore une année cochée absente de la session et l'année affichée cochée par erreur", () => {
      const { touches } = ajouterDansLesAnnees(session(), nouveau, cible("mois", [2026, 2030]), compteur())
      expect(touches).toEqual([])
    })
  })

  describe("modifierDansLesAnnees", () => {
    it("reporte un nouveau montant sur la série dans les mêmes mois des années cochées", () => {
      const annees = session()
      annees[2].monthlyData = grilleVide().map((mois, index) => ({ ...mois, flows: [{ ...loyer, id: `loyer-2027-${index}`, amount: 820 }] }))
      const { annees: resultat, touches } = modifierDansLesAnnees(annees, loyer, cible("suivants", [2027], 2), { amount: 900 })
      expect(resultat[1].monthlyData[2].flows[0].amount).toBe(900)
      expect(resultat[2].monthlyData.map(mois => mois.flows[0].amount)).toEqual([820, 820, 900, 900, 900, 900, 900, 900, 900, 900, 900, 900])
      expect(touches).toEqual([{ annee: 2027, mois: 10 }])
    })

    it("ne touche pas aux années non cochées ni aux autres flux", () => {
      const annees = session()
      annees[0].monthlyData[2] = { month: 2, flows: [{ ...loyer, id: "loyer-2025" }, { ...loyer, id: "autre", label: "Assurance" }] }
      annees[2].monthlyData[2] = { month: 2, flows: [{ ...loyer, id: "loyer-2027" }] }
      const { annees: resultat } = modifierDansLesAnnees(annees, loyer, cible("mois", [2025], 2), { label: "Logement" })
      expect(resultat[0].monthlyData[2].flows.map(f => f.label)).toEqual(["Logement", "Assurance"])
      expect(resultat[2]).toBe(annees[2])
    })
  })

  describe("supprimerDansLesAnnees", () => {
    it("supprime la série de toute l'année affichée et des années cochées", () => {
      const annees = session().map(a => ({ ...a, monthlyData: grilleVide().map((mois, index) => ({ ...mois, flows: [{ ...loyer, id: `loyer-${a.annee}-${index}` }] })) }))
      const { annees: resultat, touches } = supprimerDansLesAnnees(annees, annees[1].monthlyData[2].flows[0], cible("annee", [2025, 2027], 2))
      expect(resultat.every(a => a.monthlyData.every(mois => mois.flows.length === 0))).toBe(true)
      expect(resumerMoisTouches(touches)).toBe("12 mois en 2025, 11 mois en 2026 et 12 mois en 2027")
    })

    it("garde la référence d'une année cochée où la série n'existe pas", () => {
      const annees = session()
      const { annees: resultat, touches } = supprimerDansLesAnnees(annees, loyer, cible("mois", [2025], 2))
      expect(resultat[0]).toBe(annees[0])
      expect(resultat[1].monthlyData[2].flows).toEqual([])
      expect(touches).toEqual([])
    })
  })

  it("résume les mois touchés et énumère les années", () => {
    expect(resumerMoisTouches([])).toBe("")
    expect(resumerMoisTouches([{ annee: 2026, mois: 11 }])).toBe("11 mois en 2026")
    expect(resumerMoisTouches([{ annee: 2026, mois: 11 }, { annee: 2027, mois: 12 }])).toBe("11 mois en 2026 et 12 mois en 2027")
    expect(listerAnnees([2027, 2025])).toBe("2025 et 2027")
    expect(listerAnnees([2024])).toBe("2024")
    expect(listerAnnees([])).toBe("")
  })
})
