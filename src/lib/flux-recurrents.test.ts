// src/lib/flux-recurrents.test.ts

import { describe, expect, it } from "vitest"
import type { AnneeSimulee, FinancialFlow, MonthlyGridData } from "@/types"
import { ajouterDansLesAnnees, anneesDuRaccourci, LIBELLES_RACCOURCIS_ANNEES, listerAnnees, SEUIL_RACCOURCIS_ANNEES, modifierDansLesAnnees, modifierSerie, moisCibles, moisDesAutresAnnees, montantsMensuels, recopierFlux, repartirDansLesAnnees, repartirSurLAnnee, resumerMoisTouches, supprimerDansLesAnnees, supprimerSerie, type CibleDansLesAnnees, type PorteeRecurrence } from "./flux-recurrents"

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

describe("montant annuel réparti sur les douze mois", () => {
  const centimes = (montants: number[]) => montants.reduce((total, m) => total + Math.round(m * 100), 0)

  it("onze douzièmes au centime inférieur et le reste en décembre : l'année totalise le montant saisi", () => {
    const montants = montantsMensuels(55000)
    expect(montants.slice(0, 11)).toEqual(Array(11).fill(4583.33))
    expect(montants[11]).toBe(4583.37)
    expect(centimes(montants)).toBe(5_500_000)
  })

  it("un montant divisible par douze donne douze mois égaux", () => {
    expect(montantsMensuels(1200)).toEqual(Array(12).fill(100))
  })

  it("ajoute une série de douze flux, un par mois, de nouveaux identifiants", () => {
    const flux: FinancialFlow = { id: "f", entityId: "m", type: "ca_micro_services_bnc", label: "Prestations", amount: 55000 }
    const { grille, touches } = repartirSurLAnnee(grilleVide(), flux, compteur())
    expect(touches).toBe(12)
    expect(grille.map(m => m.flows.length)).toEqual(Array(12).fill(1))
    expect(grille[0].flows[0]).toEqual({ ...flux, id: "copie-1", amount: 4583.33 })
    expect(grille[11].flows[0]).toEqual({ ...flux, id: "copie-12", amount: 4583.37 })
  })

  it("répartit aussi sur les années cochées", () => {
    const annees: AnneeSimulee[] = [2026, 2027, 2028].map(annee => ({ annee, monthlyData: grilleVide() }))
    const flux: FinancialFlow = { id: "f", entityId: "m", type: "ca_micro_vente", label: "Ventes", amount: 1200 }
    const resultat = repartirDansLesAnnees(annees, flux, { annee: 2026, depuis: 3, portee: "mois", autresAnnees: [2028] }, compteur())
    expect(resultat.touches).toEqual([{ annee: 2026, mois: 12 }, { annee: 2028, mois: 12 }])
    expect(resultat.annees[1]).toBe(annees[1])
    expect(resultat.annees[2].monthlyData.every(m => m.flows[0]?.amount === 100)).toBe(true)
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

describe("raccourcis pour cocher les autres années", () => {
  const autres = [2024, 2025, 2027, 2028, 2029]

  it("ne les propose qu'au-delà de quatre autres années", () => {
    expect(SEUIL_RACCOURCIS_ANNEES).toBe(4)
  })

  it.each([
    ["toutes", [2024, 2025, 2027, 2028, 2029]],
    ["aucune", []],
    ["precedentes", [2024, 2025]],
    ["suivantes", [2027, 2028, 2029]]
  ] as const)("« %s » coche les bonnes années, par rapport à l'année affichée", (raccourci, attendues) => {
    expect(anneesDuRaccourci(raccourci, 2026, autres)).toEqual(attendues)
  })

  it("ne coche jamais l'année affichée, même si elle figure dans la liste", () => {
    expect(anneesDuRaccourci("toutes", 2026, [2025, 2026, 2027])).toEqual([2025, 2027])
  })

  it("ne trouve aucune année précédente depuis la plus ancienne", () => {
    expect(anneesDuRaccourci("precedentes", 2024, [2025, 2026])).toEqual([])
  })

  it("nomme chaque raccourci en reprenant son texte visible", () => {
    for (const { texte, nom } of Object.values(LIBELLES_RACCOURCIS_ANNEES)) {
      expect(nom.toLowerCase()).toContain(texte.toLowerCase())
    }
  })
})
