// src/backend/logic/references/societes.reference.test.ts

import { describe, expect, it } from "vitest"
import { activite, casDeReference, foyerDe, simuler, verifierIdentiteDuBilan } from "../testing/cas-de-reference.js"
import { personne, relation, societe, type Flux } from "../testing/session-de-test.js"
import type { Company } from "../../../types.js"

/*
 * Cas de référence 2026 : SASU, EURL et entreprise individuelle au réel, dirigeant célibataire (1 part).
 *
 * Démarche : le moteur tourne avec les règles réelles de config.json, et chaque attendu est dérivé à la main
 * à partir des règles officielles 2026, sans lancer le moteur. En cas d'écart, c'est le moteur qui est suspect.
 *
 * Règles officielles utilisées :
 * - IS : 15 % jusqu'à 42 500 € de bénéfice, 25 % au-delà ; seuls les bénéfices après IS sont distribuables ;
 * - dividendes : prélèvement forfaitaire de 12,8 % d'IR et 18,6 % de prélèvements sociaux, ou option pour le
 *   barème (abattement de 40 %, CSG déductible de 6,8 % des dividendes soumis aux prélèvements sociaux),
 *   l'option la plus favorable étant retenue ; les prélèvements sociaux sont dus dans les deux cas ;
 * - cotisations des travailleurs non salariés (urssaf.fr, taux-cotisations-ac-plnr ; articles D621-1, D621-2, D613-1
 *   et D136-5 du code de la sécurité sociale), avec un PASS de 48 060 € :
 *   assiette unique = revenu avant cotisations - 26 %, l'abattement restant entre 845,86 € et 62 478 € ;
 *   maladie-maternité à taux progressif, appliqué à toute l'assiette et interpolé linéairement entre 0 % à 9 612 €,
 *   1,5 % à 19 224 €, 4 % à 28 836 €, 6,5 % à 52 866 €, 7,7 % à 96 120 € et 8,5 % à 144 180 € ;
 *   indemnités journalières 0,5 % (au moins sur 19 224 €) ; retraite de base 17,87 % jusqu'à 48 060 € (au moins sur
 *   5 409 €), 0,72 % au-delà ; complémentaire 8,1 % jusqu'à 48 060 €, 9,1 % jusqu'à 192 240 € ; invalidité-décès 1,3 %
 *   jusqu'à 48 060 € (au moins sur 5 527 €) ; allocations familiales nulles jusqu'à 52 866 €, puis
 *   3,1 % x (assiette - 52 866) / 14 418 sur toute l'assiette, 3,1 % au-delà de 67 284 € ; CSG-CRDS 9,7 %, dont 2,9 %
 *   (CSG non déductible et CRDS) réintégrés au revenu imposable ; formation professionnelle 0,25 % x 48 060 = 120,15 € ;
 * - EURL : le revenu avant cotisations du gérant R vérifie R - cotisations(R) = rémunération nette, les cotisations
 *   étant payées par la société ; la part des dividendes qui dépasse 10 % du capital s'ajoute à R, et le gérant paie
 *   le supplément de cotisations qu'elle entraîne ; sa rémunération nette, augmentée de la CSG non déductible et de
 *   la CRDS, est imposée comme un salaire ;
 * - déduction de 10 % sur les rémunérations (minimum 509 €, maximum 14 555 €) ;
 * - barème 2026 pour une part : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 €, 30 % jusqu'à 84 577 €, 41 % jusqu'à
 *   181 917 €, 45 % au-delà ; impôt cumulé à 29 579 € : 1 977,69 €, à 84 577 € : 1 977,69 + 54 998 x 30 % = 18 477,09 € ;
 * - décote d'un célibataire : 897 € - 45,25 % de l'impôt brut, si elle est positive.
 *
 * Approximations assumées du modèle, appliquées telles quelles : cotisations du président de SASU égales à
 * 80 % de sa rémunération nette (coût total = 1,8 x net), rémunération nette du président saisie traitée comme
 * le salaire imposable.
 */

const alice = personne("alice")

function simulerSociete(statut: Company["legalStatus"], flux: Flux[], capitalSocial = 1000, autresFlux: Flux[] = []) {
  const lien = statut === "SASU" ? "Président" : statut === "EURL" ? "Gérant" : "Titulaire"
  return simuler([alice, societe("s1", statut, capitalSocial)], [relation("alice", "s1", lien)], [...flux, ...autresFlux])
}

casDeReference("Cas de référence 2026 : sociétés et entreprise individuelle", () => {
  describe("SASU", () => {
    it("rémunération seule", () => {
      // Cotisations : 40 000 x 0,8 = 32 000 €. Bénéfice : 100 000 - 10 000 - 40 000 - 32 000 = 18 000 €.
      // IS : 18 000 x 15 % = 2 700 € ; conservé 15 300 €.
      // Revenu imposable : 40 000 - 10 % (4 000 €) = 36 000 € ; impôt 1 977,69 + 6 421 x 30 % = 3 903,99 €.
      // Net : 40 000 - 3 903,99 = 36 096,01 €.
      // Bilan : 90 000 € = 32 000 + 2 700 + 3 904 (prélèvements) + 15 300 (conservé) + 36 096 (net).
      const report = simulerSociete("SASU", [
        ["s1", "ca_services", 100000],
        ["s1", "deductible_expense", 10000],
        ["s1", "director_remuneration", 40000]
      ])

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 32000, impotSocietes: 2700, resultatConserve: 15300, revenuVerse: 40000 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 36000, impotSurLeRevenu: 3904, prelevementsSociaux: 0, optionDividendes: null, netApresImpots: 36096 })
      expect(report.bilan).toMatchObject({ revenusAvantPrelevements: 90000, totalPrelevements: 38604, resultatConserve: 15300 })
      verifierIdentiteDuBilan(report)
    })

    it("dividendes seuls : l'option pour le barème est la plus favorable", () => {
      // Bénéfice 40 000 € ; IS 6 000 € ; distribuable 34 000 € ; 20 000 € distribués ; conservé 14 000 €.
      // Forfait : 20 000 x 12,8 % = 2 560 €.
      // Barème : 20 000 x 60 % - 20 000 x 6,8 % = 12 000 - 1 360 = 10 640 € < 11 600 € : impôt nul. Barème retenu.
      // Prélèvements sociaux : 20 000 x 18,6 % = 3 720 €. Net : 20 000 - 3 720 = 16 280 €.
      const report = simulerSociete("SASU", [
        ["s1", "ca_services", 50000],
        ["s1", "deductible_expense", 10000],
        ["s1", "dividends_payment", 20000]
      ])

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 0, impotSocietes: 6000, resultatConserve: 14000 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 10640, impotSurLeRevenu: 0, prelevementsSociaux: 3720, optionDividendes: "bareme", netApresImpots: 16280 })
      verifierIdentiteDuBilan(report)
    })

    it("dividendes et salaire élevé : le prélèvement forfaitaire est le plus favorable (tranche à 41 %)", () => {
      // Salaire 100 000 € : revenu imposable 90 000 € ; impôt 18 477,09 + 5 423 x 41 % = 20 700,52 €.
      // Forfait : 20 700,52 + 20 000 x 12,8 % = 23 260,52 €.
      // Barème : 90 000 + 12 000 - 1 360 = 100 640 € ; impôt 18 477,09 + 16 063 x 41 % = 25 062,92 €. Forfait retenu.
      // Net : 100 000 + 20 000 - 23 260,52 - 3 720 = 93 019,48 €.
      // (Le moteur arrondit l'impôt au barème avant d'ajouter le forfait : 20 701 + 2 560 = 23 261 €, même résultat ici.)
      const report = simulerSociete(
        "SASU",
        [
          ["s1", "ca_services", 50000],
          ["s1", "deductible_expense", 10000],
          ["s1", "dividends_payment", 20000]
        ],
        1000,
        [["alice", "salary", 100000]]
      )

      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 90000, impotSurLeRevenu: 23261, prelevementsSociaux: 3720, optionDividendes: "pfu", netApresImpots: 93019 })
      verifierIdentiteDuBilan(report)
    })

    it("rémunération et dividendes", () => {
      // Cotisations : 30 000 x 0,8 = 24 000 €. Bénéfice : 100 000 - 15 000 - 30 000 - 24 000 = 31 000 €.
      // IS : 4 650 € ; distribuable 26 350 € ; 20 000 € distribués ; conservé 6 350 €.
      // Revenu au barème : 30 000 - 3 000 = 27 000 € ; impôt brut 15 400 x 11 % = 1 694 €,
      // décote 897 - 766,535 = 130,465 €, impôt 1 563,535 €.
      // Forfait : 1 563,535 + 2 560 = 4 123,535 €.
      // Barème : 27 000 + 12 000 - 1 360 = 37 640 € ; impôt 1 977,69 + 8 061 x 30 % = 4 395,99 €. Forfait retenu.
      // Net : 30 000 + 20 000 - 4 123,535 - 3 720 = 42 156,465 €.
      // Bilan : 85 000 € = 24 000 + 4 650 + 4 124 + 3 720 (prélèvements) + 6 350 (conservé) + 42 156 (net).
      const report = simulerSociete("SASU", [
        ["s1", "ca_services", 100000],
        ["s1", "deductible_expense", 15000],
        ["s1", "director_remuneration", 30000],
        ["s1", "dividends_payment", 20000]
      ])

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 24000, impotSocietes: 4650, resultatConserve: 6350, revenuVerse: 50000 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 27000, impotSurLeRevenu: 4124, prelevementsSociaux: 3720, optionDividendes: "pfu", netApresImpots: 42156 })
      expect(report.bilan).toMatchObject({ revenusAvantPrelevements: 85000, totalPrelevements: 36494 })
      verifierIdentiteDuBilan(report)
    })

    it("bénéfice au-delà du seuil du taux réduit d'IS", () => {
      // Bénéfice : 150 000 - 30 000 = 120 000 €.
      // IS : 42 500 x 15 % + 77 500 x 25 % = 6 375 + 19 375 = 25 750 € ; conservé 94 250 €.
      const report = simulerSociete("SASU", [
        ["s1", "ca_services", 150000],
        ["s1", "deductible_expense", 30000]
      ])

      expect(activite(report, "s1")).toMatchObject({ impotSocietes: 25750, resultatConserve: 94250, revenuVerse: 0 })
      expect(foyerDe(report, "alice")).toMatchObject({ impotSurLeRevenu: 0, netApresImpots: 0, resultatConserve: 94250 })
      verifierIdentiteDuBilan(report)
    })

    it("dividendes demandés supérieurs au bénéfice distribuable", () => {
      // Bénéfice 40 000 € ; IS 6 000 € ; distribuable 34 000 € : seuls 34 000 € sur 50 000 € sont versés, rien n'est conservé.
      // Forfait : 34 000 x 12,8 % = 4 352 €.
      // Barème : 34 000 x 60 % - 34 000 x 6,8 % = 20 400 - 2 312 = 18 088 € ; impôt brut 6 488 x 11 % = 713,68 €,
      // décote 897 - 322,94 = 574,06 €, impôt 139,62 €. Barème retenu.
      // Prélèvements sociaux : 34 000 x 18,6 % = 6 324 €. Net : 34 000 - 139,62 - 6 324 = 27 536,38 €.
      const report = simulerSociete("SASU", [
        ["s1", "ca_services", 50000],
        ["s1", "deductible_expense", 10000],
        ["s1", "dividends_payment", 50000]
      ])
      const resultat = activite(report, "s1")

      expect(resultat).toMatchObject({ impotSocietes: 6000, revenuVerse: 34000, resultatConserve: 0 })
      expect(resultat.warnings.some(w => w.startsWith("Dividendes saisis"))).toBe(true)
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 18088, impotSurLeRevenu: 140, prelevementsSociaux: 6324, optionDividendes: "bareme", netApresImpots: 27536 })
      verifierIdentiteDuBilan(report)
    })
  })

  describe("EURL", () => {
    it("capital élevé : dividendes sous 10 % du capital, aux prélèvements sociaux, et forfait retenu", () => {
      // Sans rémunération, le gérant doit tout de même les cotisations minimales, payées par la société : cette prise en
      // charge fait partie de son revenu R, qui vérifie R = cotisations(R). Sous 3 253 €, l'abattement est au minimum
      // (845,86 €) et l'assiette R - 845,86 reste sous toutes les assiettes minimales : seules la retraite complémentaire
      // (8,1 %) et la CSG-CRDS (9,7 %) s'ajoutent aux 1 254,71 € de cotisations minimales.
      // R = 1 254,71 + 17,8 % x (R - 845,86), soit R = 1 104,15 / 0,822 = 1 343,24 € ; assiette 497,39 €.
      // Capital 100 000 € : seuil 10 000 €. Bénéfice 40 000 - 1 343,24 = 38 656,76 € ; IS 5 798,51 € ;
      // 10 000 € distribués ; conservé 38 656,76 - 5 798,51 - 10 000 = 22 858,24 €.
      // Salaire 60 000 € : revenu imposable 54 000 € ; impôt 1 977,69 + 24 421 x 30 % = 9 303,99 €, arrondi à 9 304 €.
      // Forfait : 9 304 + 1 280 = 10 584 €.
      // Barème : 54 000 + 6 000 - 680 = 59 320 € ; impôt 1 977,69 + 29 741 x 30 % = 10 899,99 €. Forfait retenu.
      // Prélèvements sociaux : 10 000 x 18,6 % = 1 860 €. Net : 60 000 + 10 000 - 10 584 - 1 860 = 57 556 €.
      // Bilan : 100 000 € = 1 343 + 5 799 + 10 584 + 1 860 (prélèvements, 19 586 €) + 22 858 (conservé) + 57 556 (net).
      const report = simulerSociete(
        "EURL",
        [
          ["s1", "ca_services", 50000],
          ["s1", "deductible_expense", 10000],
          ["s1", "dividends_payment", 10000]
        ],
        100000,
        [["alice", "salary", 60000]]
      )

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 1343, impotSocietes: 5799, resultatConserve: 22858, revenuVerse: 10000 })
      expect(activite(report, "s1").warnings).toEqual([expect.stringContaining("Cotisations minimales du gérant")])
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 54000, impotSurLeRevenu: 10584, prelevementsSociaux: 1860, optionDividendes: "pfu", netApresImpots: 57556 })
      expect(report.bilan).toMatchObject({ revenusAvantPrelevements: 100000, totalPrelevements: 19586 })
      verifierIdentiteDuBilan(report)
    })

    it("capital faible : dividendes au-delà de 10 % du capital soumis aux cotisations TNS", () => {
      // Sans rémunération : 1 343,24 € de cotisations minimales payées par la société (voir le cas précédent).
      // Bénéfice 38 656,76 € ; IS 5 798,51 € ; 20 000 € distribués ; conservé 12 858,24 €.
      // Capital 1 000 € : seuil 100 € ; 100 € aux prélèvements sociaux (18,60 €), 19 900 € ajoutés au revenu soumis à
      // cotisations : 1 343,24 + 19 900 = 21 243,24 € ; abattement 5 523,24 € ; assiette 15 720 €.
      // Cotisations : maladie 1,5 % x (15 720 - 9 612) / 9 612 = 0,953 %, 149,84 € ; IJ sur l'assiette minimale 19 224 €, 96,12 € ;
      // retraite de base 2 809,16 € ; complémentaire 1 273,32 € ; invalidité-décès 204,36 € ; allocations familiales 0 ;
      // CSG-CRDS 1 524,84 € ; formation 120,15 € ; total 6 177,79 €, dont 6 177,79 - 1 343,24 = 4 834,55 € dus sur les dividendes.
      // Dividendes encaissés : 20 000 - 4 834,55 = 15 165,45 €.
      // Barème : 20 000 x 60 % - 100 x 6,8 % = 11 993,20 € ; impôt brut 393,20 x 11 % = 43,25 €, effacé par la décote.
      // Forfait : 2 560 €. Barème retenu, impôt nul.
      // Net : 15 165,45 - 18,60 = 15 146,85 €.
      // Bilan : 40 000 € = 6 178 + 5 799 + 19 (prélèvements) + 12 858 (conservé) + 15 147 (net), à 1 € d'arrondi près.
      const report = simulerSociete("EURL", [
        ["s1", "ca_services", 50000],
        ["s1", "deductible_expense", 10000],
        ["s1", "dividends_payment", 20000]
      ])

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 6178, impotSocietes: 5799, resultatConserve: 12858, revenuVerse: 15165 })
      expect(activite(report, "s1").cotisationsTNS?.assiette).toBeCloseTo(15720, 2)
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 11993, impotSurLeRevenu: 0, prelevementsSociaux: 19, optionDividendes: "bareme", netApresImpots: 15147 })
      verifierIdentiteDuBilan(report)
    })

    it("rémunération nette de 30 000 €, sans dividendes", () => {
      // Revenu avant cotisations R tel que R - cotisations(R) = 30 000 : R = 43 622,68 €. Vérification :
      // abattement 26 % = 11 341,90 € ; assiette 32 280,78 € (entre 60 % et 110 % du PASS) ;
      // maladie 4 % + 2,5 % x (32 280,78 - 28 836) / 24 030 = 4,358 %, 1 406,92 € ; IJ 0,5 %, 161,40 € ;
      // retraite de base 17,87 %, 5 768,58 € ; complémentaire 8,1 %, 2 614,74 € ; invalidité-décès 1,3 %, 419,65 € ;
      // allocations familiales 0 (sous 110 % du PASS) ; CSG déductible 6,8 %, 2 195,09 € ; CSG non déductible et CRDS 2,9 %,
      // 936,14 € ; formation 120,15 € ; total 13 622,68 €, et 43 622,68 - 13 622,68 = 30 000 €.
      // Société : bénéfice 80 000 - 10 000 - 30 000 - 13 622,68 = 26 377,32 € ; IS 15 % = 3 956,60 € ; conservé 22 420,72 €.
      // Gérant : rémunération imposable 30 000 + 936,14 = 30 936,14 €, moins 10 % (3 093,61 €) : 27 842,53 € ;
      // impôt brut (27 842,53 - 11 600) x 11 % = 1 786,68 €, décote 897 - 808,47 = 88,53 €, impôt 1 698,15 €, soit 1 698 €.
      // Net : 30 000 - 1 698 = 28 302 €.
      // Bilan : 70 000 € = 13 623 + 3 957 + 1 698 (prélèvements, 19 278 €) + 22 421 (conservé) + 28 302 (net), à 1 € près.
      const report = simulerSociete("EURL", [
        ["s1", "ca_services", 80000],
        ["s1", "deductible_expense", 10000],
        ["s1", "director_remuneration", 30000]
      ])

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 13623, impotSocietes: 3957, resultatConserve: 22421, revenuVerse: 30000, warnings: [] })
      expect(activite(report, "s1").cotisationsTNS?.revenuAvantCotisations).toBeCloseTo(43622.68, 2)
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 27843, impotSurLeRevenu: 1698, prelevementsSociaux: 0, netApresImpots: 28302 })
      expect(report.bilan).toMatchObject({ revenusAvantPrelevements: 70000, totalPrelevements: 19278, resultatConserve: 22421 })
      verifierIdentiteDuBilan(report)
    })

    it("rémunération nette de 30 000 € et dividendes au-delà de 10 % du capital", () => {
      // Rémunération : comme le cas précédent, R = 43 622,68 € et 13 622,68 € de cotisations ; IS 3 956,60 € ;
      // 15 000 € distribués sur les 22 420,72 € distribuables ; conservé 7 420,72 €.
      // Capital 1 000 € : 100 € aux prélèvements sociaux (18,60 €), 14 900 € ajoutés au revenu soumis à cotisations :
      // 58 522,68 € ; abattement 15 215,90 € ; assiette 43 306,78 €.
      // Cotisations : maladie 4 % + 2,5 % x (43 306,78 - 28 836) / 24 030 = 5,505 %, 2 384,25 € ; IJ 216,53 € ;
      // retraite de base 7 738,92 € ; complémentaire 3 507,85 € ; invalidité-décès 562,99 € ; allocations familiales 0 ;
      // CSG-CRDS 2 944,86 + 1 255,90 € ; formation 120,15 € ; total 18 731,45 €, dont 18 731,45 - 13 622,68 = 5 108,77 €
      // dus par le gérant sur ses dividendes, qu'il encaisse pour 15 000 - 5 108,77 = 9 891,23 €.
      // Seule la CSG non déductible de la rémunération (936,14 €) s'ajoute à son revenu imposable : 27 842,53 € après 10 %, 1 698 €.
      // Forfait : 1 698 + 15 000 x 12,8 % = 3 618 €. Barème : 27 842,53 + 9 000 - 100 x 6,8 % = 36 835,73 € ;
      // impôt 1 977,69 + 7 256,73 x 30 % = 4 154,71 €. Forfait retenu.
      // Net : 30 000 + 9 891,23 - 3 618 - 18,60 = 36 254,63 €.
      // Bilan : 70 000 € = 18 731 + 3 957 + 3 618 + 19 (prélèvements, 26 325 €) + 7 421 (conservé) + 36 255 (net), à 2 € près.
      const report = simulerSociete("EURL", [
        ["s1", "ca_services", 80000],
        ["s1", "deductible_expense", 10000],
        ["s1", "director_remuneration", 30000],
        ["s1", "dividends_payment", 15000]
      ])

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 18731, impotSocietes: 3957, resultatConserve: 7421, revenuVerse: 39891 })
      expect(activite(report, "s1").cotisationsTNS?.assiette).toBeCloseTo(43306.78, 2)
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 27843, impotSurLeRevenu: 3618, prelevementsSociaux: 19, optionDividendes: "pfu", netApresImpots: 36255 })
      expect(report.bilan).toMatchObject({ revenusAvantPrelevements: 70000, totalPrelevements: 26325 })
      verifierIdentiteDuBilan(report)
    })

    it("rémunération et dividendes, au-delà de 110 % du PASS : allocations familiales et maladie au-delà de 6,5 %", () => {
      // Rémunération nette 40 000 € : R = 58 844,63 €. Vérification : assiette 43 545,03 € ; maladie 4 % + 2,5 % x 14 709,03 / 24 030
      // = 5,530 %, 2 408,16 € ; IJ 217,73 € ; retraite de base 7 781,50 € ; complémentaire 3 527,15 € ; invalidité-décès 566,09 € ;
      // CSG-CRDS 2 961,06 + 1 262,81 € ; formation 120,15 € ; total 18 844,63 €, et 58 844,63 - 18 844,63 = 40 000 €.
      // Bénéfice : 120 000 - 20 000 - 40 000 - 18 844,63 = 41 155,37 € (sous 42 500 €) ; IS 6 173,31 € ;
      // conservé 41 155,37 - 6 173,31 - 15 000 = 19 982,06 €.
      // Capital 10 000 € : seuil 1 000 € ; 14 000 € ajoutés au revenu : 72 844,63 € ; abattement 18 939,60 € ; assiette 53 905,03 €.
      // Maladie 6,5 % + 1,2 % x (53 905,03 - 52 866) / 43 254 = 6,529 %, 3 519,37 € ; IJ 269,53 € ;
      // retraite de base 17,87 % x 48 060 + 0,72 % x 5 845,03 = 8 630,41 € ; complémentaire 8,1 % x 48 060 + 9,1 % x 5 845,03 = 4 424,76 € ;
      // invalidité-décès plafonnée, 624,78 € ; allocations familiales 3,1 % x (53 905,03 - 52 866) / 14 418 = 0,223 %, 120,42 € ;
      // CSG-CRDS 3 665,54 + 1 563,25 € ; formation 120,15 € ; total 22 938,20 €, dont 4 093,56 € sur les dividendes.
      // Dividendes encaissés : 15 000 - 4 093,56 = 10 906,44 €.
      // Rémunération imposable 40 000 + 1 262,81 = 41 262,81 €, moins 10 % : 37 136,53 € ;
      // impôt 1 977,69 + 7 557,53 x 30 % = 4 244,95 €, soit 4 245 €. Forfait : 4 245 + 1 920 = 6 165 €.
      // Barème : 37 136,53 + 9 000 - 68 = 46 068,53 € ; impôt 6 924,55 €. Forfait retenu.
      // Prélèvements sociaux : 1 000 x 18,6 % = 186 €. Net : 40 000 + 10 906,44 - 6 165 - 186 = 44 555,44 €.
      // Bilan : 100 000 € = 22 938 + 6 173 + 6 165 + 186 (prélèvements, 35 462 €) + 19 982 (conservé) + 44 555 (net), à 1 € près.
      const report = simulerSociete(
        "EURL",
        [
          ["s1", "ca_services", 120000],
          ["s1", "deductible_expense", 20000],
          ["s1", "director_remuneration", 40000],
          ["s1", "dividends_payment", 15000]
        ],
        10000
      )

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 22938, impotSocietes: 6173, resultatConserve: 19982, revenuVerse: 50906 })
      expect(activite(report, "s1").cotisationsTNS?.cotisations.allocationsFamiliales).toBeCloseTo(120.42, 2)
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 37137, impotSurLeRevenu: 6165, prelevementsSociaux: 186, optionDividendes: "pfu", netApresImpots: 44555 })
      expect(report.bilan).toMatchObject({ revenusAvantPrelevements: 100000, totalPrelevements: 35462 })
      verifierIdentiteDuBilan(report)
    })
  })

  describe("entreprise individuelle au réel", () => {
    // Le revenu imposable est le bénéfice après cotisations, augmenté de la CSG non déductible et de la CRDS (2,9 % de l'assiette).

    it("bénéfice de 20 000 € avant cotisations : maladie dans la première tranche progressive, IJ sur l'assiette minimale", () => {
      // Assiette 20 000 - 26 % = 14 800 €. Maladie 1,5 % x (14 800 - 9 612) / 9 612 = 0,810 %, 119,82 € ;
      // IJ sur 19 224 €, 96,12 € ; retraite de base 2 644,76 € ; complémentaire 1 198,80 € ; invalidité-décès 192,40 € ;
      // CSG déductible 1 006,40 € ; CSG non déductible et CRDS 429,20 € ; formation 120,15 € ; total 5 807,65 €.
      // Encaissé : 14 192,35 €. Imposable : 14 192,35 + 429,20 = 14 621,55 € ; impôt brut 3 021,55 x 11 % = 332,37 €,
      // effacé par la décote (897 - 150,40 = 746,60 €). Net : 14 192,35 €.
      const report = simulerSociete("EI", [["s1", "ca_services", 20000]])

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 5808, revenuVerse: 14192, warnings: [] })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 14622, impotSurLeRevenu: 0, netApresImpots: 14192 })
      verifierIdentiteDuBilan(report)
    })

    it("bénéfice de 50 000 € avant cotisations", () => {
      // Assiette 37 000 €. Maladie 4 % + 2,5 % x (37 000 - 28 836) / 24 030 = 4,849 %, 1 794,26 € ; IJ 185 € ;
      // retraite de base 6 611,90 € ; complémentaire 2 997 € ; invalidité-décès 481 € ; allocations familiales 0 ;
      // CSG déductible 2 516 € ; CSG non déductible et CRDS 1 073 € ; formation 120,15 € ; total 15 778,31 €.
      // Encaissé : 34 221,69 €. Imposable : 35 294,69 € ; impôt 1 977,69 + 5 715,69 x 30 % = 3 692,40 €, soit 3 692 €.
      // Net : 34 221,69 - 3 692 = 30 529,69 €.
      const report = simulerSociete("EI", [
        ["s1", "ca_services", 60000],
        ["s1", "deductible_expense", 10000]
      ])

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 15778, impotSocietes: 0, revenuVerse: 34222, resultatConserve: 0 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 35295, impotSurLeRevenu: 3692, netApresImpots: 30530 })
      verifierIdentiteDuBilan(report)
    })

    it("bénéfice de 60 000 € avant cotisations", () => {
      // Assiette 44 400 €. Maladie 4 % + 2,5 % x 15 564 / 24 030 = 5,619 %, 2 494,94 € ; IJ 222 € ; retraite de base 7 934,28 € ;
      // complémentaire 3 596,40 € ; invalidité-décès 577,20 € ; CSG-CRDS 3 019,20 + 1 287,60 € ; formation 120,15 € ;
      // total 19 251,77 €. Encaissé : 40 748,23 €. Imposable : 42 035,83 € ;
      // impôt 1 977,69 + 12 456,83 x 30 % = 5 714,74 €, soit 5 715 €. Net : 40 748,23 - 5 715 = 35 033,23 €.
      const report = simulerSociete("EI", [
        ["s1", "ca_services", 80000],
        ["s1", "deductible_expense", 20000]
      ])

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 19252, impotSocietes: 0, revenuVerse: 40748, resultatConserve: 0 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 42036, impotSurLeRevenu: 5715, netApresImpots: 35033 })
      verifierIdentiteDuBilan(report)
    })

    it("bénéfice de 120 000 € avant cotisations : tranches au-delà du PASS et allocations familiales à taux plein", () => {
      // Assiette 88 800 €. Maladie 6,5 % + 1,2 % x (88 800 - 52 866) / 43 254 = 7,497 %, 6 657,27 € ; IJ 444 € ;
      // retraite de base 17,87 % x 48 060 + 0,72 % x 40 740 = 8 881,65 € ; complémentaire 8,1 % x 48 060 + 9,1 % x 40 740 = 7 600,20 € ;
      // invalidité-décès 1,3 % x 48 060 = 624,78 € ; allocations familiales 3,1 % (au-delà de 140 % du PASS), 2 752,80 € ;
      // CSG-CRDS 6 038,40 + 2 575,20 € ; formation 120,15 € ; total 35 694,45 €.
      // Encaissé : 84 305,55 €. Imposable : 86 880,75 € ; impôt 18 477,09 + 2 303,75 x 41 % = 19 421,63 €, soit 19 422 €.
      // Net : 84 305,55 - 19 422 = 64 883,55 €.
      const report = simulerSociete("EI", [
        ["s1", "ca_services", 150000],
        ["s1", "deductible_expense", 30000]
      ])

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 35694, revenuVerse: 84306 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 86881, impotSurLeRevenu: 19422, netApresImpots: 64884 })
      verifierIdentiteDuBilan(report)
    })

    it("déficit seul : cotisations minimales, pas d'impôt, et deux avertissements", () => {
      // Résultat : 20 000 - 30 000 = - 10 000 € ; assiette nulle. Cotisations minimales : 0,5 % x 19 224 = 96,12 € (IJ),
      // 17,87 % x 5 409 = 966,59 € (retraite de base), 1,3 % x 5 527 = 71,85 € (invalidité-décès), 120,15 € (formation),
      // soit 1 254,71 €, même sans revenu. Déficit après cotisations : - 11 254,71 €.
      const report = simulerSociete("EI", [
        ["s1", "ca_services", 20000],
        ["s1", "deductible_expense", 30000]
      ])
      const resultat = activite(report, "s1")

      expect(resultat).toMatchObject({ cotisationsSociales: 1255, revenuVerse: -11255 })
      expect(resultat.warnings).toHaveLength(2)
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 0, impotSurLeRevenu: 0, netApresImpots: -11255 })
      verifierIdentiteDuBilan(report)
    })

    // Un déficit professionnel (BIC ou BNC au réel) s'impute sur le revenu global de l'année (article 156 du CGI).
    // Ce cas a révélé une erreur du moteur, qui ramenait le déficit à zéro avant le calcul de l'impôt.
    it("déficit et salaire : le déficit s'impute sur le revenu global", () => {
      // Salaire 50 000 € : 45 000 € après déduction de 10 %. Déficit de 10 000 €, plus 1 254,71 € de cotisations minimales :
      // - 11 254,71 €. Revenu global : 45 000 - 11 254,71 = 33 745,29 €.
      // Impôt : 1 977,69 + (33 745,29 - 29 579) x 30 % = 1 977,69 + 1 249,89 = 3 227,58 €, arrondi à 3 228 €.
      // Net : 50 000 - 11 254,71 - 3 228 = 35 517,29 €.
      const report = simulerSociete(
        "EI",
        [
          ["s1", "ca_services", 20000],
          ["s1", "deductible_expense", 30000]
        ],
        1000,
        [["alice", "salary", 50000]]
      )

      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 33745, impotSurLeRevenu: 3228, netApresImpots: 35517 })
    })
  })
})
