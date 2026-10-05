// src/backend/logic/references/comparateur.reference.test.ts

import { describe, expect, it } from "vitest"
import { comparerStatuts } from "../comparateur.js"
import { casDeReference } from "../testing/cas-de-reference.js"
import { micro, personne, relation, session, societe } from "../testing/session-de-test.js"
import type { ComparaisonOptions, ComparaisonResult, StatutCompare } from "../../../types.js"

/*
 * Cas de référence 2026 : comparateur de statuts et imposition d'un couple en union libre.
 *
 * Démarche : le moteur tourne avec les règles réelles de config.json, et chaque colonne attendue est dérivée
 * à la main à partir des règles officielles 2026 (voir les en-têtes de micro.reference.test.ts et de
 * societes.reference.test.ts pour le détail des taux), sans lancer le moteur. En cas d'écart, c'est le moteur
 * qui est suspect. L'impôt sur le revenu est arrondi à l'euro avant d'être retranché du net.
 *
 * Cotisations TNS (EURL, EI) : barème officiel 2026, détaillé dans l'en-tête de societes.reference.test.ts.
 * Président de SASU : cotisations du régime général ligne à ligne, détaillées dans l'en-tête de societes.reference.test.ts.
 */

const options = (activityId: string, autres: Partial<ComparaisonOptions> = {}): ComparaisonOptions => ({ activityId, remunerationNette: 0, repartition: { mode: "dividendes", partDistribuee: 1 }, partBncPrestations: 1, ...autres })

function colonne(resultat: ComparaisonResult, statut: StatutCompare) {
  const trouvee = resultat.scenarios.find(s => s.statut === statut)
  if (!trouvee) throw new Error(`Colonne ${statut} absente`)
  return trouvee
}

casDeReference("Cas de référence 2026 : comparateur", () => {
  describe("micro-entreprise BNC de 40 000 €, titulaire célibataire, sans rémunération en société", () => {
    const resultat = comparerStatuts(session([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000]]), options("m1"))

    it("micro : 25,6 % de cotisations, 34 % d'abattement, barème", () => {
      // Cotisations 10 240 € ; revenu imposable 26 400 € ; impôt brut 1 628 €, décote 160,33 €, impôt 1 468 €.
      // Net : 40 000 - 10 240 - 1 468 = 28 292 €.
      expect(colonne(resultat, "micro")).toMatchObject({ actuel: true, cotisationsSociales: 10240, impotSocietes: 0, impotSurLeRevenu: 1468, prelevementsSociaux: 0, netApresImpots: 28292, totalPrelevements: 11708 })
    })

    it("micro + versement libératoire : 2,2 % du chiffre d'affaires", () => {
      // RFR non renseigné : l'option est appliquée. Impôt : 40 000 x 2,2 % = 880 €. Net : 40 000 - 10 240 - 880 = 28 880 €.
      expect(colonne(resultat, "micro-vfl")).toMatchObject({ cotisationsSociales: 10240, impotSurLeRevenu: 880, netApresImpots: 28880 })
    })

    it("EI au réel : cotisations TNS sur le bénéfice", () => {
      // Bénéfice 40 000 € ; assiette 29 600 €. Maladie 4 % + 2,5 % x 764 / 24 030 = 4,079 %, 1 207,53 € ; IJ 148 € ;
      // retraite de base 5 289,52 € ; complémentaire 2 397,60 € ; invalidité-décès 384,80 € ; CSG-CRDS 2 012,80 + 858,40 € ;
      // formation 120,15 € ; total 12 418,80 €. Encaissé : 27 581,20 € ; imposable 27 581,20 + 858,40 = 28 439,60 €.
      // Impôt brut : 16 839,60 x 11 % = 1 852,36 € ; décote 897 - 838,19 = 58,81 € ; impôt 1 793,55 €, soit 1 794 €.
      // Net : 27 581,20 - 1 794 = 25 787,20 €.
      expect(colonne(resultat, "EI")).toMatchObject({ cotisationsSociales: 12419, impotSurLeRevenu: 1794, netApresImpots: 25787, totalPrelevements: 14213 })
    })

    it("EI au réel : 4 trimestres de retraite validés sur l'assiette de 29 600 €", () => {
      // 29 600 € de revenu cotisé pour la retraite de base, au-delà des 4 x 1 803 = 7 212 € qui valident 4 trimestres.
      expect(colonne(resultat, "EI").protectionSociale).toMatchObject({ etoiles: 3, trimestres: 4 })
    })

    it("SASU sans rémunération, tout le bénéfice distribué", () => {
      // IS : 40 000 x 15 % = 6 000 € ; dividendes 34 000 €.
      // Barème : 34 000 x 60 % - 34 000 x 6,8 % = 18 088 € ; impôt brut 713,68 €, décote 574,06 €, impôt 139,62 €,
      // contre 4 352 € au forfait. Prélèvements sociaux : 6 324 €. Net : 34 000 - 140 - 6 324 = 27 536 €.
      expect(colonne(resultat, "SASU")).toMatchObject({ cotisationsSociales: 0, impotSocietes: 6000, impotSurLeRevenu: 140, prelevementsSociaux: 6324, resultatConserve: 0, netApresImpots: 27536 })
    })

    it("EURL au capital de 1 000 € : dividendes au-delà de 100 € soumis aux cotisations TNS", () => {
      // Sans rémunération, la société paie les cotisations minimales du gérant : 1 343,24 € (voir societes.reference.test.ts).
      // Bénéfice 38 656,76 € ; IS 5 798,51 € ; tout le reste est distribué : 32 858,24 €.
      // 32 758,24 € de dividendes s'ajoutent au revenu soumis à cotisations : 34 101,49 € ; abattement 8 866,39 € ;
      // assiette 25 235,10 €. Maladie 1,5 % + 2,5 % x (25 235,10 - 19 224) / 9 612 = 3,063 %, 773,06 € ; IJ sur 25 235,10 €, 126,18 € ;
      // retraite de base 4 509,51 € ; complémentaire 2 044,04 € ; invalidité-décès 328,06 € ; CSG-CRDS 1 715,99 + 731,82 € ;
      // formation 120,15 € ; total 10 348,80 €, dont 9 005,56 € sur les dividendes ; encaissés 23 852,68 €.
      // Barème : 32 858,24 x 60 % - 100 x 6,8 % = 19 708,15 € ; impôt brut 891,90 €, décote 897 - 403,58 = 493,42 €,
      // impôt 398,48 €, soit 398 €, contre 4 205,85 € au forfait.
      // Prélèvements sociaux : 100 x 18,6 % = 18,60 €. Net : 23 852,68 - 398 - 18,60 = 23 436,08 €.
      expect(colonne(resultat, "EURL")).toMatchObject({ cotisationsSociales: 10349, impotSocietes: 5799, impotSurLeRevenu: 398, prelevementsSociaux: 19, resultatConserve: 0, netApresImpots: 23436 })
    })

    it("toutes les colonnes partent des mêmes 40 000 €, et le versement libératoire l'emporte", () => {
      expect(resultat.scenarios.map(s => s.revenusAvantPrelevements)).toEqual([40000, 40000, 40000, 40000, 40000])
      expect(resultat.meilleur).toBe("micro-vfl")
    })
  })

  it("versement libératoire inaccessible : la colonne reprend le barème", () => {
    // RFR 50 000 € > 29 315 € : la colonne « micro + versement libératoire » est identique à la colonne micro.
    const entreprise = { ...micro("m1"), rfrN2: 50000 }
    const resultat = comparerStatuts(session([personne("alice"), entreprise], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000]]), options("m1"))

    expect(colonne(resultat, "micro-vfl")).toMatchObject({ impotSurLeRevenu: 1468, netApresImpots: 28292 })
    expect(colonne(resultat, "micro-vfl").warnings.some(w => w.startsWith("Versement libératoire impossible"))).toBe(true)
    expect(resultat.meilleur).toBe("micro")
  })

  describe("SASU de prestations : 60 000 € de CA, 5 000 € de charges, 20 000 € de rémunération nette", () => {
    const resultat = comparerStatuts(
      session(
        [personne("alice"), societe("s1", "SASU")],
        [relation("alice", "s1", "Président")],
        [
          ["s1", "ca_services", 60000],
          ["s1", "deductible_expense", 5000]
        ]
      ),
      options("s1", { remunerationNette: 20000 })
    )

    it("SASU : rémunération et solde distribué, dividendes au barème", () => {
      // Brut : 20 000 / 0,7915975 = 25 265,37 € ; cotisations salariales 5 265,37 €, patronales 37,19 % = 9 396,19 € ;
      // cotisations 14 661,55 € ; bénéfice 60 000 - 5 000 - 20 000 - 14 661,55 = 20 338,45 € ; IS 3 050,77 € ; dividendes 17 287,68 €.
      // Rémunération : 20 000 + 2,84925 % x 25 265,37 (719,87 €) = 20 719,87 €, moins 10 % : 18 647,89 € ; impôt brut 775,27 €,
      // décote 546,19 €, impôt 229,08 €, soit 229 €. Forfait : 229 + 17 287,68 x 12,8 % = 2 441,82 €.
      // Barème : 18 647,89 + 10 372,61 - 1 175,56 = 27 844,93 € ; impôt brut 1 786,94 €, décote 88,41 €, impôt 1 698,53 €,
      // soit 1 699 €. Barème retenu.
      // Prélèvements sociaux : 17 287,68 x 18,6 % = 3 215,51 €. Net : 20 000 + 17 287,68 - 1 699 - 3 215,51 = 32 373,17 €.
      // (Avec l'ancien ratio de 1,8 : 16 000 € de cotisations et un net de 31 648 €.)
      expect(colonne(resultat, "SASU")).toMatchObject({ actuel: true, cotisationsSociales: 14662, impotSocietes: 3051, impotSurLeRevenu: 1699, prelevementsSociaux: 3216, resultatConserve: 0, netApresImpots: 32373 })
    })

    it("EURL : rémunération et solde distribué, dividendes au barème", () => {
      // Rémunération nette 20 000 € : R = 28 412,04 € tel que R - cotisations(R) = 20 000. Vérification : assiette 21 024,91 € ;
      // maladie 1,5 % + 2,5 % x (21 024,91 - 19 224) / 9 612 = 1,968 %, 413,85 € ; IJ 105,12 € ; retraite de base 3 757,15 € ;
      // complémentaire 1 703,02 € ; invalidité-décès 273,32 € ; CSG-CRDS 1 429,69 + 609,72 € ; formation 120,15 € ; total 8 412,04 €.
      // Bénéfice 60 000 - 5 000 - 20 000 - 8 412,04 = 26 587,96 € ; IS 3 988,19 € ; dividendes 22 599,77 €.
      // Capital 1 000 € : 22 499,77 € s'ajoutent au revenu : 50 911,81 € ; assiette 37 674,74 € ; maladie 4 % + 2,5 % x 8 838,74 / 24 030
      // = 4,920 %, 1 853,43 € ; IJ 188,37 € ; retraite de base 6 732,48 € ; complémentaire 3 051,65 € ; invalidité-décès 489,77 € ;
      // CSG-CRDS 2 561,88 + 1 092,57 € ; formation 120,15 € ; total 16 090,30 €, dont 7 678,26 € sur les dividendes, encaissés 14 921,50 €.
      // Rémunération imposable 20 000 + 609,72 = 20 609,72 €, moins 10 % : 18 548,75 € ; impôt brut 764,36 €,
      // décote 897 - 345,87 = 551,13 €, impôt 213,23 €, soit 213 €. Forfait : 213 + 22 599,77 x 12,8 % = 3 105,77 €.
      // Barème : 18 548,75 + 13 559,86 - 6,80 = 32 101,81 € ; impôt 1 977,69 + 2 522,81 x 30 % = 2 734,53 €, soit 2 735 €. Barème retenu.
      // Net : 20 000 + 14 921,50 - 2 735 - 18,60 = 32 167,90 €.
      expect(colonne(resultat, "EURL")).toMatchObject({ cotisationsSociales: 16090, impotSocietes: 3988, impotSurLeRevenu: 2735, prelevementsSociaux: 19, resultatConserve: 0, netApresImpots: 32168 })
    })

    it("EI au réel : la rémunération saisie est ignorée, tout le bénéfice est imposé", () => {
      // Bénéfice 55 000 € ; assiette 40 700 €. Maladie 4 % + 2,5 % x 11 864 / 24 030 = 5,234 %, 2 130,36 € ; IJ 203,50 € ;
      // retraite de base 7 273,09 € ; complémentaire 3 296,70 € ; invalidité-décès 529,10 € ; CSG-CRDS 2 767,60 + 1 180,30 € ;
      // formation 120,15 € ; total 17 500,80 €. Encaissé : 37 499,20 € ; imposable 38 679,50 €.
      // Impôt : 1 977,69 + 9 100,50 x 30 % = 4 707,84 €, soit 4 708 €. Net : 37 499,20 - 4 708 = 32 791,20 €.
      expect(colonne(resultat, "EI")).toMatchObject({ cotisationsSociales: 17501, impotSurLeRevenu: 4708, netApresImpots: 32791 })
    })

    it("micro : prestations converties en BNC, charges devenues des dépenses non déductibles", () => {
      // Cotisations 60 000 x 25,6 % = 15 360 € ; revenu imposable 60 000 - 20 400 = 39 600 € ;
      // impôt 1 977,69 + 10 021 x 30 % = 4 983,99 €, soit 4 984 €. Net : 60 000 - 15 360 - 5 000 - 4 984 = 34 656 €.
      expect(colonne(resultat, "micro")).toMatchObject({ cotisationsSociales: 15360, impotSurLeRevenu: 4984, netApresImpots: 34656 })
    })

    it("micro + versement libératoire : meilleur net", () => {
      // Impôt : 60 000 x 2,2 % = 1 320 €. Net : 60 000 - 15 360 - 5 000 - 1 320 = 38 320 €.
      expect(colonne(resultat, "micro-vfl")).toMatchObject({ impotSurLeRevenu: 1320, netApresImpots: 38320 })
      expect(resultat.meilleur).toBe("micro-vfl")
    })
  })

  it("couple en union libre : impôt actuel et impôt en cas de mariage", () => {
    // Voir foyers.reference.test.ts : 2 097 + 126 = 2 223 € d'impôt en union libre (net 57 777 €),
    // 2 511 € en imposition commune (net 57 489 €) : la décote de Bob rend ici le mariage moins favorable.
    const resultat = comparerStatuts(
      session(
        [personne("alice"), personne("bob"), personne("enfant1")],
        [relation("alice", "bob", "En couple"), relation("alice", "enfant1", "Enfant")],
        [
          ["alice", "salary", 40000],
          ["bob", "salary", 20000]
        ]
      ),
      options("")
    )

    expect(resultat.couples).toEqual([{ personIds: ["alice", "bob"], netApresImpotsActuel: 57777, impotSurLeRevenuActuel: 2223, netApresImpotsMaries: 57489, impotSurLeRevenuMaries: 2511 }])
  })
})
