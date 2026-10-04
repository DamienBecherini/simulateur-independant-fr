// src/backend/logic/cotisationsSalarie.test.ts

import { describe, expect, it } from "vitest"
import { brutPourUnNet, calculerCotisationsSalarie, reductionGenerale } from "./cotisationsSalarie.js"
import { reglesDeTest } from "./testing/regles-de-test.js"

/*
 * Règles de test (voir regles-de-test.ts) : plafond de 40 000 €. Sous le plafond, cotisations salariales de 10 % et
 * CSG-CRDS de 10 % sur 90 % du brut : net = 81 % du brut. Cotisations patronales de 34 % pour le président, 39 % pour
 * un salarié (chômage 4 % et AGS 1 %). Réduction générale : 2 % + 38 % x (60 000 / brut - 1) / 2, au plus 40 %.
 */
const regles = reglesDeTest.regimeGeneral

describe("calculerCotisationsSalarie", () => {
  it("président sous le plafond : 19 % de cotisations salariales, 34 % de patronales, sans chômage ni réduction", () => {
    const president = calculerCotisationsSalarie(10000, "president", regles)

    expect(president.cotisations.vieillessePlafonnee).toEqual({ salariale: 500, patronale: 1000 })
    expect(president.cotisations.retraiteComplementaire.salariale).toBeCloseTo(400)
    expect(president.cotisations.retraiteComplementaire.patronale).toBeCloseTo(600)
    expect(president.cotisations.assuranceChomage).toEqual({ salariale: 0, patronale: 0 })
    expect(president.cotisations.ags).toEqual({ salariale: 0, patronale: 0 })
    expect(president.cotisations.contributionEquilibreTechnique).toEqual({ salariale: 0, patronale: 0 })
    // CSG-CRDS sur 9 000 € : 630 € déductibles, 270 € non déductibles.
    expect(president.cotisations.csgDeductible.salariale).toBeCloseTo(630)
    expect(president.cotisations.csgNonDeductibleEtCrds).toEqual({ salariale: expect.closeTo(270, 6), patronale: 0 })
    expect(president).toMatchObject({ statut: "president", brut: 10000, reductionGenerale: 0 })
    expect(president.totalSalarial).toBeCloseTo(1900)
    expect(president.net).toBeCloseTo(8100)
    expect(president.totalPatronal).toBeCloseTo(3400)
    expect(president.coutEmployeur).toBeCloseTo(13400)
    expect(president.partNonDeductible).toBeCloseTo(270)
  })

  it("salarié à 2 SMIC : chômage et AGS en plus, et la réduction générale", () => {
    // Patronales 39 % de 40 000 = 15 600 € ; réduction 11,5 % de 40 000 = 4 600 € ; coût 40 000 + 15 600 - 4 600 = 51 000 €.
    const salarie = calculerCotisationsSalarie(40000, "salarie", regles)

    expect(salarie.cotisations.assuranceChomage.patronale).toBeCloseTo(1600)
    expect(salarie.cotisations.ags.patronale).toBeCloseTo(400)
    expect(salarie.totalPatronal).toBeCloseTo(15600)
    expect(salarie.reductionGenerale).toBeCloseTo(4600)
    expect(salarie.coutEmployeur).toBeCloseTo(51000)
    expect(salarie.net).toBeCloseTo(32400)
  })

  it("la réduction générale ne dépasse pas les cotisations patronales", () => {
    // Au SMIC, 40 % de réduction pour 39 % de cotisations : elles sont entièrement effacées.
    const salarie = calculerCotisationsSalarie(20000, "salarie", regles)

    expect(salarie.reductionGenerale).toBeCloseTo(7800)
    expect(salarie.coutEmployeur).toBeCloseTo(20000)
  })

  it("au-delà du plafond : tranches plafonnées, tranche 2 de la complémentaire et contribution d'équilibre technique sur tout le brut", () => {
    // Salariales : vieillesse 2 000 + 600, complémentaire 1 600 + 2 000, CET 600, CSG-CRDS 10 % de 54 000 = 5 400 ; total 12 200 €.
    // Patronales du président : maladie 6 000, vieillesse 4 000 + 1 200, famille 3 000, AT 600, complémentaire 2 400 + 3 000, CET 600 ; 20 800 €.
    const president = calculerCotisationsSalarie(60000, "president", regles)

    expect(president.cotisations.contributionEquilibreTechnique.salariale).toBeCloseTo(600)
    expect(president.totalSalarial).toBeCloseTo(12200)
    expect(president.net).toBeCloseTo(47800)
    expect(president.totalPatronal).toBeCloseTo(20800)

    // Le salarié paie en plus 2 400 € de chômage et 600 € d'AGS ; à 3 SMIC, plus de réduction générale.
    expect(calculerCotisationsSalarie(60000, "salarie", regles)).toMatchObject({ totalPatronal: expect.closeTo(23800, 6), reductionGenerale: 0 })
  })

  it("CSG-CRDS sur tout le brut au-delà de 4 plafonds", () => {
    // Assiette : 90 % de 160 000 + 40 000 = 184 000 € ; CSG déductible 7 %.
    expect(calculerCotisationsSalarie(200000, "president", regles).cotisations.csgDeductible.salariale).toBeCloseTo(12880)
  })

  it("rien sans rémunération", () => {
    expect(calculerCotisationsSalarie(0, "salarie", regles)).toMatchObject({ net: 0, totalSalarial: 0, totalPatronal: 0, reductionGenerale: 0, coutEmployeur: 0 })
  })
})

describe("reductionGenerale", () => {
  const rg = regles.reductionGenerale

  it("est maximale jusqu'au SMIC et dégressive jusqu'à 3 SMIC", () => {
    expect(reductionGenerale(10000, rg)).toBeCloseTo(4000)
    expect(reductionGenerale(20000, rg)).toBeCloseTo(8000)
    expect(reductionGenerale(40000, rg)).toBeCloseTo(4600)
  })

  it("garde le minimum de 2 % juste sous 3 SMIC, et s'éteint à 3 SMIC", () => {
    // Coefficient 2,0003 % arrondi à 4 décimales : 2 %.
    expect(reductionGenerale(59999, rg)).toBeCloseTo(1199.98)
    expect(reductionGenerale(60000, rg)).toBe(0)
    expect(reductionGenerale(0, rg)).toBe(0)
  })

  it("arrondit le coefficient à 4 décimales", () => {
    // À 33 000 € : 2 % + 38 % x (60 000 / 33 000 - 1) / 2 = 2 % + 38 % x 0,40909 = 17,5454 %, arrondi à 17,55 %.
    expect(reductionGenerale(33000, rg)).toBeCloseTo(33000 * 0.1755, 6)
  })
})

describe("brutPourUnNet", () => {
  it("retrouve le brut dont la rémunération est le net", () => {
    expect(brutPourUnNet(8100, "president", regles)).toBeCloseTo(10000, 6)
    expect(brutPourUnNet(47800, "president", regles)).toBeCloseTo(60000, 6)
    expect(brutPourUnNet(24300, "salarie", regles)).toBeCloseTo(30000, 6)
  })

  it("ne fabrique pas de brut sans rémunération", () => {
    expect(brutPourUnNet(0, "president", regles)).toBe(0)
    expect(brutPourUnNet(-500, "salarie", regles)).toBe(0)
  })
})
