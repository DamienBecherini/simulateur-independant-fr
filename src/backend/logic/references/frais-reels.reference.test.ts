// src/backend/logic/references/frais-reels.reference.test.ts

import { describe, expect, it } from "vitest"
import type { ComparaisonOptions, FraisReels, Person, StatutCompare, Trajet } from "../../../types.js"
import { comparerStatuts } from "../comparateur.js"
import { montantBaremeKilometrique } from "../frais-kilometriques.js"
import { reglesEnVigueur } from "../regles.js"
import { casDeReference, foyerDe, simuler, verifierIdentiteDuBilan } from "../testing/cas-de-reference.js"
import { micro, personne, relation, session, type Flux } from "../testing/session-de-test.js"

/*
 * Cas de référence 2026 : frais réels d'un salarié, au barème kilométrique.
 *
 * Démarche : le moteur tourne avec les règles réelles de config.json, et chaque attendu est dérivé à la main.
 * Barème kilométrique des revenus de 2025, repris pour 2026 (service-public.gouv.fr, actualité A14686), 5 CV :
 * de 5 001 à 20 000 km, d x 0,357 + 1 395 €. Déduction de 10 % : au moins 509 €, au plus 14 555 €.
 * Barème de l'impôt (loi de finances pour 2026) : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 € ; décote d'une personne
 * seule : 897 € - 45,25 % de l'impôt.
 *
 * Trajets : 20 km par aller simple, 218 jours travaillés, un aller-retour par jour : 20 x 2 x 218 = 8 720 km.
 * Montant : 8 720 x 0,357 + 1 395 = 3 113,04 + 1 395 = 4 508,04 €.
 */

const trajet: Trajet = { libelle: "", kmParTrajet: 20, joursTravailles: 218, puissanceFiscale: "5", electrique: false, distanceJustifiee: false }
const trajets: FraisReels = { trajets: [trajet], autresFrais: 0 }

const salarie = (frais?: FraisReels): Person => ({ ...personne("alice"), ...(frais ? { fraisReels: frais } : {}) })

casDeReference("Cas de référence 2026 : frais réels d'un salarié", () => {
  it("20 km par trajet, 218 jours, 5 CV : 8 720 km, 4 508,04 €", () => {
    expect(montantBaremeKilometrique(8720, trajet, reglesEnVigueur.baremeKilometrique)).toBeCloseTo(4508.04, 6)
    // Électrique : 4 508,04 x 1,2 = 5 409,648 €.
    expect(montantBaremeKilometrique(8720, { ...trajet, electrique: true }, reglesEnVigueur.baremeKilometrique)).toBeCloseTo(5409.648, 6)
  })

  it("30 000 € nets de salaire, personne seule : les frais réels (4 508 €) battent la déduction de 10 % (3 000 €)", () => {
    // Frais réels : imposable 30 000 - 4 508,04 = 25 491,96 € ; impôt (25 491,96 - 11 600) x 11 % = 1 528,12 € ;
    // décote 897 - 45,25 % x 1 528,12 = 205,53 € ; impôt 1 322,59 €, arrondi à 1 323 €.
    const report = simuler([salarie(trajets)], [], [["alice", "salary", 30000]])
    expect(report.persons[0].fraisProfessionnels).toEqual({ revenusSalariaux: 30000, deductionForfaitaire: 3000, fraisReels: 4508, fraisDeTrajet: 4508, distanceRetenue: 8720, retenue: "reels", deduction: 4508 })
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 25492, impotSurLeRevenu: 1323, netApresImpots: 30000 - 1323 })
    verifierIdentiteDuBilan(report)
  })

  it("le même salarié avec la déduction de 10 % : 27 000 € imposables, 1 564 € d'impôt, 241 € de plus", () => {
    // Impôt (27 000 - 11 600) x 11 % = 1 694 € ; décote 897 - 45,25 % x 1 694 = 130,47 € ; impôt 1 563,54 €, arrondi à 1 564 €.
    const report = simuler([salarie()], [], [["alice", "salary", 30000]])
    expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 27000, impotSurLeRevenu: 1564 })
  })

  describe("deux employeurs, deux trajets", () => {
    // Employeur A : 20 km par aller simple, 130 jours, soit 20 x 2 x 130 = 5 200 km ; 18 000 € nets.
    // Employeur B : 15 km par aller simple, 88 jours, soit 15 x 2 x 88 = 2 640 km ; 12 000 € nets.
    const employeurA: Trajet = { ...trajet, libelle: "Employeur A", kmParTrajet: 20, joursTravailles: 130 }
    const employeurB: Trajet = { ...trajet, libelle: "Employeur B", kmParTrajet: 15, joursTravailles: 88 }
    const salaires: Flux[] = [
      ["alice", "salary", 18000],
      ["alice", "salary", 12000]
    ]

    it("avec la même voiture de 5 CV : 7 840 km au barème une seule fois, 4 193,88 €", () => {
      // 7 840 km, deuxième tranche : 7 840 x 0,357 + 1 395 = 2 798,88 + 1 395 = 4 193,88 €. Le barème appliqué à chaque
      // trajet séparément donnerait 5 200 x 0,357 + 1 395 = 3 251,40 € et 2 640 x 0,636 = 1 679,04 €, soit 4 930,44 € :
      // c'est la distance de l'année avec la voiture qui choisit la tranche.
      // Imposable 30 000 - 4 193,88 = 25 806,12 € ; impôt (25 806,12 - 11 600) x 11 % = 1 562,67 € ;
      // décote 897 - 45,25 % x 1 562,67 = 189,89 € ; impôt 1 372,78 €, arrondi à 1 373 €.
      const report = simuler([salarie({ trajets: [employeurA, employeurB], autresFrais: 0 })], [], salaires)

      expect(report.persons[0].fraisProfessionnels).toEqual({ revenusSalariaux: 30000, deductionForfaitaire: 3000, fraisReels: 4194, fraisDeTrajet: 4194, distanceRetenue: 7840, retenue: "reels", deduction: 4194 })
      expect(foyerDe(report, "alice")).toMatchObject({ revenuImposableGlobal: 25806, impotSurLeRevenu: 1373 })
      verifierIdentiteDuBilan(report)
    })

    it("avec deux voitures, de 5 CV et de 3 CV : le barème de chacune, 4 647,96 €", () => {
      // 5 200 km en 5 CV : 5 200 x 0,357 + 1 395 = 3 251,40 € ; 2 640 km en 3 CV : 2 640 x 0,529 = 1 396,56 €.
      const report = simuler([salarie({ trajets: [employeurA, { ...employeurB, puissanceFiscale: "3" }], autresFrais: 0 })], [], salaires)

      expect(report.persons[0].fraisProfessionnels).toMatchObject({ fraisReels: 4648, fraisDeTrajet: 4648, distanceRetenue: 7840, retenue: "reels" })
    })

    it("un trajet de 55 km non justifié, limité à 40 km, et un de 50 km justifié, retenu entier : 6 393 €", () => {
      // 40 x 2 x 100 = 8 000 km, et 50 x 2 x 60 = 6 000 km, avec la même voiture de 5 CV : 14 000 km.
      // 14 000 x 0,357 + 1 395 = 4 998 + 1 395 = 6 393 €.
      const loin: Trajet = { ...employeurA, kmParTrajet: 55, joursTravailles: 100 }
      const justifie: Trajet = { ...employeurB, kmParTrajet: 50, joursTravailles: 60, distanceJustifiee: true }
      const report = simuler([salarie({ trajets: [loin, justifie], autresFrais: 0 })], [], salaires)

      expect(report.persons[0].fraisProfessionnels).toMatchObject({ fraisDeTrajet: 6393, distanceRetenue: 14000, retenue: "reels", deduction: 6393 })
    })
  })

  describe("micro-entreprise BNC de 40 000 €, avec les mêmes 8 720 km en déplacements professionnels, comparée en EI", () => {
    // Sans déplacements, voir comparateur.reference.test.ts : micro 10 240 € de cotisations, 1 468 € d'impôt ; EI 25 787 € nets.
    const activite = { ...micro("m1"), deplacementsProfessionnels: { kmParAn: 8720, puissanceFiscale: "5" as const, electrique: false } }
    const options: ComparaisonOptions = { activityId: "m1", remunerationNette: 0, repartition: { mode: "dividendes", partDistribuee: 1 }, partBncPrestations: 1 }
    const resultat = comparerStatuts(session([personne("alice"), activite], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000]]), options)
    const colonne = (statut: StatutCompare) => resultat.scenarios.find(s => s.statut === statut)!

    it("micro : les 4 508,04 € sont dépensés sans rien réduire", () => {
      // Cotisations 40 000 x 25,6 % = 10 240 € ; imposable 40 000 x 66 % = 26 400 €, impôt 1 468 € (inchangés).
      // Net : 40 000 - 10 240 - 4 508,04 - 1 468 = 23 783,96 €.
      expect(colonne("micro")).toMatchObject({ cotisationsSociales: 10240, impotSurLeRevenu: 1468, netApresImpots: 23784, revenusAvantPrelevements: 35492 })
    })

    it("EI : les 4 508,04 € sont une charge déductible, qui réduit les cotisations et l'impôt", () => {
      // Bénéfice avant cotisations 40 000 - 4 508,04 = 35 491,96 € ; assiette après 26 % : 26 264,05 €.
      // Maladie : 1,5 % + 2,5 % x (26 264,05 - 19 224) / 9 612 = 3,3311 %, 874,87 € ; indemnités journalières 0,5 %, 131,32 € ;
      // retraite de base 17,87 %, 4 693,39 € ; complémentaire 8,1 %, 2 127,39 € ; invalidité-décès 1,3 %, 341,43 € ;
      // allocations familiales nulles (assiette sous 52 866 €) ; CSG déductible 6,8 %, 1 785,96 € ; CSG non déductible et
      // CRDS 2,9 %, 761,66 € ; formation 120,15 € ; total 10 836,16 €.
      // Encaissé 35 491,96 - 10 836,16 = 24 655,80 € ; imposable 24 655,80 + 761,66 = 25 417,46 € ;
      // impôt brut (25 417,46 - 11 600) x 11 % = 1 519,92 € ; décote 897 - 45,25 % x 1 519,92 = 209,24 € ; impôt 1 310,68 €,
      // soit 1 311 €. Net : 24 655,80 - 1 311 = 23 344,80 €.
      expect(colonne("EI")).toMatchObject({ cotisationsSociales: 10836, impotSurLeRevenu: 1311, netApresImpots: 23345, revenusAvantPrelevements: 35492 })
    })
  })
})
