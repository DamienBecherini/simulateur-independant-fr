// src/backend/logic/dispositifs.test.ts

import { describe, expect, it } from "vitest"
import { grilleVide } from "../../types.js"
import { calculerMicro } from "./calculsAE.js"
import { acreDeLAnnee, ecrireMois, joursDActivite, libelleDuMois, lireMois, moisCouverts, noteACRE, noteCFE, partDeCFEDue, periodeACRE, prorataDesPlafonds, regimesMicroDesAnnees } from "./dispositifs.js"
import { evaluerProtectionSociale } from "./protection-sociale.js"
import { reglesDeLAnnee, reglesEnVigueur } from "./regles.js"

const regles2025 = reglesDeLAnnee(2025).regles!

describe("mois de création", () => {
  it("lit et écrit « AAAA-MM »", () => {
    expect(lireMois("2026-09")).toEqual({ annee: 2026, mois: 9 })
    expect(ecrireMois({ annee: 2026, mois: 9 })).toBe("2026-09")
    expect(libelleDuMois({ annee: 2027, mois: 6 })).toBe("juin 2027")
    expect(libelleDuMois({ annee: 2027, mois: 6 }, false)).toBe("juin")
  })

  it("écarte une valeur absente ou mal formée", () => {
    for (const valeur of [undefined, "", "2026-13", "2026-00", "2026-9", "septembre 2026"]) expect(lireMois(valeur), String(valeur)).toBeNull()
  })
})

describe("prorata des plafonds l'année de création", () => {
  it("compte les jours du 1er du mois de création au 31 décembre", () => {
    expect(joursDActivite({ annee: 2026, mois: 9 })).toBe(122)
    expect(joursDActivite({ annee: 2026, mois: 1 })).toBe(365)
    expect(joursDActivite({ annee: 2028, mois: 1 })).toBe(366)
  })

  it("ne réduit que l'année de création, jamais au-delà de l'année entière", () => {
    expect(prorataDesPlafonds({ annee: 2026, mois: 9 }, 2026)).toBeCloseTo(122 / 365, 10)
    expect(prorataDesPlafonds({ annee: 2026, mois: 9 }, 2027)).toBe(1)
    expect(prorataDesPlafonds({ annee: 2028, mois: 1 }, 2028)).toBe(1)
    expect(prorataDesPlafonds(null, 2026)).toBe(1)
  })
})

describe("période de l'ACRE d'une micro-entreprise", () => {
  it("court jusqu'à la fin du 3e trimestre civil qui suit celui du début d'activité (exemple de F11677)", () => {
    // Début le 3 septembre 2026 (3e trimestre) : fin le 30 juin 2027. Début en juillet : même fin, sur 12 mois.
    expect(periodeACRE({ annee: 2026, mois: 9 }, reglesEnVigueur)).toEqual({ debut: { annee: 2026, mois: 9 }, fin: { annee: 2027, mois: 6 }, reduction: 0.25 })
    expect(periodeACRE({ annee: 2026, mois: 7 }, reglesEnVigueur).fin).toEqual({ annee: 2027, mois: 6 })
    expect(periodeACRE({ annee: 2026, mois: 12 }, reglesEnVigueur).fin).toEqual({ annee: 2027, mois: 9 })
    expect(periodeACRE({ annee: 2026, mois: 1 }, reglesEnVigueur).fin).toEqual({ annee: 2026, mois: 12 })
  })

  it("réduit de 50 % pour une création jusqu'en juin 2026, de 25 % à partir de juillet 2026", () => {
    expect(periodeACRE({ annee: 2026, mois: 6 }, reglesEnVigueur).reduction).toBe(0.5)
    expect(periodeACRE({ annee: 2026, mois: 7 }, reglesEnVigueur).reduction).toBe(0.25)
    expect(periodeACRE({ annee: 2025, mois: 3 }, regles2025).reduction).toBe(0.5)
    // Avant les taux connus (création d'avant 2020), la réduction de l'année.
    expect(periodeACRE({ annee: 2019, mois: 3 }, reglesEnVigueur).reduction).toBe(reglesEnVigueur.microEntreprise.reductionACRE)
  })

  it("donne les mois couverts de chaque année", () => {
    const periode = periodeACRE({ annee: 2026, mois: 9 }, reglesEnVigueur)
    expect(moisCouverts(periode, 2025)).toEqual([])
    expect(moisCouverts(periode, 2026)).toEqual([8, 9, 10, 11])
    expect(moisCouverts(periode, 2027)).toEqual([0, 1, 2, 3, 4, 5])
    expect(moisCouverts(periode, 2028)).toEqual([])
  })

  it("ne s'applique qu'avec l'ACRE et une date de création", () => {
    const grille = grilleVide()
    expect(acreDeLAnnee({ id: "m1", beneficieACRE: false, dateDeCreation: "2026-09" }, 2026, grille, reglesEnVigueur)).toBeNull()
    expect(acreDeLAnnee({ id: "m1", beneficieACRE: true }, 2026, grille, reglesEnVigueur)).toBeNull()
    expect(acreDeLAnnee({ id: "m1", beneficieACRE: true, dateDeCreation: "2026-09" }, 2026, grille, reglesEnVigueur)?.mois).toEqual([8, 9, 10, 11])
  })

  it("n'écrit pas de note une année que l'aide ne couvre pas, et dit « en » pour un seul mois", () => {
    const acre = acreDeLAnnee({ id: "m1", beneficieACRE: true, dateDeCreation: "2026-12" }, 2028, grilleVide(), reglesEnVigueur)!
    expect(noteACRE(acre, 2028, 0)).toBeNull()
    const decembre = acreDeLAnnee({ id: "m1", beneficieACRE: true, dateDeCreation: "2026-12" }, 2026, grilleVide(), reglesEnVigueur)!
    expect(noteACRE(decembre, 2026, 0)).toMatch(/sur le chiffre d'affaires en décembre 2026,/)
  })
})

describe("cotisations d'une micro-entreprise avec l'ACRE sur une partie de l'année", () => {
  const entrees = { caVente: 0, caServicesBic: 0, caServicesBnc: 40000, beneficieACRE: true, opteVFL: false }

  it("ne réduit que le chiffre d'affaires des mois couverts, sans l'avertissement d'une année entière", () => {
    // 40 000 x 25,6 % = 10 240 € ; réduction 10 000 x 25,6 % x 25 % = 640 € ; dû : 9 600 €, plus 0,2 % de formation
    // professionnelle que l'ACRE ne réduit pas (80 €).
    const resultat = calculerMicro({ ...entrees, caSousACRE: { caVente: 0, caServicesBic: 0, caServicesBnc: 10000 }, reductionACRE: 0.25 }, reglesEnVigueur)
    expect(resultat.cotisationsSociales).toBeCloseTo(9600 + 80, 6)
    expect(resultat.warnings.some(w => w.startsWith("ACRE"))).toBe(false)
  })

  it("sans mois couverts, à plein taux", () => {
    expect(calculerMicro({ ...entrees, caSousACRE: { caVente: 0, caServicesBic: 0, caServicesBnc: 0 }, reductionACRE: 0.25 }, reglesEnVigueur).cotisationsSociales).toBeCloseTo(10240 + 80, 6)
  })

  it("compte les droits à la retraite sur les cotisations réduites des seuls mois couverts", () => {
    const chiffreAffairesMicro = { caVente: 0, caServicesBic: 0, caServicesBnc: 40000 }
    const toute = evaluerProtectionSociale("micro", { remunerationBrute: 0, assietteTNS: 0, chiffreAffairesMicro, beneficieACRE: true }, reglesEnVigueur)
    const partielle = evaluerProtectionSociale("micro", { remunerationBrute: 0, assietteTNS: 0, chiffreAffairesMicro, beneficieACRE: true, acre: { reduction: 0.25, chiffreAffaires: { caVente: 0, caServicesBic: 0, caServicesBnc: 10000 } } }, reglesEnVigueur)
    const terminee = evaluerProtectionSociale("micro", { remunerationBrute: 0, assietteTNS: 0, chiffreAffairesMicro, beneficieACRE: true, acre: { reduction: 0.25, chiffreAffaires: { caVente: 0, caServicesBic: 0, caServicesBnc: 0 } } }, reglesEnVigueur)
    expect(partielle.trimestres).toBeGreaterThanOrEqual(toute.trimestres)
    expect(partielle.resume).toMatch(/ACRE/)
    expect(terminee.resume).not.toMatch(/ACRE/)
  })
})

describe("CFE d'une activité créée récemment", () => {
  const mars2026 = { annee: 2026, mois: 3 }

  it("rien l'année de création (ni avant), la moitié l'année suivante, tout ensuite", () => {
    expect([2025, 2026, 2027, 2028].map(annee => partDeCFEDue(mars2026, annee, reglesEnVigueur))).toEqual([0, 0, 0.5, 1])
    expect(partDeCFEDue(null, 2026, reglesEnVigueur)).toBe(1)
  })

  it("le dit, sauf quand elle est due en entier", () => {
    expect(noteCFE(mars2026, 2025, reglesEnVigueur)).toBe("CFE non comptée en 2025 : l'activité n'est créée qu'en mars 2026.")
    expect(noteCFE(mars2026, 2028, reglesEnVigueur)).toBeNull()
    expect(noteCFE(null, 2026, reglesEnVigueur)).toBeNull()
  })
})

describe("régime des micro-entreprises d'une session", () => {
  const avecCA = (montant: number) => {
    const grille = grilleVide()
    grille[0].flows.push({ id: `ca-${montant}`, label: "CA", amount: montant, entityId: "m1", type: "ca_micro_services_bnc" })
    return grille
  }

  it("ignore une année sans règles connues et les années avant la création", () => {
    const session = {
      entities: [{ id: "m1", type: "micro-entreprise", dateDeCreation: "2026-01" }],
      annees: [2023, 2024, 2025, 2026, 2027].map(annee => ({ annee, monthlyData: avecCA(200000) }))
    }
    const regimes = regimesMicroDesAnnees(session)
    expect(regimes.get(2023)).toEqual({ sorties: {}, annonces: {}, retours: [] })
    // Créée en 2026 : 2024 et 2025 ne comptent pas, malgré leur chiffre d'affaires ; 2026 et 2027 au-delà : sortie en 2028.
    expect(regimes.get(2026)?.sorties).toEqual({})
    expect(regimes.get(2027)?.annonces).toEqual({ m1: { depuis: 2028, depassements: [2026, 2027] } })
  })

  it("ne concerne que les micro-entreprises", () => {
    const session = { entities: [{ id: "m1", type: "company" }], annees: [2026, 2027, 2028].map(annee => ({ annee, monthlyData: avecCA(200000) })) }
    expect(regimesMicroDesAnnees(session).get(2028)?.sorties).toEqual({})
  })
})
