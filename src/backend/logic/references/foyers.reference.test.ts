// src/backend/logic/references/foyers.reference.test.ts

import { describe, expect, it } from "vitest"
import { activite, casDeReference, foyerDe, simuler, verifierIdentiteDuBilan } from "../testing/cas-de-reference.js"
import { micro, personne, relation, societe, type Flux } from "../testing/session-de-test.js"
import type { Relationship } from "../../../types.js"

/*
 * Cas de référence 2026 : salaires, foyers fiscaux et cumul d'activités.
 *
 * Démarche : le moteur tourne avec les règles réelles de config.json, et chaque attendu est dérivé à la main
 * à partir des règles officielles 2026, sans lancer le moteur. En cas d'écart, c'est le moteur qui est suspect.
 *
 * Règles officielles utilisées :
 * - déduction de 10 % sur les salaires, allocations chômage et rémunérations de dirigeant, par personne,
 *   au minimum 509 € (sans dépasser le revenu) et au maximum 14 555 € ;
 * - barème 2026 pour une part : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 €, 30 % jusqu'à 84 577 €, 41 % jusqu'à
 *   181 917 €, 45 % au-delà ; impôt cumulé : 1 977,69 € à 29 579 €, 18 477,09 € à 84 577 €, 58 386,49 € à 181 917 € ;
 * - quotient familial : une part par déclarant, une demi-part pour chacun des deux premiers enfants, une part
 *   entière à partir du troisième ; l'avantage procuré par les parts des enfants est plafonné à 1 807 € par demi-part ;
 * - décote : 897 € (célibataire) ou 1 483 € (couple) - 45,25 % de l'impôt brut, si elle est positive ;
 * - seuls le mariage et le PACS créent une imposition commune ; en union libre, chacun déclare ses revenus ;
 * - versement libératoire : RFR au plus égal à 29 315 € par part du foyer.
 *
 * Recoupement possible sur le simulateur officiel (impots.gouv.fr, « simulateur de l'impôt 2026 sur les revenus
 * 2025 », modèle simplifié) pour les cas marqués « recoupable » : choisir la situation de famille et le nombre
 * d'enfants, saisir le salaire net imposable de chaque déclarant dans les cases 1AJ et 1BJ (sans frais réels),
 * et comparer l'impôt sur le revenu net affiché ; un écart de 1 € peut venir de l'arrondi de la décote.
 */

const alice = personne("alice")
const bob = personne("bob")

/** Couple dont les deux membres sont salariés, avec des enfants reliés aux deux parents. */
function famille(lien: Relationship["type"], salaires: [number, number], nombreEnfants: number) {
  const enfants = Array.from({ length: nombreEnfants }, (_, i) => personne(`enfant${i + 1}`))
  const relations = [relation("alice", "bob", lien), ...enfants.flatMap(e => [relation("alice", e.id, "Enfant"), relation("bob", e.id, "Enfant")])]
  const flux: Flux[] = [
    ["alice", "salary", salaires[0]],
    ["bob", "salary", salaires[1]]
  ]
  return simuler([alice, bob, ...enfants], relations, flux)
}

casDeReference("Cas de référence 2026 : salaires et foyers", () => {
  describe("salaires d'une personne seule", () => {
    it("salaire de 30 000 € (recoupable)", () => {
      // Revenu imposable : 30 000 - 3 000 = 27 000 €. Impôt brut : 15 400 x 11 % = 1 694 €.
      // Décote : 897 - 45,25 % x 1 694 = 130,47 € ; impôt 1 563,53 €, soit 1 564 €. Net : 30 000 - 1 564 = 28 436 €.
      const report = simuler([alice], [], [["alice", "salary", 30000]])

      expect(foyerDe(report, "alice")).toMatchObject({ totalParts: 1, revenuImposableGlobal: 27000, impotSurLeRevenu: 1564, netApresImpots: 28436 })
      verifierIdentiteDuBilan(report)
    })

    it("allocations chômage et salaire : une seule déduction de 10 % sur leur total", () => {
      // 20 000 € de salaire + 10 000 € d'allocations = 30 000 € ; même calcul que le salaire de 30 000 €.
      const report = simuler(
        [alice],
        [],
        [
          ["alice", "salary", 20000],
          ["alice", "are", 10000]
        ]
      )

      expect(report.persons[0]).toMatchObject({ revenusDirects: 30000, detail: { salaires: 20000, allocationsChomage: 10000 } })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 27000, impotSurLeRevenu: 1564, netApresImpots: 28436 })
    })

    it("déduction minimum de 509 €", () => {
      // 4 000 x 10 % = 400 € < 509 € : revenu imposable 4 000 - 509 = 3 491 €.
      const report = simuler([alice], [], [["alice", "salary", 4000]])

      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 3491, impotSurLeRevenu: 0, netApresImpots: 4000 })
    })

    it("déduction minimum limitée au montant du salaire", () => {
      // 300 € de salaire : la déduction de 509 € ne peut pas dépasser 300 €, revenu imposable nul.
      const report = simuler([alice], [], [["alice", "salary", 300]])

      expect(foyerDe(report, "alice").revenuImposableGlobal).toBe(0)
    })

    it("déduction maximum de 14 555 € et tranche à 45 %", () => {
      // 200 000 x 10 % = 20 000 € > 14 555 € : revenu imposable 185 445 €.
      // Impôt : 58 386,49 + (185 445 - 181 917) x 45 % = 58 386,49 + 1 587,60 = 59 974,09 €.
      // Net : 200 000 - 59 974 = 140 026 €.
      const report = simuler([alice], [], [["alice", "salary", 200000]])

      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 185445, impotSurLeRevenu: 59974, netApresImpots: 140026 })
    })

    it("la décote réduit l'impôt d'un revenu modeste", () => {
      // Revenu imposable : 20 000 - 2 000 = 18 000 €. Impôt brut : 6 400 x 11 % = 704 €.
      // Décote : 897 - 45,25 % x 704 = 578,44 € ; impôt 125,56 €, soit 126 €. Net : 19 874 €.
      const report = simuler([alice], [], [["alice", "salary", 20000]])

      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 18000, impotSurLeRevenu: 126, netApresImpots: 19874 })
    })

    it("revenu imposable dans la tranche à 41 %", () => {
      // Revenu imposable : 110 000 - 11 000 = 99 000 €.
      // Impôt : 18 477,09 + (99 000 - 84 577) x 41 % = 18 477,09 + 5 913,43 = 24 390,52 €, soit 24 391 €.
      // Net : 110 000 - 24 391 = 85 609 €.
      const report = simuler([alice], [], [["alice", "salary", 110000]])

      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 99000, impotSurLeRevenu: 24391, netApresImpots: 85609 })
    })
  })

  describe("couple avec un enfant : 40 000 € et 20 000 € de salaires", () => {
    // Imposition commune : 36 000 + 18 000 = 54 000 € pour 2,5 parts, soit 21 600 € par part.
    // Impôt : 2,5 x (21 600 - 11 600) x 11 % = 2,5 x 1 100 = 2 750 €.
    // Plafonnement : sans l'enfant, 2 x (27 000 - 11 600) x 11 % = 3 388 € ; avantage 638 € <= 1 807 €, pas de plafonnement.
    // Décote couple : 1 483 - 45,25 % x 2 750 = 238,63 € ; impôt 2 511,38 €, soit 2 511 €.
    // Net : 60 000 - 2 511 = 57 489 €.
    it.each<Relationship["type"]>(["Marié(e)", "PACSé(e)"])("%s : un seul foyer de 2,5 parts (recoupable)", lien => {
      const report = famille(lien, [40000, 20000], 1)

      expect(report.foyers).toHaveLength(1)
      expect(foyerDe(report, "enfant1")).toMatchObject({ totalParts: 2.5, revenuImposableGlobal: 54000, impotSurLeRevenu: 2511, netApresImpots: 57489 })
      verifierIdentiteDuBilan(report)
    })

    it("en couple (union libre) : deux foyers, l'enfant rattaché à un parent dont l'avantage est plafonné", () => {
      // Alice déclare l'enfant : 36 000 € pour 1,5 part. Parent vivant en couple : pas de majoration pour parent isolé.
      // Avec l'enfant : 1,5 x (24 000 - 11 600) x 11 % = 2 046 €. Sans : 1 977,69 + 6 421 x 30 % = 3 903,99 €.
      // Avantage 1 857,99 € > 1 807 € : impôt 3 903,99 - 1 807 = 2 096,99 €, soit 2 097 € (décote nulle).
      // Bob, 1 part : 18 000 € ; impôt 126 € (voir le cas de la décote). Total : 2 223 €, contre 2 511 € mariés.
      // Nets : 40 000 - 2 097 = 37 903 € et 20 000 - 126 = 19 874 €, soit 57 777 €.
      const report = simuler(
        [alice, bob, personne("enfant1")],
        [relation("alice", "bob", "En couple"), relation("alice", "enfant1", "Enfant")],
        [
          ["alice", "salary", 40000],
          ["bob", "salary", 20000]
        ]
      )

      expect(report.foyers).toHaveLength(2)
      expect(foyerDe(report, "alice")).toMatchObject({ personIds: ["alice", "enfant1"], totalParts: 1.5, revenuImposableGlobal: 36000, impotSurLeRevenu: 2097, netApresImpots: 37903 })
      expect(foyerDe(report, "bob")).toMatchObject({ totalParts: 1, revenuImposableGlobal: 18000, impotSurLeRevenu: 126, netApresImpots: 19874 })
      expect(report.totalNetApresImpots).toBe(57777)
      verifierIdentiteDuBilan(report)
    })
  })

  describe("couple marié avec trois enfants", () => {
    it("le troisième enfant apporte une part entière", () => {
      // Revenu : 45 000 + 36 000 = 81 000 € ; parts : 2 + 0,5 + 0,5 + 1 = 4, soit 20 250 € par part.
      // Impôt : 4 x (20 250 - 11 600) x 11 % = 4 x 951,50 = 3 806 €.
      // Plafonnement : sans les enfants, 2 x (1 977,69 + 10 921 x 30 %) = 2 x 5 253,99 = 10 507,98 € ;
      // avantage 6 701,98 € <= 4 demi-parts x 1 807 = 7 228 €, pas de plafonnement. Décote nulle (1 483 - 1 722,22 < 0).
      // Net : 90 000 - 3 806 = 86 194 €.
      const report = famille("Marié(e)", [50000, 40000], 3)

      expect(foyerDe(report, "alice")).toMatchObject({ totalParts: 4, revenuImposableGlobal: 81000, impotSurLeRevenu: 3806, netApresImpots: 86194 })
    })

    it("plafonnement du quotient familial", () => {
      // Revenu : 72 000 + 54 000 = 126 000 € pour 4 parts, soit 31 500 € par part.
      // Avec les enfants : 4 x (1 977,69 + 1 921 x 30 %) = 4 x 2 553,99 = 10 215,96 €.
      // Sans : 2 x (1 977,69 + 33 421 x 30 %) = 2 x 12 003,99 = 24 007,98 €.
      // Avantage 13 792,02 € > 7 228 € : impôt 24 007,98 - 7 228 = 16 779,98 €, soit 16 780 €.
      // Net : 140 000 - 16 780 = 123 220 €.
      const report = famille("Marié(e)", [80000, 60000], 3)

      expect(foyerDe(report, "alice")).toMatchObject({ totalParts: 4, revenuImposableGlobal: 126000, impotSurLeRevenu: 16780, netApresImpots: 123220 })
      verifierIdentiteDuBilan(report)
    })
  })

  describe("versement libératoire : le seuil de RFR dépend du nombre de parts", () => {
    // Micro BNC de 40 000 € avec option pour le versement libératoire, RFR 2024 du foyer : 60 000 €.
    const microVFL = { ...micro("m1", { opteVFL: true }), rfrN2: 60000 }
    const flux: Flux[] = [["m1", "ca_micro_services_bnc", 40000]]

    it("seule (1 part) : seuil de 29 315 € dépassé, impôt au barème", () => {
      // Barème : 26 400 € imposables, impôt 1 467,67 €, soit 1 468 €. Cotisations 10 240 €, plus 80 € de formation
      // professionnelle (0,2 %). Net : 40 000 - 10 320 - 1 468 = 28 212 €.
      const report = simuler([alice, microVFL], [relation("alice", "m1", "Titulaire")], flux)

      expect(activite(report, "m1").versementLiberatoire).toMatchObject({ partsFiscales: 1, plafondRfr: 29315, eligible: false, applique: false })
      expect(foyerDe(report, "alice")).toMatchObject({ impotSurLeRevenu: 1468, netApresImpots: 28212 })
    })

    it("mariée avec un enfant (2,5 parts) : seuil de 73 287,50 €, versement libératoire appliqué", () => {
      // Seuil : 29 315 x 2,5 = 73 287,50 € (affiché arrondi à 73 288 €) >= 60 000 € : éligible.
      // Impôt : 40 000 x 2,2 % = 880 €, rien au barème. Net : 40 000 - 10 320 - 880 = 28 800 €.
      const report = simuler(
        [alice, bob, personne("enfant1"), microVFL],
        [relation("alice", "bob", "Marié(e)"), relation("alice", "enfant1", "Enfant"), relation("bob", "enfant1", "Enfant"), relation("alice", "m1", "Titulaire")],
        flux
      )

      expect(activite(report, "m1").versementLiberatoire).toMatchObject({ partsFiscales: 2.5, plafondRfr: 73288, eligible: true, applique: true })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 0, impotSurLeRevenu: 880, netApresImpots: 28800 })
    })
  })

  describe("cumul d'activités d'une personne", () => {
    it("salaire, micro-entreprise et EURL", () => {
      // Micro BIC 20 000 € : cotisations 4 240 €, plus 60 € de formation professionnelle (0,3 %) : 4 300 € ; revenu
      // imposable 10 000 €, encaissé 15 700 €.
      // EURL (capital 5 000 €, seuil 500 €), cotisations TNS selon le barème détaillé dans societes.reference.test.ts :
      //   rémunération nette 20 000 € : revenu avant cotisations 28 412,04 €, 8 412,04 € de cotisations, dont 609,72 € de
      //   CSG non déductible et de CRDS (voir comparateur.reference.test.ts) ;
      //   bénéfice 80 000 - 10 000 - 20 000 - 8 412,04 = 41 587,96 € ; IS 6 238,19 € ; 10 000 € distribués ; conservé 25 349,77 €.
      //   9 500 € de dividendes s'ajoutent au revenu soumis à cotisations : 37 912,04 € ; assiette 28 054,91 € ;
      //   maladie 1,5 % + 2,5 % x (28 054,91 - 19 224) / 9 612 = 3,797 %, 1 065,20 € ; IJ 140,27 € ; retraite de base 5 013,41 € ;
      //   complémentaire 2 272,45 € ; invalidité-décès 364,71 € ; CSG-CRDS 1 907,73 + 813,59 € ; formation 120,15 € ;
      //   total 11 697,53 €, dont 3 285,49 € sur les dividendes ; dividendes encaissés 6 714,51 €.
      // Salaire 30 000 € et rémunération imposable 20 609,72 € : une seule déduction de 10 % sur 50 609,72 €, soit 45 548,75 €.
      // Revenu au barème : 45 548,75 + 10 000 = 55 548,75 € ; impôt 1 977,69 + 25 969,75 x 30 % = 9 768,62 €, soit 9 769 €.
      // Forfait : 9 769 + 1 280 = 11 049 €. Barème : 55 548,75 + 6 000 - 34 = 61 514,75 €, impôt 11 558,42 €. Forfait retenu.
      // Prélèvements sociaux : 500 x 18,6 % = 93 €.
      // Net : 30 000 + 20 000 + 6 714,51 + 15 700 - 11 049 - 93 = 61 272,51 €.
      // Bilan : 120 000 € = 4 300 + 11 698 + 6 238 + 11 049 + 93 (prélèvements, 33 378 €) + 25 350 (conservé) + 61 273 (net), à 1 € près.
      const report = simuler(
        [alice, micro("m1"), societe("s1", "EURL", 5000)],
        [relation("alice", "m1", "Titulaire"), relation("alice", "s1", "Gérant")],
        [
          ["alice", "salary", 30000],
          ["m1", "ca_micro_services_bic", 20000],
          ["s1", "ca_services", 80000],
          ["s1", "deductible_expense", 10000],
          ["s1", "director_remuneration", 20000],
          ["s1", "dividends_payment", 10000]
        ]
      )

      expect(activite(report, "m1")).toMatchObject({ cotisationsSociales: 4300, revenuVerse: 15700 })
      expect(activite(report, "s1")).toMatchObject({ cotisationsSociales: 11698, impotSocietes: 6238, resultatConserve: 25350, revenuVerse: 26715 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 55549, impotSurLeRevenu: 11049, prelevementsSociaux: 93, optionDividendes: "pfu", netApresImpots: 61273 })
      expect(report.bilan).toMatchObject({ revenusAvantPrelevements: 120000, totalPrelevements: 33378, resultatConserve: 25350 })
      verifierIdentiteDuBilan(report)
    })
  })
})
