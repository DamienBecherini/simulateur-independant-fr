// src/backend/logic/simulation-pluriannuelle.ts

/*
 * Simulation de toutes les années d'une session (voir l'ADR 008) : chaque année est simulée comme une
 * simulation d'un an, avec les acteurs et les relations de la session et sa propre grille.
 * Le comparateur et l'optimiseur travaillent sur une seule année, celle que l'utilisateur consulte.
 */

import type { ComparaisonOptions, ComparaisonResult, OptimisationRemuneration, ResultatAnnee, SessionState, SimulationPluriannuelle, StatutSociete } from "../../types.js"
import { anneeExistante, donneesDeLAnnee } from "./annees.js"
import { comparerStatuts } from "./comparateur.js"
import { optimiserRemuneration } from "./optimisation-remuneration.js"
import { reglesEnVigueur } from "./regles.js"
import { runMetaSimulation } from "./simulation-engine.js"

function simulerUneAnnee(session: SessionState, annee: number): ResultatAnnee {
  return { annee, report: runMetaSimulation(donneesDeLAnnee(session, annee), reglesEnVigueur), erreur: null }
}

/** Simule chaque année de la session, de la plus ancienne à la plus récente. */
export function simulerLesAnnees(session: SessionState): SimulationPluriannuelle {
  return { annees: session.annees.map(({ annee }) => simulerUneAnnee(session, annee)) }
}

/** Compare les statuts d'une activité sur une année de la session (la plus récente si l'année n'y est pas). */
export function comparerStatutsDeLAnnee(session: SessionState, options: ComparaisonOptions, annee: number): ComparaisonResult {
  return comparerStatuts(donneesDeLAnnee(session, anneeExistante(session, annee)), options, reglesEnVigueur)
}

/** Arbitre rémunération et dividendes sur une année de la session (la plus récente si l'année n'y est pas). */
export function optimiserRemunerationDeLAnnee(session: SessionState, options: ComparaisonOptions, statut: StatutSociete, annee: number): OptimisationRemuneration {
  return optimiserRemuneration(donneesDeLAnnee(session, anneeExistante(session, annee)), options, statut, reglesEnVigueur)
}
