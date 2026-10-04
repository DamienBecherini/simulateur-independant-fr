// src/backend/logic/calculsAE.test.ts

import { describe, expect, it } from "vitest"
import { simulerMicroEntreprise } from "./calculsAE.js"

/*
 * Rappel des paramètres de config.json utilisés ici :
 * - plafonds de CA : 77 700 € (services), 188 700 € (vente)
 * - cotisations : vente 12,3 %, services BIC 21,2 %, services BNC 21,1 %
 * - cotisations avec ACRE : vente 6,2 %, services BIC 10,6 %, services BNC 10,6 %
 * - abattements : vente 71 %, services BIC 50 %, services BNC 34 %
 * - versement libératoire : vente 1 %, services BIC 1,7 %, services BNC 2,2 %
 */
describe("simulerMicroEntreprise", () => {
  it("renvoie un net nul quand aucune donnée n'est fournie", () => {
    expect(simulerMicroEntreprise({})).toEqual({ statut: "Micro-Entreprise", chiffreAffaires: 0, netDansLaPoche: 0 })
  })

  describe("cas nominaux (régime classique)", () => {
    it("prestations de services BIC", () => {
      // Cotisations : 50 000 x 21,2 % = 10 600
      // Revenu imposable : 50 000 x 50 % = 25 000 -> IR 1 507,66 -> 1 508
      // Net : 50 000 - 10 600 - 1 508 = 37 892
      const resultat = simulerMicroEntreprise({ ca_services_bic: 50_000 })
      expect(resultat).toEqual({ statut: "Micro-Entreprise", chiffreAffaires: 50_000, netDansLaPoche: 37_892 })
    })

    it("prestations de services BNC", () => {
      // Cotisations : 50 000 x 21,1 % = 10 550
      // Revenu imposable : 50 000 x 66 % = 33 000 -> IR 3 186,23 -> 3 186
      // Net : 50 000 - 10 550 - 3 186 = 36 264
      const resultat = simulerMicroEntreprise({ ca_services_bnc: 50_000 })
      expect(resultat.netDansLaPoche).toBe(36_264)
    })

    it("vente de marchandises", () => {
      // Cotisations : 100 000 x 12,3 % = 12 300
      // Revenu imposable : 100 000 x 29 % = 29 000 -> IR 1 986,23 -> 1 986
      // Net : 100 000 - 12 300 - 1 986 = 85 714
      const resultat = simulerMicroEntreprise({ ca_vente: 100_000 })
      expect(resultat.netDansLaPoche).toBe(85_714)
    })

    it("activité mixte : additionne les trois natures de chiffre d'affaires", () => {
      // Cotisations : 7 380 + 4 240 + 2 110 = 13 730
      // Revenu imposable : 17 400 + 10 000 + 6 600 = 34 000 -> IR 3 486,23 -> 3 486
      // Net : 90 000 - 13 730 - 3 486 = 72 784
      const resultat = simulerMicroEntreprise({ ca_vente: 60_000, ca_services_bic: 20_000, ca_services_bnc: 10_000 })
      expect(resultat.chiffreAffaires).toBe(90_000)
      expect(resultat.netDansLaPoche).toBe(72_784)
    })

    it("déduit les charges réelles du net", () => {
      const resultat = simulerMicroEntreprise({ ca_services_bic: 50_000, chargesDeductibles: 5000 })
      expect(resultat.netDansLaPoche).toBe(32_892)
    })

    it("ne compte que le surcoût d'IR quand le foyer a d'autres revenus", () => {
      // IR sur 25 000 + 30 000 = 55 000 € : 9 786 ; IR sur 30 000 € : 2 286 -> surcoût 7 500
      // Net : 50 000 - 10 600 - 7 500 = 31 900
      const resultat = simulerMicroEntreprise({ ca_services_bic: 50_000, autresRevenusImposablesFoyer: 30_000 })
      expect(resultat.netDansLaPoche).toBe(31_900)
    })

    it("tient compte du nombre de parts fiscales", () => {
      // 25 000 € imposables sur 2 parts : 12 500 par part -> 132,66 par part, soit 265 € d'IR
      // Net : 50 000 - 10 600 - 265 = 39 135
      const resultat = simulerMicroEntreprise({ ca_services_bic: 50_000, partsFiscales: 2 })
      expect(resultat.netDansLaPoche).toBe(39_135)
    })

    it.todo("applique l'abattement minimum de 305 € : le code traite 305 € comme un revenu imposable plancher (CA de 500 € -> 305 € imposables au lieu de 195 €)")
  })

  describe("plafonds de chiffre d'affaires", () => {
    it("accepte un CA de services égal au plafond", () => {
      // Cotisations : 77 700 x 21,2 % = 16 472,40
      // Revenu imposable : 38 850 -> IR 4 941,23 -> 4 941
      // Net : 77 700 - 16 472,40 - 4 941 = 56 286,60
      const resultat = simulerMicroEntreprise({ ca_services_bic: 77_700 })
      expect(resultat).toEqual({ statut: "Micro-Entreprise", chiffreAffaires: 77_700, netDansLaPoche: 56_287 })
    })

    it("signale le dépassement du plafond de services", () => {
      const resultat = simulerMicroEntreprise({ ca_services_bic: 40_000, ca_services_bnc: 37_701 })
      expect(resultat.chiffreAffaires).toBe(77_701)
      expect(resultat.netDansLaPoche).toBe(0)
      expect(resultat.warning).toMatch(/^Plafond de 77\s700 € dépassé ! Le régime micro n'est plus applicable\.$/)
    })

    it("applique le plafond de vente quand la vente est majoritaire", () => {
      const sousLePlafond = simulerMicroEntreprise({ ca_vente: 188_700 })
      expect(sousLePlafond.warning).toBeUndefined()
      // Cotisations : 23 210,10 ; revenu imposable : 54 723 -> IR 9 703,13 -> 9 703
      expect(sousLePlafond.netDansLaPoche).toBe(155_787)

      const auDessus = simulerMicroEntreprise({ ca_vente: 188_701 })
      expect(auDessus.netDansLaPoche).toBe(0)
      expect(auDessus.warning).toMatch(/^Plafond de 188\s700 € dépassé/)
    })

    it("applique le plafond de services quand la vente n'est pas strictement majoritaire", () => {
      const resultat = simulerMicroEntreprise({ ca_vente: 40_000, ca_services_bic: 40_000 })
      expect(resultat.chiffreAffaires).toBe(80_000)
      expect(resultat.netDansLaPoche).toBe(0)
      expect(resultat.warning).toMatch(/^Plafond de 77\s700 € dépassé/)
    })

    it.todo("activité mixte : plafond global de 188 700 € avec une part de services limitée à 77 700 € (le code choisit un seul plafond selon l'activité majoritaire)")
  })

  describe("ACRE", () => {
    it("réduit les cotisations sur les services BIC", () => {
      // Cotisations : 50 000 x 10,6 % = 5 300 ; IR inchangé (1 508)
      const resultat = simulerMicroEntreprise({ ca_services_bic: 50_000, beneficieACRE: true })
      expect(resultat.netDansLaPoche).toBe(43_192)
    })

    it("réduit les cotisations sur les services BNC", () => {
      // Cotisations : 50 000 x 10,6 % = 5 300 ; IR inchangé (3 186)
      const resultat = simulerMicroEntreprise({ ca_services_bnc: 50_000, beneficieACRE: true })
      expect(resultat.netDansLaPoche).toBe(41_514)
    })

    it("réduit les cotisations sur la vente", () => {
      // Cotisations : 100 000 x 6,2 % = 6 200 ; IR inchangé (1 986)
      const resultat = simulerMicroEntreprise({ ca_vente: 100_000, beneficieACRE: true })
      expect(resultat.netDansLaPoche).toBe(91_814)
    })

    it("ne dispense pas du plafond de chiffre d'affaires", () => {
      const resultat = simulerMicroEntreprise({ ca_services_bic: 80_000, beneficieACRE: true })
      expect(resultat.netDansLaPoche).toBe(0)
      expect(resultat.warning).toBeDefined()
    })
  })

  describe("versement libératoire", () => {
    it("remplace l'IR par 1,7 % du CA de services BIC", () => {
      // Net : 50 000 - 10 600 - 850 = 38 550
      const resultat = simulerMicroEntreprise({ ca_services_bic: 50_000, opteVFL: true })
      expect(resultat.netDansLaPoche).toBe(38_550)
    })

    it("remplace l'IR par 2,2 % du CA de services BNC", () => {
      // Net : 50 000 - 10 550 - 1 100 = 38 350
      const resultat = simulerMicroEntreprise({ ca_services_bnc: 50_000, opteVFL: true })
      expect(resultat.netDansLaPoche).toBe(38_350)
    })

    it("remplace l'IR par 1 % du CA de vente", () => {
      // Net : 100 000 - 12 300 - 1 000 = 86 700
      const resultat = simulerMicroEntreprise({ ca_vente: 100_000, opteVFL: true })
      expect(resultat.netDansLaPoche).toBe(86_700)
    })

    it("ne dépend ni des autres revenus du foyer ni du nombre de parts", () => {
      const resultat = simulerMicroEntreprise({ ca_services_bic: 50_000, opteVFL: true, autresRevenusImposablesFoyer: 60_000, partsFiscales: 3 })
      expect(resultat.netDansLaPoche).toBe(38_550)
    })

    it("se cumule avec l'ACRE", () => {
      // Net : 50 000 - 5 300 - 850 = 43 850
      const resultat = simulerMicroEntreprise({ ca_services_bic: 50_000, opteVFL: true, beneficieACRE: true })
      expect(resultat.netDansLaPoche).toBe(43_850)
    })

    it.todo("refuse le versement libératoire quand le RFR par part dépasse 27 478 € (plafond présent dans config.json mais jamais contrôlé)")
  })
})
