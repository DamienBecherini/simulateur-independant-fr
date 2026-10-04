// src/backend/logic/calculsSociete.test.ts

import { describe, expect, it } from "vitest"
import { calculerEURL } from "./calculsEURL.js"
import { calculerSASU } from "./calculsSASU.js"
import { calculerIS } from "./calculsSociete.js"
import { reglesDeTest } from "./testing/regles-de-test.js"

// Règles de test : IS à 15 % jusqu'à 40 000 € puis 25 % ; président de SASU à 80 % de cotisations
// sur le net ; gérant d'EURL à 50 %.
const activite = { chiffreAffaires: 100000, chargesDeductibles: 10000, remunerationNette: 30000, dividendesDemandes: 0 }

describe("calculerIS", () => {
  it("applique le taux réduit jusqu'au plafond puis le taux normal", () => {
    expect(calculerIS(30000, reglesDeTest.IS)).toBe(4500)
    expect(calculerIS(40000, reglesDeTest.IS)).toBe(6000)
    expect(calculerIS(50000, reglesDeTest.IS)).toBe(8500)
  })

  it("est nul sans bénéfice", () => {
    expect(calculerIS(0, reglesDeTest.IS)).toBe(0)
    expect(calculerIS(-1000, reglesDeTest.IS)).toBe(0)
  })
})

describe("calculerSASU", () => {
  it("déduit la rémunération et ses cotisations avant l'IS, et conserve le bénéfice non distribué", () => {
    const resultat = calculerSASU(activite, reglesDeTest)

    expect(resultat.cotisationsSociales).toBeCloseTo(24000)
    expect(resultat.beneficeAvantIS).toBeCloseTo(36000)
    expect(resultat.impotSocietes).toBeCloseTo(5400)
    expect(resultat.dividendesVerses).toBe(0)
    expect(resultat.resultatConserve).toBeCloseTo(30600)
    expect(resultat.warnings).toEqual([])
  })

  it("ne distribue que les dividendes saisis", () => {
    const resultat = calculerSASU({ ...activite, dividendesDemandes: 20000 }, reglesDeTest)

    expect(resultat.dividendesVerses).toBe(20000)
    expect(resultat.resultatConserve).toBeCloseTo(10600)
  })

  it("soumet tous les dividendes aux prélèvements sociaux, sans cotisations", () => {
    const resultat = calculerSASU({ ...activite, dividendesDemandes: 20000 }, reglesDeTest)

    expect(resultat.dividendesSoumisPS).toBe(20000)
    expect(resultat.cotisationsSurDividendes).toBe(0)
  })

  it("plafonne les dividendes au bénéfice distribuable et le signale", () => {
    const resultat = calculerSASU({ ...activite, dividendesDemandes: 50000 }, reglesDeTest)

    expect(resultat.dividendesVerses).toBeCloseTo(30600)
    expect(resultat.resultatConserve).toBeCloseTo(0)
    expect(resultat.warnings).toHaveLength(1)
    expect(resultat.warnings[0]).toContain("supérieurs au bénéfice distribuable")
  })

  it("signale une société déficitaire, sans IS ni dividendes", () => {
    const resultat = calculerSASU({ chiffreAffaires: 20000, chargesDeductibles: 0, remunerationNette: 30000, dividendesDemandes: 1000 }, reglesDeTest)

    expect(resultat.beneficeAvantIS).toBeCloseTo(-34000)
    expect(resultat.impotSocietes).toBe(0)
    expect(resultat.dividendesVerses).toBe(0)
    expect(resultat.resultatConserve).toBeCloseTo(-34000)
    expect(resultat.warnings[0]).toContain("déficitaire")
    expect(resultat.warnings).toHaveLength(2)
  })

  it("utilise par défaut les règles en vigueur", () => {
    expect(calculerSASU(activite).chiffreAffaires).toBe(100000)
  })
})

describe("calculerEURL", () => {
  it("applique les cotisations de travailleur non salarié sur la rémunération", () => {
    const resultat = calculerEURL({ ...activite, capitalSocial: 10000 }, reglesDeTest)

    expect(resultat.cotisationsSociales).toBeCloseTo(15000)
    expect(resultat.beneficeAvantIS).toBeCloseTo(45000)
    expect(resultat.impotSocietes).toBeCloseTo(7250)
    expect(resultat.resultatConserve).toBeCloseTo(37750)
  })

  it("soumet aux cotisations la part des dividendes qui dépasse 10 % du capital", () => {
    const resultat = calculerEURL({ ...activite, dividendesDemandes: 20000, capitalSocial: 10000 }, reglesDeTest)

    expect(resultat.dividendesVerses).toBe(20000)
    expect(resultat.dividendesSoumisPS).toBe(1000)
    expect(resultat.cotisationsSurDividendes).toBeCloseTo(9500)
    expect(resultat.cotisationsSociales).toBeCloseTo(24500)
    expect(resultat.resultatConserve).toBeCloseTo(17750)
  })

  it("laisse tous les dividendes aux prélèvements sociaux quand le capital est suffisant", () => {
    const resultat = calculerEURL({ ...activite, dividendesDemandes: 20000, capitalSocial: 200000 }, reglesDeTest)

    expect(resultat.dividendesSoumisPS).toBe(20000)
    expect(resultat.cotisationsSurDividendes).toBe(0)
  })

  it("fait payer à la société les cotisations minimales du gérant non rémunéré", () => {
    // Règles de test : minimum de 1 000 €. Bénéfice 89 000 € ; IS 6 000 + 49 000 x 25 % = 18 250 €.
    const resultat = calculerEURL({ chiffreAffaires: 100000, chargesDeductibles: 10000, remunerationNette: 0, dividendesDemandes: 0, capitalSocial: 10000 }, reglesDeTest)

    expect(resultat.cotisationsSociales).toBe(1000)
    expect(resultat.impotSocietes).toBeCloseTo(18250)
    expect(resultat.resultatConserve).toBeCloseTo(70750)
    expect(resultat.warnings).toEqual([expect.stringContaining("Cotisations minimales du gérant")])
  })

  it("n'ajoute rien quand les cotisations dépassent déjà le minimum", () => {
    expect(calculerEURL({ ...activite, capitalSocial: 10000 }, reglesDeTest).warnings).toEqual([])
  })

  it("soumet tous les dividendes aux cotisations quand le capital est nul", () => {
    const resultat = calculerEURL({ ...activite, dividendesDemandes: 20000, capitalSocial: 0 }, reglesDeTest)

    expect(resultat.dividendesSoumisPS).toBe(0)
    expect(resultat.cotisationsSurDividendes).toBeCloseTo(10000)
  })

  it("utilise par défaut les règles en vigueur", () => {
    expect(calculerEURL({ ...activite, capitalSocial: 1000 }).chiffreAffaires).toBe(100000)
  })
})
