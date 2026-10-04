// src/backend/logic/calculsSociete.test.ts

import { describe, expect, it } from "vitest"
import { calculerEURL } from "./calculsEURL.js"
import { calculerSASU } from "./calculsSASU.js"
import { calculerIS } from "./calculsSociete.js"
import { reglesDeTest } from "./testing/regles-de-test.js"

// Règles de test : IS à 15 % jusqu'à 40 000 € puis 25 % ; président de SASU : net = 81 % du brut sous le plafond de
// 40 000 €, cotisations patronales de 34 % (voir cotisationsSalarie.test.ts) ;
// gérant d'EURL : cotisations de travailleur non salarié des règles de test (voir cotisationsTNS.test.ts).
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
  // Rémunération nette de 24 300 € : 30 000 € bruts (24 300 / 81 %), 10 200 € de cotisations patronales (34 %) ;
  // cotisations sociales 30 000 - 24 300 + 10 200 = 15 900 €. Bénéfice : 100 000 - 10 000 - 24 300 - 15 900 = 49 800 € ;
  // IS 6 000 + 9 800 x 25 % = 8 450 € ; conservé 41 350 €.
  const sasu = { ...activite, remunerationNette: 24300 }

  it("déduit la rémunération et ses cotisations avant l'IS, et conserve le bénéfice non distribué", () => {
    const resultat = calculerSASU(sasu, reglesDeTest)

    expect(resultat.cotisationsPresident?.brut).toBeCloseTo(30000)
    expect(resultat.cotisationsSociales).toBeCloseTo(15900)
    expect(resultat.beneficeAvantIS).toBeCloseTo(49800)
    expect(resultat.impotSocietes).toBeCloseTo(8450)
    expect(resultat.dividendesVerses).toBe(0)
    expect(resultat.resultatConserve).toBeCloseTo(41350)
    expect(resultat.warnings).toEqual([])
  })

  it("impose la rémunération nette augmentée de la CSG non déductible et de la CRDS", () => {
    // 3 % de 90 % du brut : 810 €.
    expect(calculerSASU(sasu, reglesDeTest).remunerationImposable).toBeCloseTo(25110)
  })

  it("sans rémunération, ni cotisations ni bulletin de paie à remplir", () => {
    const resultat = calculerSASU({ ...sasu, remunerationNette: 0 }, reglesDeTest)

    expect(resultat.cotisationsSociales).toBe(0)
    expect(resultat.cotisationsPresident).toMatchObject({ brut: 0, coutEmployeur: 0 })
    expect(resultat.beneficeAvantIS).toBe(90000)
  })

  it("ne distribue que les dividendes saisis", () => {
    const resultat = calculerSASU({ ...sasu, dividendesDemandes: 20000 }, reglesDeTest)

    expect(resultat.dividendesVerses).toBe(20000)
    expect(resultat.resultatConserve).toBeCloseTo(21350)
  })

  it("soumet tous les dividendes aux prélèvements sociaux, sans cotisations", () => {
    const resultat = calculerSASU({ ...sasu, dividendesDemandes: 20000 }, reglesDeTest)

    expect(resultat.dividendesSoumisPS).toBe(20000)
    expect(resultat.cotisationsSurDividendes).toBe(0)
  })

  it("plafonne les dividendes au bénéfice distribuable et le signale", () => {
    const resultat = calculerSASU({ ...sasu, dividendesDemandes: 50000 }, reglesDeTest)

    expect(resultat.dividendesVerses).toBeCloseTo(41350)
    expect(resultat.resultatConserve).toBeCloseTo(0)
    expect(resultat.warnings).toHaveLength(1)
    expect(resultat.warnings[0]).toContain("supérieurs au bénéfice distribuable")
  })

  it("ne signale pas des dividendes égaux au bénéfice distribuable, aux arrondis près", () => {
    expect(calculerSASU({ ...sasu, dividendesDemandes: 41350.4 }, reglesDeTest).warnings).toEqual([])
  })

  it("signale une société déficitaire, sans IS ni dividendes", () => {
    // 20 000 - 24 300 - 15 900 = - 20 200 €.
    const resultat = calculerSASU({ chiffreAffaires: 20000, chargesDeductibles: 0, remunerationNette: 24300, dividendesDemandes: 1000 }, reglesDeTest)

    expect(resultat.beneficeAvantIS).toBeCloseTo(-20200)
    expect(resultat.impotSocietes).toBe(0)
    expect(resultat.dividendesVerses).toBe(0)
    expect(resultat.resultatConserve).toBeCloseTo(-20200)
    expect(resultat.warnings[0]).toContain("déficitaire")
    expect(resultat.warnings).toHaveLength(2)
  })

  it("utilise par défaut les règles en vigueur", () => {
    expect(calculerSASU(activite).chiffreAffaires).toBe(100000)
  })
})


describe("calculerEURL", () => {
  // Rémunération nette de 27 300 € : 40 000 € de revenu avant cotisations, assiette 30 000 €, 12 700 € de cotisations
  // à la charge de la société, dont 900 € de CSG non déductible et de CRDS.
  const eurl = { chiffreAffaires: 100000, chargesDeductibles: 10000, remunerationNette: 27300, dividendesDemandes: 0, capitalSocial: 10000 }

  it("fait payer à la société les cotisations du gérant sur sa rémunération", () => {
    // Bénéfice : 100 000 - 10 000 - 27 300 - 12 700 = 50 000 € ; IS 6 000 + 10 000 x 25 % = 8 500 €.
    const resultat = calculerEURL(eurl, reglesDeTest)

    expect(resultat.cotisationsSociales).toBeCloseTo(12700)
    expect(resultat.cotisationsTNS?.revenuAvantCotisations).toBeCloseTo(40000)
    expect(resultat.beneficeAvantIS).toBeCloseTo(50000)
    expect(resultat.impotSocietes).toBeCloseTo(8500)
    expect(resultat.resultatConserve).toBeCloseTo(41500)
    expect(resultat.warnings).toEqual([])
  })

  it("impose la rémunération nette augmentée de la CSG non déductible et de la CRDS", () => {
    expect(calculerEURL(eurl, reglesDeTest).remunerationImposable).toBeCloseTo(28200)
  })

  it("ajoute au revenu soumis à cotisations la part des dividendes qui dépasse 10 % du capital", () => {
    // 41 000 € de dividendes, seuil 1 000 € : 40 000 € s'ajoutent aux 40 000 € de revenu, soit une assiette de 60 000 €
    // et 26 500 € de cotisations au total ; le gérant paie la différence, 13 800 €, sur ses dividendes.
    const resultat = calculerEURL({ ...eurl, dividendesDemandes: 41000 }, reglesDeTest)

    expect(resultat.dividendesVerses).toBe(41000)
    expect(resultat.dividendesSoumisPS).toBe(1000)
    expect(resultat.cotisationsTNS?.assiette).toBeCloseTo(60000)
    expect(resultat.cotisationsSurDividendes).toBeCloseTo(13800)
    expect(resultat.cotisationsSociales).toBeCloseTo(26500)
    expect(resultat.resultatConserve).toBeCloseTo(500)
    expect(resultat.remunerationImposable).toBeCloseTo(28200)
  })

  it("laisse tous les dividendes aux prélèvements sociaux quand le capital est suffisant", () => {
    const resultat = calculerEURL({ ...eurl, dividendesDemandes: 20000, capitalSocial: 200000 }, reglesDeTest)

    expect(resultat.dividendesSoumisPS).toBe(20000)
    expect(resultat.cotisationsSurDividendes).toBe(0)
  })

  it("soumet tous les dividendes aux cotisations quand le capital est nul", () => {
    // 60 000 € de revenu, assiette 45 000 € : 19 675 € de cotisations, dont 6 975 € dues sur les dividendes.
    const resultat = calculerEURL({ ...eurl, dividendesDemandes: 20000, capitalSocial: 0 }, reglesDeTest)

    expect(resultat.dividendesSoumisPS).toBe(0)
    expect(resultat.cotisationsSurDividendes).toBeCloseTo(6975)
  })

  it("fait payer à la société les cotisations minimales du gérant non rémunéré, qui comptent dans son revenu", () => {
    // Revenu R : assiette R - 800 € ; cotisations 1 500 + 18 % x (R - 800) = R, soit R = 1 356 / 0,82 = 1 653,66 €.
    // Bénéfice 90 000 - 1 653,66 = 88 346,34 € ; IS 6 000 + 48 346,34 x 25 % = 18 086,59 €.
    const resultat = calculerEURL({ ...eurl, remunerationNette: 0 }, reglesDeTest)

    expect(resultat.cotisationsSociales).toBeCloseTo(1653.66)
    expect(resultat.impotSocietes).toBeCloseTo(18086.59)
    expect(resultat.warnings).toEqual([expect.stringContaining("Cotisations minimales du gérant")])
  })

  it("utilise par défaut les règles en vigueur", () => {
    expect(calculerEURL({ ...activite, capitalSocial: 1000 }).chiffreAffaires).toBe(100000)
  })
})
