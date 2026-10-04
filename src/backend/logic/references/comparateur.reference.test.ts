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
 * Approximations assumées du modèle : cotisations du président de SASU égales à 80 % de sa rémunération nette,
 * cotisations TNS (EURL, EI) égales à 45 % du revenu net.
 */

const options = (activityId: string, autres: Partial<ComparaisonOptions> = {}): ComparaisonOptions => ({ activityId, remunerationNette: 0, distribuerToutLeBenefice: true, partBncPrestations: 1, ...autres })

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
      // Revenu net : 40 000 / 1,45 = 27 586,21 € ; cotisations 12 413,79 €.
      // Impôt brut : (27 586,21 - 11 600) x 11 % = 1 758,48 € ; décote 897 - 795,71 = 101,29 € ; impôt 1 657,20 €, soit 1 657 €.
      // Net : 27 586,21 - 1 657 = 25 929,21 €.
      expect(colonne(resultat, "EI")).toMatchObject({ cotisationsSociales: 12414, impotSurLeRevenu: 1657, netApresImpots: 25929, totalPrelevements: 14071 })
    })

    it("SASU sans rémunération, tout le bénéfice distribué", () => {
      // IS : 40 000 x 15 % = 6 000 € ; dividendes 34 000 €.
      // Barème : 34 000 x 60 % - 34 000 x 6,8 % = 18 088 € ; impôt brut 713,68 €, décote 574,06 €, impôt 139,62 €,
      // contre 4 352 € au forfait. Prélèvements sociaux : 6 324 €. Net : 34 000 - 140 - 6 324 = 27 536 €.
      expect(colonne(resultat, "SASU")).toMatchObject({ cotisationsSociales: 0, impotSocietes: 6000, impotSurLeRevenu: 140, prelevementsSociaux: 6324, resultatConserve: 0, netApresImpots: 27536 })
    })

    it("EURL au capital de 1 000 € : dividendes au-delà de 100 € soumis aux cotisations TNS", () => {
      // IS 6 000 € ; dividendes 34 000 €, dont 33 900 € aux cotisations TNS : 15 255 € ; encaissés 18 745 €.
      // Barème : 20 400 - 100 x 6,8 % = 20 393,20 € ; impôt brut 967,25 €, décote 459,32 €, impôt 507,93 €, soit 508 €.
      // Prélèvements sociaux : 100 x 18,6 % = 18,60 €. Net : 18 745 - 508 - 18,60 = 18 218,40 €.
      expect(colonne(resultat, "EURL")).toMatchObject({ cotisationsSociales: 15255, impotSocietes: 6000, impotSurLeRevenu: 508, prelevementsSociaux: 19, netApresImpots: 18218 })
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
      // Cotisations 16 000 € ; bénéfice 60 000 - 5 000 - 20 000 - 16 000 = 19 000 € ; IS 2 850 € ; dividendes 16 150 €.
      // Rémunération : 20 000 - 2 000 = 18 000 € ; impôt 125,56 €. Forfait : 125,56 + 2 067,20 = 2 192,76 €.
      // Barème : 18 000 + 9 690 - 1 098,20 = 26 591,80 € ; impôt brut 1 649,10 €, décote 150,78 €, impôt 1 498,31 €. Barème retenu.
      // Prélèvements sociaux : 16 150 x 18,6 % = 3 003,90 €. Net : 20 000 + 16 150 - 1 498 - 3 003,90 = 31 648,10 €.
      expect(colonne(resultat, "SASU")).toMatchObject({ actuel: true, cotisationsSociales: 16000, impotSocietes: 2850, impotSurLeRevenu: 1498, prelevementsSociaux: 3004, resultatConserve: 0, netApresImpots: 31648 })
    })

    it("EURL : rémunération et solde distribué, dividendes au barème", () => {
      // Cotisations sur la rémunération 9 000 € ; bénéfice 26 000 € ; IS 3 900 € ; dividendes 22 100 €.
      // Capital 1 000 € : 22 000 € aux cotisations TNS, 9 900 € (total 18 900 €) ; dividendes encaissés 12 200 €.
      // Forfait : 125,56 + 2 828,80 = 2 954,36 €. Barème : 18 000 + 13 260 - 6,80 = 31 253,20 € ;
      // impôt 1 977,69 + 1 674,20 x 30 % = 2 479,95 €, soit 2 480 €. Barème retenu.
      // Net : 20 000 + 12 200 - 2 480 - 18,60 = 29 701,40 €.
      expect(colonne(resultat, "EURL")).toMatchObject({ cotisationsSociales: 18900, impotSocietes: 3900, impotSurLeRevenu: 2480, prelevementsSociaux: 19, netApresImpots: 29701 })
    })

    it("EI au réel : la rémunération saisie est ignorée, tout le bénéfice est imposé", () => {
      // Revenu net : 55 000 / 1,45 = 37 931,03 € ; cotisations 17 068,97 €.
      // Impôt : 1 977,69 + 8 352,03 x 30 % = 4 483,30 €, soit 4 483 €. Net : 37 931,03 - 4 483 = 33 448,03 €.
      expect(colonne(resultat, "EI")).toMatchObject({ cotisationsSociales: 17069, impotSurLeRevenu: 4483, netApresImpots: 33448 })
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
