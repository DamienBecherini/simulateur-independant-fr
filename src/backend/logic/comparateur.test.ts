// src/backend/logic/comparateur.test.ts

import { describe, expect, it } from "vitest"
import { comparerStatuts, statutActuel } from "./comparateur.js"
import { reglesDeTest } from "./testing/regles-de-test.js"
import { micro, personne, relation, session, societe, type Flux } from "./testing/session-de-test.js"
import type { ComparaisonOptions, ComparaisonResult, Entity, Relationship, StatutCompare } from "../../types.js"

/*
 * Montants calculés à la main avec les règles de test : micro BNC à 25 % de cotisations et 30 % d'abattement,
 * versement libératoire BNC à 2 %, TNS à 50 % du revenu net, IS à 15 % jusqu'à 40 000 €,
 * dividendes à 12 % d'IR forfaitaire ou au barème (abattement 40 %, CSG déductible 7 %) et 18 % de prélèvements sociaux.
 */

const options = (activityId: string, autres: Partial<ComparaisonOptions> = {}): ComparaisonOptions => ({ activityId, remunerationNette: 0, distribuerToutLeBenefice: true, partBncPrestations: 1, ...autres })

const comparer = (entities: Entity[], relationships: Relationship[], flux: Flux[], opts: ComparaisonOptions) => comparerStatuts(session(entities, relationships, flux), opts, reglesDeTest)

function colonne(resultat: ComparaisonResult, statut: StatutCompare) {
  const trouvee = resultat.scenarios.find(s => s.statut === statut)
  if (!trouvee) throw new Error(`Colonne ${statut} absente`)
  return trouvee
}

describe("statutActuel", () => {
  it("distingue la micro-entreprise avec et sans versement libératoire", () => {
    expect(statutActuel(micro("m1"))).toBe("micro")
    expect(statutActuel(micro("m1", { opteVFL: true }))).toBe("micro-vfl")
    expect(statutActuel(societe("s1", "EURL"))).toBe("EURL")
  })
})

describe("comparerStatuts", () => {
  describe("micro-entreprise en prestations BNC", () => {
    const resultat = comparer([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000]], options("m1"))

    it("présente une colonne par statut, et repère le statut actuel", () => {
      expect(resultat.scenarios.map(s => s.statut)).toEqual(["SASU", "EURL", "EI", "micro", "micro-vfl"])
      expect(resultat.scenarios.filter(s => s.actuel).map(s => s.statut)).toEqual(["micro"])
    })

    it("calcule le net de chaque statut", () => {
      // Micro : 40 000 - 10 000 de cotisations - 1 800 d'impôt (28 000 € imposables).
      expect(colonne(resultat, "micro")).toMatchObject({ netApresImpots: 28200, cotisationsSociales: 10000, impotSurLeRevenu: 1800 })
      // Versement libératoire : 2 % du chiffre d'affaires au lieu du barème.
      expect(colonne(resultat, "micro-vfl")).toMatchObject({ netApresImpots: 29200, impotSurLeRevenu: 800 })
      // EI au réel : 26 667 € de revenu net après cotisations, 1 667 € d'impôt.
      expect(colonne(resultat, "EI")).toMatchObject({ netApresImpots: 25000, impotSurLeRevenu: 1667 })
      // SASU sans rémunération : 6 000 € d'IS, 34 000 € de dividendes imposés au barème (403 €) et 6 120 € de prélèvements sociaux.
      expect(colonne(resultat, "SASU")).toMatchObject({ netApresImpots: 27477, impotSocietes: 6000, impotSurLeRevenu: 403, prelevementsSociaux: 6120, resultatConserve: 0 })
      // EURL, capital de 1 000 € : au-delà de 100 €, les dividendes supportent 50 % de cotisations.
      expect(colonne(resultat, "EURL")).toMatchObject({ netApresImpots: 16273, cotisationsSociales: 16950, prelevementsSociaux: 18 })
    })

    it("désigne le statut au meilleur net", () => {
      expect(resultat.meilleur).toBe("micro-vfl")
      expect(resultat.warnings).toEqual([])
    })
  })

  describe("conversion des flux", () => {
    it("répartit les prestations d'une société entre BNC et BIC selon la part choisie", () => {
      // 40 000 € de prestations, moitié BNC (25 %), moitié BIC (20 %) : 9 000 € de cotisations.
      const resultat = comparer([personne("alice"), societe("s1", "SASU")], [relation("alice", "s1", "Président")], [["s1", "ca_services", 40000]], options("s1", { partBncPrestations: 0.5 }))

      expect(colonne(resultat, "micro").cotisationsSociales).toBe(9000)
      expect(colonne(resultat, "SASU").actuel).toBe(true)
    })

    it("garde la répartition d'une micro qui mêle vente, BIC et BNC", () => {
      const flux: Flux[] = [
        ["m1", "ca_micro_vente", 10000],
        ["m1", "ca_micro_services_bic", 10000],
        ["m1", "ca_micro_services_bnc", 10000]
      ]

      const resultat = comparer([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], flux, options("m1", { partBncPrestations: 0 }))

      // 1 000 + 2 000 + 2 500 € : la part BNC choisie ne s'applique pas à une micro existante.
      expect(colonne(resultat, "micro").cotisationsSociales).toBe(5500)
      expect(colonne(resultat, "EI").cotisationsSociales).toBe(10000)
    })

    it("rend déductibles en société les dépenses d'une micro, et l'inverse", () => {
      const resultat = comparer([personne("alice"), micro("m1")], [relation("alice", "m1", "Titulaire")], [["m1", "ca_micro_services_bnc", 40000], ["m1", "expense", 10000]], options("m1"))

      // En EI, 30 000 € de bénéfice : 10 000 € de cotisations. En micro, les dépenses ne changent pas les cotisations.
      expect(colonne(resultat, "EI").cotisationsSociales).toBe(10000)
      expect(colonne(resultat, "micro").cotisationsSociales).toBe(10000)
    })

    it("applique la rémunération choisie et conserve les dividendes saisis quand on ne distribue pas tout", () => {
      const flux: Flux[] = [
        ["s1", "ca_services", 100000],
        ["s1", "director_remuneration", 1000],
        ["s1", "dividends_payment", 20000]
      ]

      const resultat = comparer([personne("alice"), societe("s1", "SASU")], [relation("alice", "s1", "Président")], flux, options("s1", { remunerationNette: 30000, distribuerToutLeBenefice: false }))

      // Rémunération de 30 000 € et 24 000 € de cotisations : 46 000 € de bénéfice, 7 500 € d'IS ; 20 000 € de dividendes saisis, 18 500 € conservés.
      expect(colonne(resultat, "SASU")).toMatchObject({ cotisationsSociales: 24000, impotSocietes: 7500, resultatConserve: 18500 })
    })
  })

  describe("personnes reliées", () => {
    it("signale une activité reliée à personne", () => {
      const resultat = comparer([personne("alice"), micro("m1")], [], [["m1", "ca_micro_vente", 10000]], options("m1"))

      expect(resultat.warnings).toEqual([expect.stringContaining("reliée à aucune personne")])
      expect(colonne(resultat, "micro").netApresImpots).toBe(0)
    })

    it("prévient que les associés ne suivent pas en entreprise individuelle", () => {
      const resultat = comparer([personne("alice"), personne("bob"), societe("s1")], [relation("alice", "s1", "Président"), relation("bob", "s1", "Associé")], [["s1", "ca_services", 50000]], options("s1"))

      expect(resultat.warnings).toEqual([expect.stringContaining("autres associés")])
    })
  })

  it("demande de choisir une activité quand l'identifiant ne correspond à aucune", () => {
    const resultat = comparer([personne("alice")], [], [], options("inconnue"))

    expect(resultat).toEqual({ scenarios: [], meilleur: null, couples: [], warnings: ["Choisissez une activité à comparer."] })
  })

  describe("couples en union libre", () => {
    it("compare l'impôt actuel avec une imposition commune", () => {
      const resultat = comparer(
        [personne("alice"), personne("bob")],
        [relation("alice", "bob", "En couple")],
        [
          ["alice", "salary", 50000],
          ["bob", "salary", 5000]
        ],
        options("aucune")
      )

      // Séparés : 45 000 € imposables pour Alice (6 500 €), 4 500 € pour Bob (0 €).
      // Mariés : 49 500 € pour 2 parts, soit 2 x 1 475 € = 2 950 € d'impôt brut, sans décote.
      expect(resultat.couples).toEqual([{ personIds: ["alice", "bob"], netApresImpotsActuel: 48500, impotSurLeRevenuActuel: 6500, netApresImpotsMaries: 52050, impotSurLeRevenuMaries: 2950 }])
    })
  })
})
