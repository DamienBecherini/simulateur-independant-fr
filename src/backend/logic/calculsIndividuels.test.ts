// src/backend/logic/calculsIndividuels.test.ts

import { describe, expect, it } from "vitest"
import { calculerMicro, plafondRfrVersementLiberatoire, type EntreesMicro } from "./calculsAE.js"
import { calculerEI } from "./calculsEI.js"
import { reglesDeTest } from "./testing/regles-de-test.js"

// Règles de test, micro-entreprise : cotisations 10 % (vente), 20 % (services BIC), 25 % (services BNC) ;
// abattements 70 %, 50 %, 30 % avec un minimum de 300 € ; plafonds 200 000 € (vente) et 80 000 € (services).
function micro(entrees: Partial<EntreesMicro>) {
  return calculerMicro({ caVente: 0, caServicesBic: 0, caServicesBnc: 0, beneficieACRE: false, opteVFL: false, ...entrees }, reglesDeTest)
}

describe("calculerMicro", () => {
  it("calcule les cotisations et le revenu imposable par nature d'activité", () => {
    const resultat = micro({ caVente: 10000, caServicesBic: 20000, caServicesBnc: 30000 })

    expect(resultat.chiffreAffaires).toBe(60000)
    expect(resultat.cotisationsSociales).toBeCloseTo(1000 + 4000 + 7500)
    expect(resultat.revenuImposable).toBeCloseTo(3000 + 10000 + 21000)
    expect(resultat.versementLiberatoire).toBe(0)
    expect(resultat.warnings).toEqual([])
  })

  it("prévient qu'avec l'ACRE, les droits à la retraite sont réduits", () => {
    const resultat = micro({ caServicesBnc: 50000, beneficieACRE: true })

    expect(resultat.warnings).toEqual([expect.stringMatching(/^ACRE : cotisations réduites de 50 %.*moins de trimestres de retraite/)])
  })

  it("réduit les cotisations avec l'ACRE, sans toucher au revenu imposable", () => {
    const resultat = micro({ caServicesBnc: 50000, beneficieACRE: true })

    expect(resultat.cotisationsSociales).toBeCloseTo(6250)
    expect(resultat.revenuImposable).toBeCloseTo(35000)
  })

  it("remplace le revenu imposable par un versement libératoire quand l'option est prise", () => {
    const resultat = micro({ caVente: 50000, opteVFL: true })

    expect(resultat.revenuImposable).toBe(0)
    expect(resultat.versementLiberatoire).toBeCloseTo(500)
    expect(resultat.warnings).toEqual([])
  })

  it("calcule le seuil de revenu fiscal de référence du versement libératoire selon le nombre de parts", () => {
    expect(plafondRfrVersementLiberatoire(1, reglesDeTest)).toBe(28000)
    expect(plafondRfrVersementLiberatoire(2.5, reglesDeTest)).toBe(70000)
    expect(plafondRfrVersementLiberatoire(1)).toBeGreaterThan(0)
  })

  describe("abattement minimum", () => {
    it("applique le minimum quand l'abattement proportionnel est plus faible", () => {
      // 50 % de 500 € = 250 €, porté à 300 € : 200 € imposables.
      expect(micro({ caServicesBic: 500 }).revenuImposable).toBeCloseTo(200)
    })

    it("compte un minimum par nature d'activité exercée", () => {
      // 280 € + 120 € d'abattement, porté à 2 x 300 € : 200 € imposables.
      expect(micro({ caVente: 400, caServicesBnc: 400 }).revenuImposable).toBeCloseTo(200)
    })

    it("ne rend jamais le revenu imposable négatif", () => {
      expect(micro({ caVente: 200 }).revenuImposable).toBe(0)
    })

    it("ne s'applique pas sans chiffre d'affaires", () => {
      expect(micro({}).revenuImposable).toBe(0)
    })
  })

  describe("plafonds de chiffre d'affaires", () => {
    it("accepte une activité mixte sous les deux plafonds", () => {
      expect(micro({ caVente: 100000, caServicesBic: 70000 }).warnings).toEqual([])
      expect(micro({ caVente: 40000, caServicesBnc: 40000 }).warnings).toEqual([])
    })

    it("signale des prestations de services au-dessus de leur plafond", () => {
      const resultat = micro({ caServicesBic: 50000, caServicesBnc: 40000 })

      expect(resultat.warnings).toHaveLength(1)
      expect(resultat.warnings[0]).toContain("prestations de services")
      expect(resultat.warnings[0]).not.toContain("chiffre d'affaires total")
    })

    it("signale un chiffre d'affaires total au-dessus du plafond de la vente", () => {
      const resultat = micro({ caVente: 150000, caServicesBic: 60000 })

      expect(resultat.warnings).toHaveLength(1)
      expect(resultat.warnings[0]).toContain("chiffre d'affaires total")
    })

    it("continue de calculer cotisations et revenu imposable au-dessus du plafond", () => {
      const resultat = micro({ caServicesBnc: 100000 })

      expect(resultat.cotisationsSociales).toBeCloseTo(25000)
      expect(resultat.revenuImposable).toBeCloseTo(70000)
    })
  })

  it("utilise par défaut les règles en vigueur", () => {
    const resultat = calculerMicro({ caVente: 0, caServicesBic: 0, caServicesBnc: 10000, beneficieACRE: false, opteVFL: false })

    expect(resultat.cotisationsSociales).toBeGreaterThan(0)
  })
})

describe("calculerEI", () => {
  // Règles de test : voir cotisationsTNS.test.ts. Un bénéfice de 40 000 € avant cotisations donne une assiette de 30 000 €
  // et 12 700 € de cotisations, dont 900 € de CSG non déductible et de CRDS ; sans revenu, 1 500 € de cotisations minimales.
  it("déduit les cotisations du bénéfice, et réintègre leur part non déductible dans le revenu imposable", () => {
    const resultat = calculerEI({ chiffreAffaires: 60000, chargesDeductibles: 20000 }, reglesDeTest)

    expect(resultat.cotisationsSociales).toBe(12700)
    expect(resultat.cotisationsTNS.assiette).toBe(30000)
    expect(resultat.revenuNet).toBe(27300)
    expect(resultat.revenuImposable).toBe(28200)
    expect(resultat.warnings).toEqual([])
  })

  it("applique les cotisations minimales en cas de déficit, qui s'en trouve creusé", () => {
    const resultat = calculerEI({ chiffreAffaires: 5000, chargesDeductibles: 8000 }, reglesDeTest)

    expect(resultat.cotisationsSociales).toBe(1500)
    expect(resultat.revenuNet).toBe(-4500)
    expect(resultat.revenuImposable).toBe(-4500)
    expect(resultat.warnings).toHaveLength(2)
    expect(resultat.warnings[0]).toContain("Cotisations minimales")
    expect(resultat.warnings[1]).toMatch(/déficitaire de 4\s500 €/)
  })

  it("doit les cotisations minimales même sans activité", () => {
    const resultat = calculerEI({ chiffreAffaires: 0, chargesDeductibles: 0 }, reglesDeTest)

    expect(resultat.cotisationsSociales).toBe(1500)
    expect(resultat.revenuNet).toBe(-1500)
  })

  it("applique les assiettes minimales quand le bénéfice est faible", () => {
    // 2 000 € de bénéfice : assiette 1 200 €, 1 716 € de cotisations dont 36 € non déductibles.
    const resultat = calculerEI({ chiffreAffaires: 2000, chargesDeductibles: 0 }, reglesDeTest)

    expect(resultat.cotisationsSociales).toBeCloseTo(1716)
    expect(resultat.revenuNet).toBeCloseTo(284)
    expect(resultat.revenuImposable).toBeCloseTo(320)
    expect(resultat.warnings).toEqual([expect.stringContaining("Cotisations minimales des indépendants appliquées")])
  })

  it("utilise par défaut les règles en vigueur", () => {
    expect(calculerEI({ chiffreAffaires: 10000, chargesDeductibles: 0 }).revenuNet).toBeLessThan(10000)
  })
})
