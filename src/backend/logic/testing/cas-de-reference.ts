// src/backend/logic/testing/cas-de-reference.ts

import { describe, expect } from "vitest"
import { reglesPubliees } from "../regles.js"
import { runMetaSimulation } from "../simulation-engine.js"
import { session, type Flux } from "./session-de-test.js"
import type { Entity, Relationship, SimulationReport } from "../../../types.js"

/*
 * Outils communs aux cas de référence (src/backend/logic/references/, montages types) : ils lancent le moteur avec
 * les règles réelles de 2026 et lisent son rapport. Aucun montant attendu n'est calculé ici : chaque cas porte sa
 * propre dérivation.
 *
 * Les cas sont liés à 2026 pour toujours, et non à « l'année en cours » : une dérivation faite à la main avec les
 * règles de 2026 reste vraie pour simuler 2026 quand les règles de 2027 arrivent. Seule la mise à jour de l'impôt sur
 * le revenu de 2026, au vote de la loi de finances suivante (ADR 007), peut en changer quelques-uns. L'année 2027
 * aura ses propres cas. Le test « annee-suivante.test.ts » vérifie qu'une année de règles ajoutée ne les touche pas.
 */

/** Année des règles avec lesquelles tous les montants attendus ont été dérivés à la main ; ne change jamais. */
export const ANNEE_DES_CAS = 2026

/** Les règles de 2026, lues dans leur fichier : jamais les dernières connues, qui changeront avec les années. */
export const REGLES_DES_CAS = reglesPubliees(ANNEE_DES_CAS)

/**
 * Regroupe des cas de référence, tous calculés avec les règles de `ANNEE_DES_CAS`. Il n'y a plus de garde sur
 * l'année en cours : les cas tournent quelle que soit la dernière année de règles connue.
 */
export function casDeReference(titre: string, corps: () => void) {
  describe(titre, corps)
}

/** Lance le moteur sur une année 2026, avec les règles de 2026. */
export const simuler = (entities: Entity[], relationships: Relationship[] = [], flux: Flux[] = []) => runMetaSimulation(session(entities, relationships, flux), REGLES_DES_CAS, { annee: ANNEE_DES_CAS })

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
