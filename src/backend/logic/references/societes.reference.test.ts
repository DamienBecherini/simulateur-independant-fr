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
 * - EURL : la part des dividendes du gérant qui dépasse 10 % du capital supporte les cotisations TNS ;
 * - déduction de 10 % sur les rémunérations (minimum 509 €, maximum 14 555 €) ;
 * - barème 2026 pour une part : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 €, 30 % jusqu'à 84 577 €, 41 % jusqu'à
 *   181 917 €, 45 % au-delà ; impôt cumulé à 29 579 € : 1 977,69 €, à 84 577 € : 1 977,69 + 54 998 x 30 % = 18 477,09 € ;
 * - décote d'un célibataire : 897 € - 45,25 % de l'impôt brut, si elle est positive.
 *
 * Approximations assumées du modèle, appliquées telles quelles : cotisations du président de SASU égales à
 * 80 % de sa rémunération nette (coût total = 1,8 x net), cotisations TNS égales à 45 % du revenu net,
 * rémunération nette saisie traitée comme le salaire imposable.
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
      // Capital 100 000 € : seuil 10 000 €. Bénéfice 40 000 € ; IS 6 000 € ; 10 000 € distribués ; conservé 24 000 €.
      // Aucune cotisation : pas de rémunération, et les dividendes ne dépassent pas le seuil.
      // Salaire 60 000 € : revenu imposable 54 000 € ; impôt 1 977,69 + 24 421 x 30 % = 9 303,99 €.
      // Forfait : 9 303,99 + 1 280 = 10 583,99 €.
      // Barème : 54 000 + 6 000 - 680 = 59 320 € ; impôt 1 977,69 + 29 741 x 30 % = 10 899,99 €. Forfait retenu.
      // Prélèvements sociaux : 10 000 x 18,6 % = 1 860 €. Net : 60 000 + 10 000 - 10 583,99 - 1 860 = 57 556,01 €.
      // Bilan : 100 000 € = 6 000 + 10 584 + 1 860 (prélèvements) + 24 000 (conservé) + 57 556 (net).
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

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 0, impotSocietes: 6000, resultatConserve: 24000, revenuVerse: 10000 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 54000, impotSurLeRevenu: 10584, prelevementsSociaux: 1860, optionDividendes: "pfu", netApresImpots: 57556 })
      expect(report.bilan).toMatchObject({ revenusAvantPrelevements: 100000, totalPrelevements: 18444 })
      verifierIdentiteDuBilan(report)
    })

    it("capital faible : dividendes au-delà de 10 % du capital soumis aux cotisations TNS", () => {
      // Capital 1 000 € : seuil 100 €. Bénéfice 40 000 € ; IS 6 000 € ; 20 000 € distribués ; conservé 14 000 €.
      // 100 € aux prélèvements sociaux (18,60 €) ; 19 900 € aux cotisations TNS : 19 900 x 45 % = 8 955 €.
      // Dividendes encaissés : 20 000 - 8 955 = 11 045 €.
      // Barème : 20 000 x 60 % - 100 x 6,8 % = 11 993,20 € ; impôt brut 393,20 x 11 % = 43,25 €, effacé par la décote.
      // Forfait : 2 560 €. Barème retenu, impôt nul.
      // Net : 11 045 - 18,60 = 11 026,40 €.
      // Bilan : 40 000 € = 8 955 + 6 000 + 19 (prélèvements) + 14 000 (conservé) + 11 026 (net).
      const report = simulerSociete("EURL", [
        ["s1", "ca_services", 50000],
        ["s1", "deductible_expense", 10000],
        ["s1", "dividends_payment", 20000]
      ])

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 8955, impotSocietes: 6000, resultatConserve: 14000, revenuVerse: 11045 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 11993, impotSurLeRevenu: 0, prelevementsSociaux: 19, optionDividendes: "bareme", netApresImpots: 11026 })
      verifierIdentiteDuBilan(report)
    })

    it("rémunération et dividendes", () => {
      // Cotisations sur la rémunération : 40 000 x 45 % = 18 000 €.
      // Bénéfice : 120 000 - 20 000 - 40 000 - 18 000 = 42 000 € (sous 42 500 €) ; IS 6 300 € ; conservé 42 000 - 6 300 - 15 000 = 20 700 €.
      // Capital 10 000 € : seuil 1 000 €. Cotisations sur dividendes : 14 000 x 45 % = 6 300 € ; total 24 300 €.
      // Dividendes encaissés : 15 000 - 6 300 = 8 700 €.
      // Revenu au barème : 40 000 - 4 000 = 36 000 € ; impôt 3 903,99 €. Forfait : 3 903,99 + 1 920 = 5 823,99 €.
      // Barème : 36 000 + 9 000 - 68 = 44 932 € ; impôt 1 977,69 + 15 353 x 30 % = 6 583,59 €. Forfait retenu.
      // Prélèvements sociaux : 1 000 x 18,6 % = 186 €. Net : 40 000 + 8 700 - 5 823,99 - 186 = 42 690,01 €.
      // Bilan : 100 000 € = 24 300 + 6 300 + 5 824 + 186 (prélèvements) + 20 700 (conservé) + 42 690 (net).
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

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 24300, impotSocietes: 6300, resultatConserve: 20700, revenuVerse: 48700 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 36000, impotSurLeRevenu: 5824, prelevementsSociaux: 186, optionDividendes: "pfu", netApresImpots: 42690 })
      expect(report.bilan).toMatchObject({ revenusAvantPrelevements: 100000, totalPrelevements: 36610 })
      verifierIdentiteDuBilan(report)
    })
  })

  describe("entreprise individuelle au réel", () => {
    it("bénéfice positif", () => {
      // Bénéfice avant cotisations : 80 000 - 20 000 = 60 000 € = revenu net x 1,45.
      // Revenu net : 60 000 / 1,45 = 41 379,31 € ; cotisations 18 620,69 €.
      // Impôt : 1 977,69 + (41 379,31 - 29 579) x 30 % = 1 977,69 + 3 540,09 = 5 517,78 €.
      // Net : 41 379,31 - 5 518 (impôt arrondi à l'euro, article 1657 du CGI) = 35 861,31 €.
      const report = simulerSociete("EI", [
        ["s1", "ca_services", 80000],
        ["s1", "deductible_expense", 20000]
      ])

      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 18621, impotSocietes: 0, revenuVerse: 41379, resultatConserve: 0 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 41379, impotSurLeRevenu: 5518, netApresImpots: 35861 })
      verifierIdentiteDuBilan(report)
    })

    it("déficit seul : ni cotisations ni impôt, avec un avertissement", () => {
      // Résultat : 20 000 - 30 000 = - 10 000 €. Le modèle n'applique pas de cotisations minimales.
      const report = simulerSociete("EI", [
        ["s1", "ca_services", 20000],
        ["s1", "deductible_expense", 30000]
      ])
      const resultat = activite(report, "s1")

      expect(resultat).toMatchObject({ cotisationsSociales: 0, revenuVerse: -10000 })
      expect(resultat.warnings).toHaveLength(1)
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 0, impotSurLeRevenu: 0, netApresImpots: -10000 })
      verifierIdentiteDuBilan(report)
    })

    // Un déficit professionnel (BIC ou BNC au réel) s'impute sur le revenu global de l'année (article 156 du CGI).
    // Ce cas a révélé une erreur du moteur, qui ramenait le déficit à zéro avant le calcul de l'impôt.
    it("déficit et salaire : le déficit s'impute sur le revenu global", () => {
      // Salaire 50 000 € : 45 000 € après déduction de 10 %. Déficit de 10 000 € : revenu global 35 000 €.
      // Impôt : 1 977,69 + 5 421 x 30 % = 3 603,99 € (le moteur, sans imputation : 6 603,99 € sur 45 000 €).
      // Net : 50 000 - 10 000 - 3 603,99 = 36 396,01 €.
      const report = simulerSociete(
        "EI",
        [
          ["s1", "ca_services", 20000],
          ["s1", "deductible_expense", 30000]
        ],
        1000,
        [["alice", "salary", 50000]]
      )

      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 35000, impotSurLeRevenu: 3604, netApresImpots: 36396 })
    })
  })
})
