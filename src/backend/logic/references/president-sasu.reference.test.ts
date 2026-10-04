// src/backend/logic/references/president-sasu.reference.test.ts

import { describe, expect, it } from "vitest"
import { evaluerProtectionSociale } from "../protection-sociale.js"
import { reglesEnVigueur } from "../regles.js"
import { activite, casDeReference, foyerDe, simuler, verifierIdentiteDuBilan } from "../testing/cas-de-reference.js"
import { personne, relation, societe } from "../testing/session-de-test.js"

/*
 * Cas de référence 2026 : bulletin de paie annuel du président de SASU, assimilé salarié, sans contrat de travail.
 *
 * Démarche : le moteur tourne avec les règles réelles de config.json, et chaque attendu est dérivé à la main à partir des
 * taux officiels 2026 (urssaf.fr, taux-cotisations-secteur-prive ; agirc-arrco.fr ; modèle de l'Urssaf pour le dirigeant
 * assimilé salarié), sans lancer le moteur. PASS : 48 060 €.
 *
 * Cotisations salariales : vieillesse plafonnée 6,90 % (jusqu'au PASS) et déplafonnée 0,40 % ; Agirc-Arrco 3,15 % (T1) et
 * 8,64 % (T2, de 1 à 8 PASS) ; CEG 0,86 % (T1) et 1,08 % (T2) ; CET 0,14 % sur tout le brut s'il dépasse le PASS ;
 * CSG déductible 6,8 %, CSG non déductible 2,4 % et CRDS 0,5 % sur 98,25 % du brut.
 * Cotisations patronales : maladie 13 % ; vieillesse 8,55 % (plafonnée) et 2,11 % ; allocations familiales 5,25 % ;
 * accidents du travail 0,64 % (taux retenu) ; CSA 0,30 % ; FNAL 0,10 % (plafonné) ; Agirc-Arrco 4,72 % (T1) et 12,95 % (T2) ;
 * CEG 1,29 % et 1,62 % ; CET 0,21 % ; formation professionnelle 0,55 % ; taxe d'apprentissage 0,68 %.
 * Ni assurance chômage, ni AGS, ni réduction générale : le président n'a pas de contrat de travail.
 *
 * Sous le PASS : cotisations salariales 11,31 % + 9,7 % x 98,25 % = 20,84025 % du brut, net = 79,15975 % du brut ;
 * patronales 37,19 % du brut. Au-delà : salariales 0,1091 x PASS + 0,0972 x (B - PASS) + 0,1007025 x B, soit
 * net = 0,8020975 x B - 571,91 € ; patronales 0,3731 x B + 0,0009 x PASS (43,25 €).
 */

const alice = personne("alice")
const simulerPresident = (chiffreAffaires: number, remunerationNette: number) =>
  simuler(
    [alice, societe("s1", "SASU")],
    [relation("alice", "s1", "Président")],
    [
      ["s1", "ca_services", chiffreAffaires],
      ["s1", "director_remuneration", remunerationNette]
    ]
  )

casDeReference("Cas de référence 2026 : président de SASU", () => {
  describe("5 800 € nets, juste au-delà du seuil de 4 trimestres", () => {
    // Brut : 5 800 / 0,7915975 = 7 326,96 €, au-delà des 4 x 1 803 = 7 212 € qui valident 4 trimestres (5 708,94 € nets).
    // Salariales : vieillesse 7 326,96 x 7,30 % = 534,87 € ; Agirc-Arrco 230,80 € ; CEG 63,01 € ; CSG déductible 7 326,96 x 98,25 %
    // x 6,8 % = 489,51 € ; CSG non déductible et CRDS x 2,9 % = 208,76 € ; total 1 526,96 €.
    // Patronales : 37,19 % = 2 724,89 €, dont maladie 952,50 €. Coût pour la société : 7 326,96 + 2 724,89 = 10 051,85 €.
    // Société : bénéfice 30 000 - 5 800 - 4 251,85 = 19 948,15 € ; IS 15 % = 2 992,22 € ; conservé 16 955,93 €.
    // Imposable : 5 800 + 208,76 = 6 008,76 €, moins 10 % (600,88 €) : 5 407,89 €, sous la première tranche : pas d'impôt.
    const report = simulerPresident(30000, 5800)

    it("bulletin de paie", () => {
      const bulletin = activite(report, "s1").cotisationsPresident
      expect(bulletin?.brut).toBeCloseTo(7326.96, 2)
      expect(bulletin?.totalSalarial).toBeCloseTo(1526.96, 2)
      expect(bulletin?.cotisations.csgDeductible.salariale).toBeCloseTo(489.51, 2)
      expect(bulletin?.cotisations.maladie).toEqual({ salariale: 0, patronale: expect.closeTo(952.5, 2) })
      expect(bulletin?.cotisations.assuranceChomage).toEqual({ salariale: 0, patronale: 0 })
      expect(bulletin?.totalPatronal).toBeCloseTo(2724.89, 2)
      expect(bulletin).toMatchObject({ reductionGenerale: 0, coutEmployeur: expect.closeTo(10051.85, 2), partNonDeductible: expect.closeTo(208.76, 2) })
    })

    it("société, impôt et trimestres", () => {
      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 4252, impotSocietes: 2992, resultatConserve: 16956, revenuVerse: 5800 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 5408, impotSurLeRevenu: 0, netApresImpots: 5800 })
      expect(evaluerProtectionSociale("SASU", { remunerationBrute: 7326.96, assietteTNS: 0, chiffreAffairesMicro: { caVente: 0, caServicesBic: 0, caServicesBnc: 0 } }, reglesEnVigueur).trimestres).toBe(4)
      verifierIdentiteDuBilan(report)
    })
  })

  it("30 000 € nets, sous le PASS", () => {
    // Brut : 30 000 / 0,7915975 = 37 898,05 € ; salariales 7 898,05 € ; patronales 37,19 % = 14 094,28 € ;
    // coût 51 992,33 €, soit 1,733 fois le net (l'ancien ratio en retenait 1,8). CSG non déductible et CRDS : 1 079,81 €.
    const bulletin = activite(simulerPresident(80000, 30000), "s1").cotisationsPresident

    expect(bulletin?.brut).toBeCloseTo(37898.05, 2)
    expect(bulletin?.cotisations.contributionEquilibreTechnique).toEqual({ salariale: 0, patronale: 0 })
    expect(bulletin).toMatchObject({ totalSalarial: expect.closeTo(7898.05, 2), totalPatronal: expect.closeTo(14094.28, 2), coutEmployeur: expect.closeTo(51992.33, 2), partNonDeductible: expect.closeTo(1079.81, 2) })
  })

  describe("60 000 € nets, au-delà du PASS", () => {
    // Brut : (60 000 + 571,91) / 0,8020975 = 75 516,90 € ; tranche 2 : 75 516,90 - 48 060 = 27 456,90 €.
    // Salariales : vieillesse 48 060 x 6,90 % + 75 516,90 x 0,40 % = 3 316,14 + 302,07 = 3 618,21 € ;
    // Agirc-Arrco 48 060 x 3,15 % + 27 456,90 x 8,64 % = 1 513,89 + 2 372,28 = 3 886,17 € ; CEG 413,32 + 296,53 = 709,85 € ;
    // CET 75 516,90 x 0,14 % = 105,72 € ; CSG déductible 75 516,90 x 98,25 % x 6,8 % = 5 045,28 € ; non déductible et CRDS
    // x 2,9 % = 2 151,665 € ; total 15 516,90 €.
    // Patronales : 0,3731 x 75 516,90 + 43,25 = 28 218,61 €, dont maladie 9 817,20 €, Agirc-Arrco 2 268,43 + 3 555,67 = 5 824,10 €,
    // CET 158,59 €. Coût : 103 735,50 €.
    // Société : cotisations 103 735,50 - 60 000 = 43 735,50 € ; bénéfice 150 000 - 60 000 - 43 735,50 = 46 264,50 € ;
    // IS 6 375 + 3 764,50 x 25 % = 7 316,12 € ; conservé 38 948,37 €.
    // Imposable : 60 000 + 2 151,665 = 62 151,665 €, moins 10 % (6 215,17 €) : 55 936,499 €, affiché 55 936 € ;
    // impôt 1 977,69 + 26 357,50 x 30 % = 9 884,94 €, soit 9 885 €. Net : 60 000 - 9 885 = 50 115 €.
    const report = simulerPresident(150000, 60000)

    it("bulletin de paie", () => {
      const bulletin = activite(report, "s1").cotisationsPresident
      expect(bulletin?.brut).toBeCloseTo(75516.9, 2)
      expect(bulletin?.cotisations.vieillessePlafonnee.salariale).toBeCloseTo(3316.14, 2)
      expect(bulletin?.cotisations.retraiteComplementaire.salariale).toBeCloseTo(3886.17, 2)
      expect(bulletin?.cotisations.retraiteComplementaire.patronale).toBeCloseTo(5824.1, 2)
      expect(bulletin?.cotisations.contributionEquilibreTechnique.salariale).toBeCloseTo(105.72, 2)
      expect(bulletin?.cotisations.contributionEquilibreTechnique.patronale).toBeCloseTo(158.59, 2)
      expect(bulletin).toMatchObject({ totalSalarial: expect.closeTo(15516.9, 2), totalPatronal: expect.closeTo(28218.61, 2), coutEmployeur: expect.closeTo(103735.5, 2) })
    })

    it("société et impôt", () => {
      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 43736, impotSocietes: 7316, resultatConserve: 38948 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 55936, impotSurLeRevenu: 9885, netApresImpots: 50115 })
      verifierIdentiteDuBilan(report)
    })
  })
})
