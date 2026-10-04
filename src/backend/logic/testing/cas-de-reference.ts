// src/backend/logic/testing/cas-de-reference.ts

import { describe, expect, it } from "vitest"
import { reglesEnVigueur } from "../regles.js"
import { runMetaSimulation } from "../simulation-engine.js"
import { session, type Flux } from "./session-de-test.js"
import type { Entity, Relationship, SimulationReport } from "../../../types.js"

/*
 * Outils communs aux cas de référence (src/backend/logic/references/) : ils lancent le moteur avec les règles réelles (`config.json`)
 * et lisent son rapport. Aucun montant attendu n'est calculé ici : chaque cas porte sa propre dérivation.
 */

/** Année des règles avec lesquelles tous les montants attendus ont été dérivés à la main. */
export const ANNEE_DES_CAS = 2026

/**
 * Regroupe des cas de référence derrière une garde sur l'année des règles : si `config.json` passe à une
 * autre année, un seul test échoue avec un message explicite, et les cas sont ignorés au lieu de produire
 * des écarts incompréhensibles. Il faut alors refaire les dérivations avec le nouveau barème.
 */
export function casDeReference(titre: string, corps: () => void) {
  describe(titre, () => {
    it(`portent sur les règles ${ANNEE_DES_CAS}`, () => {
      expect(
        reglesEnVigueur.annee,
        `Les cas de référence ont été dérivés à la main avec les règles ${ANNEE_DES_CAS}, mais config.json décrit l'année ${reglesEnVigueur.annee} : refaites les dérivations de src/backend/logic/references/ avec les nouvelles règles.`
      ).toBe(ANNEE_DES_CAS)
    })

    describe.runIf(reglesEnVigueur.annee === ANNEE_DES_CAS)(`règles ${ANNEE_DES_CAS}`, corps)
  })
}

/** Lance le moteur avec les règles en vigueur. */
export const simuler = (entities: Entity[], relationships: Relationship[] = [], flux: Flux[] = []) => runMetaSimulation(session(entities, relationships, flux))

export function activite(report: SimulationReport, entityId: string) {
  const resultat = report.activities.find(a => a.entityId === entityId)
  if (!resultat) throw new Error(`Activité ${entityId} absente du rapport`)
  return resultat
}

export function foyerDe(report: SimulationReport, personId: string) {
  const foyer = report.foyers.find(f => f.personIds.includes(personId))
  if (!foyer) throw new Error(`Aucun foyer pour ${personId}`)
  return foyer
}

/**
 * Identité du bilan : tout ce que produisent les activités et les revenus directs se retrouve prélevé,
 * conservé en société, encaissé net d'impôts ou non rattaché. Chaque poste étant arrondi à l'euro
 * séparément, la somme peut s'écarter de 2 € au plus.
 */
export function verifierIdentiteDuBilan(report: SimulationReport) {
  const { bilan } = report
  const reparti = bilan.totalPrelevements + bilan.resultatConserve + report.totalNetApresImpots + bilan.nonRattache
  expect(Math.abs(bilan.revenusAvantPrelevements - reparti)).toBeLessThanOrEqual(2)
}
