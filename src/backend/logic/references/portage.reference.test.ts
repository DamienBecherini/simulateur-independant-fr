// src/backend/logic/references/portage.reference.test.ts

import { describe, expect, it } from "vitest"
import type { ConditionsPortage, FinancialFlow } from "../../../types.js"
import { runMetaSimulation } from "../simulation-engine.js"
import { activite, casDeReference, foyerDe, REGLES_DES_CAS, verifierIdentiteDuBilan } from "../testing/cas-de-reference.js"
import { chaqueMois, personne, portage, relation, session } from "../testing/session-de-test.js"

/*
 * Cas de référence 2026 : activité en portage salarial (voir l'ADR 016, « Exemple calculé à la main »).
 *
 * Démarche : le moteur tourne avec les règles réelles de 2026 (REGLES_DES_CAS) ; chaque attendu est dérivé à la main des
 * taux officiels, sans lancer le moteur. PASS : 48 060 €. SMIC annuel de la réduction générale : 21 876,40 €.
 *
 * Bulletin du salarié porté, cadre d'une société de portage de 50 salariés et plus, sans versement mobilité :
 *   - patronales sur tout le brut : maladie 13, vieillesse déplafonnée 2,11, allocations familiales 5,25, accidents du
 *     travail 0,64, solidarité autonomie 0,30, FNAL 0,50, dialogue social 0,016, formation professionnelle 1,00 et
 *     conventionnelle 0,60, taxe d'apprentissage 0,68, effort de construction 0,45 : 24,546 % ; contribution d'équilibre
 *     technique 0,21 % en plus au-delà du PASS ;
 *   - patronales sur la tranche 1 (jusqu'au PASS) : vieillesse plafonnée 8,55, Agirc-Arrco 4,72, CEG 1,29, prévoyance
 *     des cadres 1,50 : 16,06 % ; sur la tranche 2 : Agirc-Arrco 12,95, CEG 1,62 : 14,57 % ;
 *   - patronales jusqu'à 4 PASS : assurance chômage 4,00, AGS 0,25, APEC 0,036 : 4,286 % ;
 *   - soit 44,892 % sous le PASS ;
 *   - salariales : vieillesse 6,90 (tranche 1) et 0,40, Agirc-Arrco 3,15 et CEG 0,86 (tranche 1), 8,64 et 1,08 (tranche 2),
 *     APEC 0,024 (jusqu'à 4 PASS), CET 0,14 au-delà du PASS ; CSG et CRDS 9,70 % de 98,25 % du brut, dont 2,90 points non
 *     déductibles : 20,86425 % sous le PASS.
 *
 * Indemnité d'apport d'affaires 5 % et réserve 10 % du salaire de base : salaire de base = masse salariale / 1,15.
 * Impôt 2026 d'une part : 11 % de 11 600 à 29 579 €, 30 % au-delà ; décote 897 - 45,25 % de l'impôt brut ; impôt arrondi
 * à l'euro. Déduction forfaitaire de 10 %.
 */

/** Camille, seule, facture `parMois` HT chaque mois indiqué (tous par défaut) par une société de portage. */
function simulerCamille(parMois: number, conditions: ConditionsPortage = {}, mois?: number[], autres: [FinancialFlow["type"], number][] = []) {
  const donnees = chaqueMois(session([personne("camille"), portage("p1", conditions)], [relation("camille", "p1", "Titulaire")]), "p1", "ca_services", parMois, mois)
  for (const [type, montant] of autres) chaqueMois(donnees, "p1", type, montant, mois)
  const report = runMetaSimulation(donnees, REGLES_DES_CAS, { annee: 2026 })
  const resultat = activite(report, "p1")
  if (!resultat.portage) throw new Error("Détail du portage absent")
  return { report, resultat, detail: resultat.portage, foyer: foyerDe(report, "camille") }
}

casDeReference("Cas de référence 2026 : portage salarial", () => {
  describe("l'exemple de l'ADR 016 : 60 000 € HT, frais de gestion de 7 %, CDD, réduction générale non reversée", () => {
    // Frais de gestion : 7 % de 5 000 € chaque mois, 4 200 € ; enveloppe 55 800 €.
    // Masse salariale, sous le PASS : 55 800 / 1,44892 = 38 511,44 € ; salaire de base 38 511,44 / 1,15 = 33 488,21 €,
    // apport d'affaires 1 674,41 €, indemnité de précarité 3 348,82 €.
    // Patronales 38 511,44 x 44,892 % = 17 288,56 € ; salariales x 20,86425 % = 8 035,12 € ; net 30 476,32 €.
    // Réduction générale gardée par la société : (3 x 21 876,40 / 38 511,44 - 1) / 2 = 0,352075, puissance 1,75 : 0,160932 ;
    // C = 0,02 + 0,3821 x 0,160932 = 0,08149, arrondi 0,0815 ; 38 511,44 x 0,0815 = 3 138,68 €.
    // Imposable : 30 476,32 + 38 511,44 x 98,25 % x 2,9 % = 31 573,61 € ; après 10 % : 28 416,25 €.
    // Impôt : 11 % x (28 416,25 - 11 600) = 1 849,79 € ; décote 897 - 45,25 % x 1 849,79 = 59,97 € ; 1 789,82, soit 1 790 €.
    // Net après impôt : 30 476,32 - 1 790 = 28 686 €. (L'ADR proposée écrivait 28 687 € : elle n'arrondissait pas l'impôt.)
    const { report, resultat, detail, foyer } = simulerCamille(5000, { contrat: "CDD" })

    it("enveloppe, masse salariale et son partage", () => {
      expect(detail.fraisDeGestion).toBeCloseTo(4200, 6)
      expect(detail.enveloppe).toBeCloseTo(55800, 6)
      expect(detail.masseSalariale).toBeCloseTo(38511.44, 2)
      expect(detail.salaireDeBase).toBeCloseTo(33488.21, 2)
      expect(detail.indemniteApportDAffaires).toBeCloseTo(1674.41, 2)
      expect(detail.reserve).toBeCloseTo(3348.82, 2)
    })

    it("bulletin, net et réduction générale gardée", () => {
      expect(detail.bulletin.totalPatronal).toBeCloseTo(17288.56, 2)
      expect(detail.bulletin.totalSalarial).toBeCloseTo(8035.12, 2)
      expect(detail.bulletin.reductionGenerale).toBe(0)
      expect(detail.reductionGeneraleGardee).toBeCloseTo(3138.68, 2)
      expect(detail.netVerse).toBeCloseTo(30476.32, 2)
      expect(detail.netImposable).toBeCloseTo(31573.61, 2)
      expect(resultat).toMatchObject({ chiffreAffaires: 60000, charges: 4200, cotisationsSociales: 25324, revenuVerse: 30476, resultatConserve: 0, warnings: [] })
    })

    it("impôt et net du foyer", () => {
      expect(foyer).toMatchObject({ revenuImposableGlobal: 28416, impotSurLeRevenu: 1790, netApresImpots: 28686, revenusAvantPrelevements: 55800 })
      verifierIdentiteDuBilan(report)
    })
  })

  describe("le même en CDI : la réserve reste sur le compte d'activité", () => {
    // Brut versé : 38 511,44 - 3 348,82 = 35 162,62 € ; part versée 1,05 / 1,15.
    // Net versé : 30 476,32 x 1,05 / 1,15 = 27 826,20 € ; réserve nette 2 650,11 €, conservée.
    // Imposable : 27 826,20 + 35 162,62 x 98,25 % x 2,9 % = 28 828,08 € ; après 10 % : 25 945,27 €.
    // Impôt : 11 % x 14 345,27 = 1 577,98 € ; décote 897 - 714,04 = 182,96 € ; 1 395,02, soit 1 395 €. Net : 26 431 €.
    const { report, resultat, detail, foyer } = simulerCamille(5000)

    it("brut et net versés, réserve conservée", () => {
      expect(detail.conditions.contrat).toBe("CDI")
      expect(detail.brutVerse).toBeCloseTo(35162.62, 2)
      expect(detail.netVerse).toBeCloseTo(27826.2, 2)
      expect(detail.reserveConservee).toBeCloseTo(2650.11, 2)
      expect(resultat).toMatchObject({ revenuVerse: 27826, resultatConserve: 2650 })
    })

    it("impôt et net du foyer", () => {
      expect(foyer).toMatchObject({ revenuImposableGlobal: 25945, impotSurLeRevenu: 1395, netApresImpots: 26431, resultatConserve: 2650 })
      verifierIdentiteDuBilan(report)
    })
  })

  describe("le même avec la réduction générale reversée", () => {
    // Masse salariale M telle que M x (1,44892 - C(M)) = 55 800. Essai à C = 0,0695 : M = 55 800 / 1,37942 = 40 451,78 €.
    // Vérification : (65 629,20 / 40 451,78 - 1) / 2 = 0,311203 ; puissance 1,75 : 0,129667 ; C = 0,02 + 0,3821 x 0,129667
    // = 0,069546, arrondi 0,0695 : l'essai tient. Réduction 40 451,78 x 0,0695 = 2 811,40 €.
    // Net : 40 451,78 x (1 - 20,86425 %) = 32 011,82 € (+ 1 535,50 € par rapport à la réduction gardée).
    // Imposable : 32 011,82 + 40 451,78 x 98,25 % x 2,9 % = 33 164,40 € ; après 10 % : 29 847,96 €.
    // Impôt : 1 977,69 + 30 % x 268,96 = 2 058,38 € ; pas de décote ; 2 058 €. Net : 29 954 €.
    const { report, detail, foyer } = simulerCamille(5000, { contrat: "CDD", reductionGeneraleReversee: true })

    it("masse salariale, réduction et net", () => {
      expect(detail.masseSalariale).toBeCloseTo(40451.78, 2)
      expect(detail.bulletin.reductionGenerale).toBeCloseTo(2811.4, 2)
      expect(detail.bulletin.coutEmployeur).toBeCloseTo(55800, 4)
      expect(detail.reductionGeneraleGardee).toBe(0)
      expect(detail.netVerse).toBeCloseTo(32011.82, 2)
    })

    it("impôt et net du foyer", () => {
      expect(foyer).toMatchObject({ revenuImposableGlobal: 29848, impotSurLeRevenu: 2058, netApresImpots: 29954 })
      verifierIdentiteDuBilan(report)
    })
  })

  describe("150 000 € HT en CDD : masse salariale au-delà du PASS", () => {
    // Frais de gestion 10 500 € ; enveloppe 139 500 €. Au-delà du PASS, sans réduction générale (plus de 3 SMIC) :
    // coût = M x (1 + 24,546 % + 0,21 % + 4,286 %) + PASS x 16,06 % + (M - PASS) x 14,57 % = 1,43612 M + 716,09.
    // M = (139 500 - 716,09) / 1,43612 = 96 638,10 €.
    // Salariales : M x (0,40 + 0,14 + 0,024 + 9,53025) % + PASS x 10,91 % + (M - PASS) x 9,72 % = 0,1981425 M + 571,91
    // = 19 720,03 € ; net 76 918,07 €. CET : 0,14 % et 0,21 % de M, 135,29 € et 202,94 €.
    // Imposable : 76 918,07 + 96 638,10 x 98,25 % x 2,9 % = 79 671,53 € ; après 10 % (7 967,15 €) : 71 704,38 €.
    // Impôt : 1 977,69 + 30 % x (71 704,38 - 29 579) = 14 615,30 €, soit 14 615 €. Net : 62 303 €.
    const { report, detail, foyer } = simulerCamille(12500, { contrat: "CDD" })

    it("masse salariale, contribution d'équilibre technique et net", () => {
      expect(detail.masseSalariale).toBeCloseTo(96638.1, 1)
      expect(detail.bulletin.reductionGenerale).toBe(0)
      expect(detail.reductionGeneraleGardee).toBe(0)
      expect(detail.bulletin.cotisations.contributionEquilibreTechnique.salariale).toBeCloseTo(135.29, 2)
      expect(detail.bulletin.cotisations.contributionEquilibreTechnique.patronale).toBeCloseTo(202.94, 2)
      expect(detail.bulletin.totalSalarial).toBeCloseTo(19720.03, 1)
      expect(detail.netVerse).toBeCloseTo(76918.07, 1)
    })

    it("impôt et net du foyer", () => {
      expect(foyer).toMatchObject({ revenuImposableGlobal: 71704, impotSurLeRevenu: 14615, netApresImpots: 62303 })
      verifierIdentiteDuBilan(report)
    })
  })

  describe("plancher et plafond mensuels des frais de gestion", () => {
    it("un plancher qui joue : 2 000 € HT sur trois mois, plancher de 250 € par mois", () => {
      // 7 % de 2 000 € = 140 € < 250 € : frais de gestion 3 x 250 = 750 € ; enveloppe 5 250 €.
      // Masse salariale 5 250 / 1,44892 = 3 623,39 € ; salaire de base 3 150,77 €, soit 1 050,26 € par mois avec mission,
      // sous le minimum conventionnel : avertissement.
      const { report, detail, resultat } = simulerCamille(2000, { plancherMensuel: 250 }, [0, 1, 2])
      expect(detail.moisAvecChiffreDAffaires).toBe(3)
      expect(detail.fraisDeGestion).toBeCloseTo(750, 6)
      expect(detail.masseSalariale).toBeCloseTo(3623.39, 2)
      expect(detail.salaireDeBaseMensuel).toBeCloseTo(1050.26, 2)
      expect(resultat.warnings).toContainEqual(expect.stringContaining("sous le minimum conventionnel"))
      verifierIdentiteDuBilan(report)
    })

    it("un plafond qui joue : 10 000 € HT par mois, plafond de 500 € par mois et 30 € de frais fixes", () => {
      // 7 % de 10 000 € = 700 € > 500 € : frais de gestion 12 x (500 + 30) = 6 360 € ; enveloppe 113 640 €.
      // Au-delà du PASS : M = (113 640 - 716,09) / 1,43612 = 78 631,25 €.
      const { report, detail } = simulerCamille(10000, { plafondMensuel: 500, fraisFixesMensuels: 30 })
      expect(detail.fraisDeGestion).toBeCloseTo(6360, 6)
      expect(detail.enveloppe).toBeCloseTo(113640, 6)
      expect(detail.masseSalariale).toBeCloseTo(78631.25, 1)
      verifierIdentiteDuBilan(report)
    })
  })

  describe("frais professionnels remboursés : 500 € par mois en plus des 60 000 € HT", () => {
    // Les frais de gestion portent sur le chiffre d'affaires : 4 200 €. Enveloppe 60 000 - 4 200 - 6 000 = 49 800 € ;
    // masse salariale 49 800 / 1,44892 = 34 370,43 € ; net x 79,13575 % = 27 199,30 €.
    // Imposable : 27 199,30 + 34 370,43 x 98,25 % x 2,9 % = 28 178,60 € : les 6 000 € remboursés n'y sont pas.
    const { report, detail, resultat } = simulerCamille(5000, { contrat: "CDD" }, undefined, [["deductible_expense", 500]])

    it("retirés de l'enveloppe, ni cotisés ni imposés", () => {
      expect(detail.fraisProfessionnels).toBe(6000)
      expect(detail.enveloppe).toBeCloseTo(49800, 6)
      expect(detail.masseSalariale).toBeCloseTo(34370.43, 2)
      expect(detail.netVerse).toBeCloseTo(27199.296, 2)
      expect(detail.netImposable).toBeCloseTo(28178.595, 2)
      expect(resultat.charges).toBe(10200)
      verifierIdentiteDuBilan(report)
    })
  })

  describe("mutuelle de 60 € par mois", () => {
    // Retenue sur le net des douze mois avec salaire : 720 €, déduite du salaire imposable (CGI, art. 83, 1° quater).
    // Net versé 30 476,32 - 720 = 29 756,32 € ; imposable 31 573,61 - 720 = 30 853,61 € ; après 10 % : 27 768,25 €.
    // Impôt : 11 % x 16 168,25 = 1 778,51 € ; décote 897 - 804,78 = 92,22 € ; 1 686,29, soit 1 686 €. Net : 28 070 €.
    const { report, detail, resultat, foyer } = simulerCamille(5000, { contrat: "CDD", mutuelleMensuelle: 60 })

    it("retenue sur le net et sur l'imposable, comptée avec les cotisations", () => {
      expect(detail.mutuelle).toBe(720)
      expect(detail.netVerse).toBeCloseTo(29756.32, 2)
      expect(detail.netImposable).toBeCloseTo(30853.61, 2)
      expect(resultat.cotisationsSociales).toBe(26044)
      expect(foyer).toMatchObject({ revenuImposableGlobal: 27768, impotSurLeRevenu: 1686, netApresImpots: 28070 })
      verifierIdentiteDuBilan(report)
    })
  })
})
