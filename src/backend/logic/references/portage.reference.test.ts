// src/backend/logic/references/portage.reference.test.ts

import { describe, expect, it } from "vitest"
import type { ComparaisonOptions, ConditionsPortage, FinancialFlow } from "../../../types.js"
import { comparerStatuts } from "../comparateur.js"
import { defaultFraisFonctionnement } from "../options-du-comparateur.js"
import { runMetaSimulation } from "../simulation-engine.js"
import { activite, casDeReference, foyerDe, REGLES_DES_CAS, verifierIdentiteDuBilan } from "../testing/cas-de-reference.js"
import { chaqueMois, micro, personne, portage, relation, session } from "../testing/session-de-test.js"

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
 *     des cadres 1,50, forfait social de 8 % sur cette prévoyance 0,12 : 16,18 % ; sur la tranche 2 : Agirc-Arrco 12,95,
 *     CEG 1,62 : 14,57 % ;
 *   - patronales jusqu'à 4 PASS : assurance chômage 4,00, AGS 0,25, APEC 0,036 : 4,286 % ;
 *   - soit 45,012 % sous le PASS ;
 *   - salariales : vieillesse 6,90 (tranche 1) et 0,40, Agirc-Arrco 3,15 et CEG 0,86 (tranche 1), 8,64 et 1,08 (tranche 2),
 *     APEC 0,024 (jusqu'à 4 PASS), CET 0,14 au-delà du PASS ; CSG et CRDS 9,70 % de 98,25 % du brut, dont 2,90 points non
 *     déductibles ; CSG et CRDS de 9,70 % sur la prévoyance patronale (1,50 % de la tranche 1), sans abattement, dont 2,90
 *     points non déductibles : 0,1455 % de la tranche 1 ; soit 21,00975 % sous le PASS, et 2,90 % x (98,25 % + 1,50 %) du
 *     brut non déductibles.
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
    // Masse salariale, sous le PASS : 55 800 / 1,45012 = 38 479,57 € ; salaire de base 38 479,57 / 1,15 = 33 460,50 €,
    // apport d'affaires 1 673,02 €, indemnité de précarité 3 346,05 €.
    // Patronales 38 479,57 x 45,012 % = 17 320,43 € ; salariales x 21,00975 % = 8 084,46 € ; net 30 395,11 €.
    // Réduction générale gardée par la société : (3 x 21 876,40 / 38 479,57 - 1) / 2 = 0,352780, puissance 1,75 : 0,161494 ;
    // C = 0,02 + 0,3821 x 0,161494 = 0,08171, arrondi 0,0817 ; 38 479,57 x 0,0817 = 3 143,78 €.
    // Imposable : 30 395,11 + 38 479,57 x (98,25 % + 1,50 %) x 2,9 % = 31 508,23 € ; après 10 % : 28 357,41 €.
    // Impôt : 11 % x (28 357,41 - 11 600) = 1 843,31 € ; décote 897 - 45,25 % x 1 843,31 = 62,90 € ; 1 780,41, soit 1 780 €.
    // Net après impôt : 30 395,11 - 1 780 = 28 615 € (28 686 € sans les prélèvements sur la prévoyance : - 71 €).
    const { report, resultat, detail, foyer } = simulerCamille(5000, { contrat: "CDD" })

    it("enveloppe, masse salariale et son partage", () => {
      expect(detail.fraisDeGestion).toBeCloseTo(4200, 6)
      expect(detail.enveloppe).toBeCloseTo(55800, 6)
      expect(detail.masseSalariale).toBeCloseTo(38479.57, 2)
      expect(detail.salaireDeBase).toBeCloseTo(33460.5, 2)
      expect(detail.indemniteApportDAffaires).toBeCloseTo(1673.02, 2)
      expect(detail.reserve).toBeCloseTo(3346.05, 2)
    })

    it("bulletin, net et réduction générale gardée", () => {
      expect(detail.bulletin.totalPatronal).toBeCloseTo(17320.43, 2)
      expect(detail.bulletin.totalSalarial).toBeCloseTo(8084.46, 2)
      // Prévoyance patronale 38 479,57 x 1,50 % = 577,19 € : CSG et CRDS 9,70 %, 55,99 € ; forfait social 8 %, 46,18 €.
      expect(detail.bulletin.cotisationsDuPortage?.csgCrdsPrevoyance.salariale).toBeCloseTo(55.99, 2)
      expect(detail.bulletin.cotisationsDuPortage?.forfaitSocialPrevoyance.patronale).toBeCloseTo(46.18, 2)
      expect(detail.bulletin.reductionGenerale).toBe(0)
      expect(detail.reductionGeneraleGardee).toBeCloseTo(3143.78, 2)
      expect(detail.netVerse).toBeCloseTo(30395.11, 2)
      expect(detail.netImposable).toBeCloseTo(31508.23, 2)
      expect(resultat).toMatchObject({ chiffreAffaires: 60000, charges: 4200, cotisationsSociales: 25405, revenuVerse: 30395, resultatConserve: 0, warnings: [] })
    })

    it("impôt et net du foyer", () => {
      expect(foyer).toMatchObject({ revenuImposableGlobal: 28357, impotSurLeRevenu: 1780, netApresImpots: 28615, revenusAvantPrelevements: 55800 })
      verifierIdentiteDuBilan(report)
    })
  })

  describe("le même en CDI : la réserve reste sur le compte d'activité", () => {
    // Brut versé : 38 479,57 - 3 346,05 = 35 133,52 € ; part versée 1,05 / 1,15.
    // Net versé : 30 395,11 x 1,05 / 1,15 = 27 752,06 € ; réserve nette 2 643,05 €, conservée.
    // Imposable : 27 752,06 + 35 133,52 x (98,25 % + 1,50 %) x 2,9 % = 28 768,38 € ; après 10 % : 25 891,55 €.
    // Impôt : 11 % x 14 291,55 = 1 572,07 € ; décote 897 - 711,36 = 185,64 € ; 1 386,43, soit 1 386 €. Net : 26 366 €.
    const { report, resultat, detail, foyer } = simulerCamille(5000)

    it("brut et net versés, réserve conservée", () => {
      expect(detail.conditions.contrat).toBe("CDI")
      expect(detail.brutVerse).toBeCloseTo(35133.52, 2)
      expect(detail.netVerse).toBeCloseTo(27752.06, 2)
      expect(detail.reserveConservee).toBeCloseTo(2643.05, 2)
      expect(resultat).toMatchObject({ revenuVerse: 27752, resultatConserve: 2643 })
    })

    it("impôt et net du foyer", () => {
      expect(foyer).toMatchObject({ revenuImposableGlobal: 25892, impotSurLeRevenu: 1386, netApresImpots: 26366, resultatConserve: 2643 })
      verifierIdentiteDuBilan(report)
    })
  })

  describe("le même avec la réduction générale reversée", () => {
    // Masse salariale M telle que M x (1,45012 - C(M)) = 55 800. Essai à C = 0,0697 : M = 55 800 / 1,38042 = 40 422,48 €.
    // Vérification : (65 629,20 / 40 422,48 - 1) / 2 = 0,311788 ; puissance 1,75 : 0,130112 ; C = 0,02 + 0,3821 x 0,130112
    // = 0,069716, arrondi 0,0697 : l'essai tient. Réduction 40 422,48 x 0,0697 = 2 817,45 €.
    // Net : 40 422,48 x (1 - 21,00975 %) = 31 929,82 € (+ 1 534,71 € par rapport à la réduction gardée).
    // Imposable : 31 929,82 + 40 422,48 x (98,25 % + 1,50 %) x 2,9 % = 33 099,14 € ; après 10 % : 29 789,23 €.
    // Impôt : 1 977,69 + 30 % x 210,23 = 2 040,76 € ; pas de décote ; 2 041 €. Net : 29 889 €.
    const { report, detail, foyer } = simulerCamille(5000, { contrat: "CDD", reductionGeneraleReversee: true })

    it("masse salariale, réduction et net", () => {
      expect(detail.masseSalariale).toBeCloseTo(40422.48, 2)
      expect(detail.bulletin.reductionGenerale).toBeCloseTo(2817.45, 2)
      expect(detail.bulletin.coutEmployeur).toBeCloseTo(55800, 4)
      expect(detail.reductionGeneraleGardee).toBe(0)
      expect(detail.netVerse).toBeCloseTo(31929.82, 2)
    })

    it("impôt et net du foyer", () => {
      expect(foyer).toMatchObject({ revenuImposableGlobal: 29789, impotSurLeRevenu: 2041, netApresImpots: 29889 })
      verifierIdentiteDuBilan(report)
    })
  })

  describe("150 000 € HT en CDD : masse salariale au-delà du PASS", () => {
    // Frais de gestion 10 500 € ; enveloppe 139 500 €. Au-delà du PASS, sans réduction générale (plus de 3 SMIC) :
    // coût = M x (1 + 24,546 % + 0,21 % + 4,286 %) + PASS x 16,18 % + (M - PASS) x 14,57 % = 1,43612 M + 773,77.
    // M = (139 500 - 773,77) / 1,43612 = 96 597,94 €.
    // Salariales : M x (0,40 + 0,14 + 0,024 + 9,53025) % + PASS x (10,91 + 0,1455) % + (M - PASS) x 9,72 %
    // = 0,1981425 M + 641,84 = 19 782,00 € ; net 76 815,94 €. CET : 0,14 % et 0,21 % de M, 135,24 € et 202,86 €.
    // Imposable : 76 815,94 + (96 597,94 x 98,25 % + PASS x 1,50 %) x 2,9 % = 79 589,16 € ; après 10 % : 71 630,25 €.
    // Impôt : 1 977,69 + 30 % x (71 630,25 - 29 579) = 14 593,06 €, soit 14 593 €. Net : 62 223 €.
    const { report, detail, foyer } = simulerCamille(12500, { contrat: "CDD" })

    it("masse salariale, contribution d'équilibre technique et net", () => {
      expect(detail.masseSalariale).toBeCloseTo(96597.94, 1)
      expect(detail.bulletin.reductionGenerale).toBe(0)
      expect(detail.reductionGeneraleGardee).toBe(0)
      expect(detail.bulletin.cotisations.contributionEquilibreTechnique.salariale).toBeCloseTo(135.24, 2)
      expect(detail.bulletin.cotisations.contributionEquilibreTechnique.patronale).toBeCloseTo(202.86, 2)
      expect(detail.bulletin.totalSalarial).toBeCloseTo(19782, 1)
      expect(detail.netVerse).toBeCloseTo(76815.94, 1)
    })

    it("impôt et net du foyer", () => {
      expect(foyer).toMatchObject({ revenuImposableGlobal: 71630, impotSurLeRevenu: 14593, netApresImpots: 62223 })
      verifierIdentiteDuBilan(report)
    })
  })

  describe("plancher et plafond mensuels des frais de gestion", () => {
    it("un plancher qui joue : 2 000 € HT sur trois mois, plancher de 250 € par mois", () => {
      // 7 % de 2 000 € = 140 € < 250 € : frais de gestion 3 x 250 = 750 € ; enveloppe 5 250 €.
      // Masse salariale 5 250 / 1,45012 = 3 620,39 € ; salaire de base 3 148,17 €, soit 1 049,39 € par mois avec mission,
      // sous le minimum conventionnel : avertissement.
      const { report, detail, resultat } = simulerCamille(2000, { plancherMensuel: 250 }, [0, 1, 2])
      expect(detail.moisAvecChiffreDAffaires).toBe(3)
      expect(detail.fraisDeGestion).toBeCloseTo(750, 6)
      expect(detail.masseSalariale).toBeCloseTo(3620.39, 2)
      expect(detail.salaireDeBaseMensuel).toBeCloseTo(1049.39, 2)
      expect(resultat.warnings).toContainEqual(expect.stringContaining("sous le minimum conventionnel"))
      verifierIdentiteDuBilan(report)
    })

    it("un plafond qui joue : 10 000 € HT par mois, plafond de 500 € par mois et 30 € de frais fixes", () => {
      // 7 % de 10 000 € = 700 € > 500 € : frais de gestion 12 x (500 + 30) = 6 360 € ; enveloppe 113 640 €.
      // Au-delà du PASS : M = (113 640 - 773,77) / 1,43612 = 78 591,09 €.
      const { report, detail } = simulerCamille(10000, { plafondMensuel: 500, fraisFixesMensuels: 30 })
      expect(detail.fraisDeGestion).toBeCloseTo(6360, 6)
      expect(detail.enveloppe).toBeCloseTo(113640, 6)
      expect(detail.masseSalariale).toBeCloseTo(78591.09, 1)
      verifierIdentiteDuBilan(report)
    })
  })

  describe("frais professionnels remboursés : 500 € par mois en plus des 60 000 € HT", () => {
    // Les frais de gestion portent sur le chiffre d'affaires : 4 200 €. Enveloppe 60 000 - 4 200 - 6 000 = 49 800 € ;
    // masse salariale 49 800 / 1,45012 = 34 341,99 € ; net x 78,99025 % = 27 126,82 €.
    // Imposable : 27 126,82 + 34 341,99 x (98,25 % + 1,50 %) x 2,9 % = 28 120,25 € : les 6 000 € remboursés n'y sont pas.
    const { report, detail, resultat } = simulerCamille(5000, { contrat: "CDD" }, undefined, [["deductible_expense", 500]])

    it("retirés de l'enveloppe, ni cotisés ni imposés", () => {
      expect(detail.fraisProfessionnels).toBe(6000)
      expect(detail.enveloppe).toBeCloseTo(49800, 6)
      expect(detail.masseSalariale).toBeCloseTo(34341.99, 2)
      expect(detail.netVerse).toBeCloseTo(27126.82, 2)
      expect(detail.netImposable).toBeCloseTo(28120.25, 2)
      expect(resultat.charges).toBe(10200)
      verifierIdentiteDuBilan(report)
    })
  })

  describe("cas 8 : la colonne du comparateur d'une micro-entreprise BNC à 60 000 €, comme une activité en portage saisie", () => {
    // Camille, micro-entrepreneuse en prestations BNC, 5 000 € par mois. Dans la colonne « Portage salarial », l'activité
    // devient une activité en portage aux conditions réglées dans le comparateur : avec les mêmes conditions, son
    // résultat est celui d'une activité en portage saisie directement. Conditions typiques (CDI) : c'est le cas « en
    // CDI » ci-dessus, net après impôt 26 366 €, salaire versé 27 752 €, réserve nette 2 643 € conservée.
    const enMicro = chaqueMois(session([personne("camille"), micro("p1")], [relation("camille", "p1", "Titulaire")]), "p1", "ca_micro_services_bnc", 5000)
    const sansFrais: ComparaisonOptions = { activityId: "p1", remunerationNette: 0, repartition: { mode: "meilleurNet", partDistribuee: 1 }, partBncPrestations: 1 }
    const colonneDuPortage = (options: ComparaisonOptions) => comparerStatuts(enMicro, options, REGLES_DES_CAS, { annee: 2026 }).scenarios.find(s => s.statut === "portage")

    it("conditions typiques : le même résultat que l'activité en portage saisie", () => {
      const saisie = simulerCamille(5000)
      const colonne = colonneDuPortage(sansFrais)
      expect(colonne?.netApresImpots).toBe(26366)
      expect(colonne?.netApresImpots).toBe(saisie.report.totalNetApresImpots)
      expect(colonne).toMatchObject({ cotisationsSociales: saisie.report.bilan.cotisationsSociales + saisie.report.bilan.cotisationsSalariales, impotSurLeRevenu: 1386, resultatConserveActivite: 2643, ecartDeFrais: { total: 0 } })
      // Salarié cadre du régime général, assurance chômage comprise : la cinquième étoile, avec 4 trimestres.
      expect(colonne?.protectionSociale).toMatchObject({ etoiles: 5, trimestres: 4 })
    })

    it("conditions réglées (CDD, frais de gestion de 8 %, réduction générale reversée) : le même net que l'activité saisie avec ces conditions", () => {
      const conditions: ConditionsPortage = { contrat: "CDD", tauxFraisDeGestion: 0.08, reductionGeneraleReversee: true }
      expect(colonneDuPortage({ ...sansFrais, portage: conditions })?.netApresImpots).toBe(simulerCamille(5000, conditions).report.totalNetApresImpots)
    })

    it("avec les frais de fonctionnement supposés : la colonne ne garde pas les 850 € de la micro-entreprise, qui deviennent des frais professionnels négatifs", () => {
      // Micro-entreprise : banque 100, logiciel 100, assurance 350, CFE 300 = 850 € ; portage : aucun (ADR 016).
      const avecFrais = colonneDuPortage({ ...sansFrais, fraisFonctionnement: defaultFraisFonctionnement() })
      expect(avecFrais?.ecartDeFrais.total).toBe(-850)
      expect(avecFrais?.netApresImpots).toBe(simulerCamille(5000, {}, undefined, [["deductible_expense", -850 / 12]]).report.totalNetApresImpots)
    })
  })

  describe("mutuelle de 60 € par mois", () => {
    // Retenue sur le net des douze mois avec salaire : 720 €, déduite du salaire imposable (CGI, art. 83, 1° quater).
    // Net versé 30 395,11 - 720 = 29 675,11 € ; imposable 31 508,23 - 720 = 30 788,23 € ; après 10 % : 27 709,41 €.
    // Impôt : 11 % x 16 109,41 = 1 772,03 € ; décote 897 - 801,84 = 95,16 € ; 1 676,87, soit 1 677 €. Net : 27 998 €.
    const { report, detail, resultat, foyer } = simulerCamille(5000, { contrat: "CDD", mutuelleMensuelle: 60 })

    it("retenue sur le net et sur l'imposable, comptée avec les cotisations", () => {
      expect(detail.mutuelle).toBe(720)
      expect(detail.netVerse).toBeCloseTo(29675.11, 2)
      expect(detail.netImposable).toBeCloseTo(30788.23, 2)
      expect(resultat.cotisationsSociales).toBe(26125)
      expect(foyer).toMatchObject({ revenuImposableGlobal: 27709, impotSurLeRevenu: 1677, netApresImpots: 27998 })
      verifierIdentiteDuBilan(report)
    })
  })
})
