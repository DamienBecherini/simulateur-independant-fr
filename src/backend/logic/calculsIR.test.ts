// src/backend/logic/calculsIR.test.ts

import { describe, expect, it } from "vitest"
import { calculerIR, impotPourUnePart } from "./calculsIR.js"
import { reglesDeTest } from "./testing/regles-de-test.js"

// Barème de test : 0 % jusqu'à 10 000 €, 10 % jusqu'à 30 000 €, 30 % jusqu'à 80 000 €, 40 % au-delà.
const regles = reglesDeTest.IR
const seul = (revenu: number, parts = 1) => calculerIR({ revenuNetGlobalImposable: revenu, partsFiscales: parts, nombreDeclarants: 1 }, regles)
const couple = (revenu: number, parts = 2) => calculerIR({ revenuNetGlobalImposable: revenu, partsFiscales: parts, nombreDeclarants: 2 }, regles)

describe("impotPourUnePart", () => {
  it("taxe chaque tranche à son taux", () => {
    expect(impotPourUnePart(10000, regles.bareme)).toBe(0)
    expect(impotPourUnePart(30000, regles.bareme)).toBe(2000)
    expect(impotPourUnePart(80000, regles.bareme)).toBe(17000)
    expect(impotPourUnePart(100000, regles.bareme)).toBe(25000)
  })

  it("est continu au passage d'une tranche", () => {
    for (const seuil of [10000, 30000, 80000]) {
      const ecart = impotPourUnePart(seuil + 1, regles.bareme) - impotPourUnePart(seuil, regles.bareme)
      expect(ecart).toBeGreaterThan(0)
      expect(ecart).toBeLessThan(1)
    }
  })
})

describe("calculerIR", () => {
  it("ne demande aucun impôt pour un revenu nul, négatif ou des parts invalides", () => {
    expect(seul(0)).toBe(0)
    expect(seul(-5000)).toBe(0)
    expect(seul(50000, 0)).toBe(0)
    expect(seul(50000, Number.NaN)).toBe(0)
  })

  it("ne demande aucun impôt dans la tranche à 0 %", () => {
    expect(seul(10000)).toBe(0)
  })

  it("applique le barème quand la décote ne joue plus", () => {
    expect(seul(40000)).toBe(5000)
    expect(seul(100000)).toBe(25000)
  })

  it("divise le revenu par le nombre de parts avant d'appliquer le barème", () => {
    // 80 000 € pour 2 parts : 2 x l'impôt de 40 000 €.
    expect(couple(80000)).toBe(10000)
  })

  describe("décote", () => {
    it("réduit l'impôt d'une personne seule tant que le forfait dépasse la moitié de l'impôt", () => {
      // Impôt brut 1 000 € ; décote = 800 - 50 % x 1 000 = 300.
      expect(seul(20000)).toBe(700)
    })

    it("utilise un forfait plus élevé pour un couple", () => {
      // Impôt brut 2 000 € ; décote = 1 400 - 50 % x 2 000 = 400.
      expect(couple(40000)).toBe(1600)
    })

    it("ne rend jamais l'impôt négatif", () => {
      // Impôt brut 100 € ; décote théorique 750 €.
      expect(seul(11000)).toBe(0)
    })
  })

  describe("plafonnement du quotient familial", () => {
    it("limite l'avantage des parts supplémentaires à un plafond par demi-part", () => {
      // 3 parts : 24 000 €. Sans les enfants (2 parts) : 31 000 €. Avantage plafonné à 2 x 1 500 € : 28 000 €.
      expect(couple(150000, 3)).toBe(28000)
    })

    it("ne change rien quand l'avantage reste sous le plafond", () => {
      // 3 parts : 3 000 €. Sans les enfants : 4 000 €, soit un avantage de 1 000 € seulement.
      expect(couple(60000, 3)).toBe(3000)
    })

    it("s'applique aussi à un parent seul", () => {
      // 1,5 part : 2 550 €. Sans l'enfant : 5 150 €. Avantage plafonné à 1 500 € : 3 650 €.
      expect(seul(40500, 1.5)).toBe(3650)
    })
  })

  it("utilise par défaut les règles en vigueur", () => {
    const impot = calculerIR({ revenuNetGlobalImposable: 60000, partsFiscales: 1, nombreDeclarants: 1 })

    expect(impot).toBeGreaterThan(0)
    expect(impot).toBeLessThan(60000)
  })
})
