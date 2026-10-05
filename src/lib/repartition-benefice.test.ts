// src/lib/repartition-benefice.test.ts

import { describe, expect, it } from "vitest"
import type { PartageDuBenefice } from "@/types"
import { apercuDuPartage, auPas, coutEstime, partDistribueeDe, POSTES, postesArrondis, remunerationPourUnCout, valeurAuClavier } from "./repartition-benefice"

/** SASU qui dégage 90 000 € avant rémunération : 24 300 € nets coûtent 40 200 €, 8 450 € d'IS, 20 000 € versés. */
const partage: PartageDuBenefice = { beneficeAvantRemuneration: 90000, remunerationNette: 24300, cotisationsRemuneration: 15900, impotSocietes: 8450, dividendesNets: 20000, cotisationsSurDividendes: 0, resultatConserve: 21350 }
const somme = (p: PartageDuBenefice) => POSTES.reduce((total, poste) => total + p[poste], 0)

describe("postesArrondis", () => {
  it("arrondit chaque poste à l'euro en gardant la somme égale au bénéfice arrondi", () => {
    const p = { ...partage, beneficeAvantRemuneration: 90000.4, remunerationNette: 24300.4, cotisationsRemuneration: 15900.4, impotSocietes: 8449.6, resultatConserve: 21350 }
    const arrondis = postesArrondis(p)
    expect(Object.values(arrondis).reduce((a, b) => a + b, 0)).toBe(Math.round(somme(p)))
    expect(arrondis.impotSocietes).toBe(8450)
  })
})

describe("partDistribueeDe", () => {
  it("rapporte les dividendes versés au bénéfice distribuable", () => {
    expect(partDistribueeDe(partage)).toBeCloseTo(20000 / 41350, 10)
    expect(partDistribueeDe({ ...partage, dividendesNets: 0, resultatConserve: 0 })).toBe(0)
  })
})

describe("coût estimé d'une rémunération", () => {
  it("est exact pour la rémunération simulée, interpolé ailleurs, et sa réciproque redonne la rémunération", () => {
    expect(coutEstime(partage, 50000, 24300)).toBe(40200)
    expect(coutEstime(partage, 50000, 12150)).toBeCloseTo(20100, 6)
    expect(coutEstime(partage, 50000, 50000)).toBeCloseTo(90000, 6)
    expect(remunerationPourUnCout(partage, 50000, 20100)).toBeCloseTo(12150, 6)
    expect(remunerationPourUnCout(partage, 50000, -10)).toBe(0)
  })

  it("part du coût connu quand la rémunération simulée est nulle (cotisations minimales d'EURL)", () => {
    const sansRemuneration = { ...partage, remunerationNette: 0, cotisationsRemuneration: 1000 }
    expect(coutEstime(sansRemuneration, 40000, 20000)).toBeCloseTo(45500, 6)
    expect(remunerationPourUnCout(sansRemuneration, 40000, 500)).toBe(0)
    // Sans rémunération maximale connue au-delà, le coût reste celui qui est connu.
    expect(coutEstime(sansRemuneration, 0, 1000)).toBe(1000)
  })
})

describe("apercuDuPartage", () => {
  it("redonne le partage exact pour la rémunération et la part simulées", () => {
    const apercu = apercuDuPartage(partage, 50000, 24300, partDistribueeDe(partage))
    for (const poste of POSTES) expect(apercu[poste]).toBeCloseTo(partage[poste], 6)
  })

  it("garde la somme des postes égale au bénéfice quand on change la rémunération ou la part", () => {
    const apercu = apercuDuPartage(partage, 50000, 10000, 0.5)
    expect(somme(apercu)).toBeCloseTo(90000, 6)
    expect(apercu.dividendesNets).toBeCloseTo(apercu.resultatConserve, 6)
    expect(apercu.impotSocietes).toBeGreaterThan(partage.impotSocietes)
  })

  it("fait suivre les cotisations sur dividendes, et ne prélève rien d'un bénéfice épuisé", () => {
    const eurl = { ...partage, dividendesNets: 15000, cotisationsSurDividendes: 5000 }
    expect(apercuDuPartage(eurl, 50000, 24300, 0.25 * partDistribueeDe(eurl)).cotisationsSurDividendes).toBeCloseTo(1250, 6)
    const epuise = { ...partage, remunerationNette: 60000, cotisationsRemuneration: 40000, impotSocietes: 0, dividendesNets: 0, resultatConserve: -10000 }
    const apercu = apercuDuPartage(epuise, 50000, 40000, 1)
    expect(apercu.impotSocietes).toBe(0)
    expect(apercu.cotisationsSurDividendes).toBe(0)
    expect(somme(apercu)).toBeCloseTo(90000, 6)
  })
})

describe("pas des curseurs", () => {
  it("arrondit au pas et ramène entre les bornes", () => {
    expect(auPas(0.35000000000000003, 0.05, 0, 1)).toBe(0.35)
    expect(auPas(12345, 100, 0, 10000)).toBe(10000)
    expect(auPas(-3, 100, 0, 10000)).toBe(0)
  })

  it("répond aux flèches, aux pages, au début et à la fin", () => {
    const bornes = { min: 0, max: 10000, pas: 100, grandPas: 1000 }
    expect(valeurAuClavier("ArrowRight", 5000, bornes)).toBe(5100)
    expect(valeurAuClavier("ArrowDown", 5000, bornes)).toBe(4900)
    expect(valeurAuClavier("PageUp", 9500, bornes)).toBe(10000)
    expect(valeurAuClavier("PageDown", 5000, bornes)).toBe(4000)
    expect(valeurAuClavier("Home", 5000, bornes)).toBe(0)
    expect(valeurAuClavier("End", 5000, bornes)).toBe(10000)
    expect(valeurAuClavier("Enter", 5000, bornes)).toBeNull()
  })
})
