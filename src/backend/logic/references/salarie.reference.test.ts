// src/backend/logic/references/salarie.reference.test.ts

import { describe, expect, it } from "vitest"
import { runMetaSimulation } from "../simulation-engine.js"
import { activite, casDeReference, foyerDe, verifierIdentiteDuBilan } from "../testing/cas-de-reference.js"
import { personne, relation, session, societe } from "../testing/session-de-test.js"

/*
 * Cas de référence 2026 : salarié non cadre d'une SASU de la simulation (relation « Salarié »), avec la réduction
 * générale dégressive unique (RGDU) des cotisations patronales.
 *
 * Démarche : le moteur tourne avec les règles réelles de config.json, et chaque attendu est dérivé à la main à partir des
 * taux officiels 2026, sans lancer le moteur. PASS : 48 060 €. SMIC annuel de la RGDU : 12,02 € x 1 820 h = 21 876,40 €.
 *
 * Cotisations salariales : celles du président de SASU (voir president-sasu.reference.test.ts) : 20,84025 % du brut sous le PASS.
 * Cotisations patronales : celles du président (37,19 % sous le PASS), plus l'assurance chômage 4,00 % et l'AGS 0,25 % (dans
 * la limite de 4 PASS) et la contribution au dialogue social 0,016 %, soit 41,456 % sous le PASS.
 * RGDU (article D241-7 du code de la sécurité sociale, urssaf.fr) : C = 0,02 + 0,3781 x (1/2 x (3 x 21 876,40 / brut - 1))^1,75,
 * arrondi à 4 décimales, au plus 0,3981, appliqué au brut annuel s'il est inférieur à 3 SMIC (65 629,20 €).
 */

/** Bob, salarié d'une SASU présidée par Alice (sans rémunération), qui facture 100 000 €. */
function simulerSalarie(net: number, brut?: number) {
  const donnees = session([personne("alice"), personne("bob"), societe("s1", "SASU")], [relation("alice", "s1", "Président"), relation("bob", "s1", "Salarié")], [["s1", "ca_services", 100000]])
  donnees.monthlyData[0].flows.push({ id: "paie", label: "Salaire", amount: net, ...(brut === undefined ? {} : { grossAmount: brut }), entityId: "bob", type: "salary" })
  return runMetaSimulation(donnees)
}

casDeReference("Cas de référence 2026 : salarié et réduction générale", () => {
  describe("au SMIC : 21 876,40 € bruts saisis", () => {
    // Salariales : vieillesse 7,30 % = 1 596,98 € ; Agirc-Arrco 3,15 % = 689,11 € ; CEG 0,86 % = 188,14 € ; CSG déductible
    // 21 876,40 x 98,25 % x 6,8 % = 1 461,56 € ; CSG non déductible et CRDS x 2,9 % = 623,31 € ; total 4 559,10 €, net 17 317,30 €.
    // Patronales : 41,456 % = 9 069,08 €, dont maladie 2 843,93 €, assurance chômage 875,06 € et AGS 54,69 €.
    // RGDU : (1/2 x (3 - 1))^1,75 = 1, C = 0,3981 (maximum) ; réduction 21 876,40 x 0,3981 = 8 708,99 €.
    // Coût employeur : 21 876,40 + 9 069,08 - 8 708,99 = 22 236,49 € ; cotisations patronales restantes 360,09 €.
    // Société : bénéfice 100 000 - 22 236,49 = 77 763,51 € ; IS 6 375 + 35 263,51 x 25 % = 15 190,88 € ; conservé 62 572,63 €.
    // Bob : imposable 17 317,30 + 623,31 = 17 940,61 €, 16 146,55 € après 10 % ; impôt brut 500,12 €, effacé par la décote.
    // Son foyer : revenus avant prélèvements 17 317,30 + 4 559,10 + 360,09 = 22 236,49 €, le coût employeur.
    const report = simulerSalarie(17317.3, 21876.4)

    it("bulletin de paie et réduction générale", () => {
      const [bulletin] = activite(report, "s1").salaries ?? []
      expect(bulletin).toMatchObject({ personId: "bob", statut: "salarie", brut: 21876.4 })
      expect(bulletin.totalSalarial).toBeCloseTo(4559.1, 2)
      expect(bulletin.cotisations.assuranceChomage.patronale).toBeCloseTo(875.06, 2)
      expect(bulletin.cotisations.ags.patronale).toBeCloseTo(54.69, 2)
      expect(bulletin.totalPatronal).toBeCloseTo(9069.08, 2)
      expect(bulletin.reductionGenerale).toBeCloseTo(8708.99, 2)
      expect(bulletin.coutEmployeur).toBeCloseTo(22236.49, 2)
    })

    it("société et foyer du salarié", () => {
      expect(activite(report, "s1")).toMatchObject({ charges: 21876, cotisationsSociales: 360, impotSocietes: 15191, resultatConserve: 62573 })
      expect(report.persons.find(p => p.entityId === "bob")?.cotisationsSalariales).toBe(4559)
      expect(foyerDe(report, "bob")).toMatchObject({ revenuImposableGlobal: 16147, impotSurLeRevenu: 0, netApresImpots: 17317, revenusAvantPrelevements: 22236 })
      verifierIdentiteDuBilan(report)
    })
  })

  it("à 1,6 SMIC : brut retrouvé à partir du net", () => {
    // Brut : 1,6 x 21 876,40 = 35 002,24 €, net 35 002,24 x 79,15975 % = 27 707,69 € (seul le net est saisi).
    // Patronales : 41,456 % = 14 510,53 €. RGDU : 1/2 x (3 / 1,6 - 1) = 0,4375 ; 0,4375^1,75 = 0,23534 ;
    // C = 0,02 + 0,3781 x 0,23534 = 0,10898, arrondi à 0,1090 ; réduction 35 002,24 x 0,1090 = 3 815,24 €.
    // Coût employeur : 35 002,24 + 14 510,53 - 3 815,24 = 45 697,53 €, à un centime d'arrondi près.
    const [bulletin] = activite(simulerSalarie(27707.69), "s1").salaries ?? []

    expect(bulletin.brut).toBeCloseTo(35002.24, 1)
    expect(bulletin.totalPatronal).toBeCloseTo(14510.53, 1)
    expect(bulletin.reductionGenerale).toBeCloseTo(3815.24, 1)
    expect(bulletin.coutEmployeur).toBeCloseTo(45697.52, 1)
  })

  it("à 2,5 SMIC : au-delà du PASS, réduction générale réduite à 2,67 %", () => {
    // Brut saisi : 2,5 x 21 876,40 = 54 691 € ; tranche 2 : 6 631 €.
    // Salariales : 0,0119 x 48 060 + 0,1979025 x 54 691 = 571,91 + 10 823,49 = 11 395,40 €, net 43 295,60 €.
    // Patronales : celles du président, 0,3731 x 54 691 + 43,25 = 20 448,47 €, plus chômage 2 187,64 €, AGS 136,73 € et dialogue
    // social 8,75 € : 22 781,58 €. RGDU : 1/2 x (3 / 2,5 - 1) = 0,1 ; 0,1^1,75 = 0,017783 ; C = 0,02 + 0,3781 x 0,017783 = 0,026724,
    // arrondi à 0,0267 ; réduction 54 691 x 0,0267 = 1 460,25 €. Coût employeur : 54 691 + 22 781,58 - 1 460,25 = 76 012,33 €.
    const report = simulerSalarie(43295.6, 54691)
    const [bulletin] = activite(report, "s1").salaries ?? []

    expect(bulletin.totalSalarial).toBeCloseTo(11395.4, 1)
    expect(bulletin.cotisations.contributionEquilibreTechnique.salariale).toBeCloseTo(76.57, 2)
    expect(bulletin.totalPatronal).toBeCloseTo(22781.58, 1)
    expect(bulletin.reductionGenerale).toBeCloseTo(1460.25, 2)
    expect(bulletin.coutEmployeur).toBeCloseTo(76012.33, 1)
    expect(activite(report, "s1")).toMatchObject({ charges: 54691, cotisationsSociales: 21321 })
  })
})
