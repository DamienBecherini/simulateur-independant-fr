// src/backend/logic/simulation-pluriannuelle.ts

/*
 * Simulation de toutes les années d'une session (voir l'ADR 008) : chaque année est simulée comme une
 * simulation d'un an, avec les acteurs et les relations de la session, sa propre grille et ses propres règles
 * (reglesDeLAnnee : celles de l'année, les dernières connues pour une année plus récente, aucune avant).
 * Le comparateur et l'optimiseur travaillent sur une seule année, celle que l'utilisateur consulte.
 */

import type { ComparaisonOptions, ComparaisonResult, DonneesDeLAnnee, OptimisationRemuneration, ResultatAnnee, SessionState, SimulationPluriannuelle, StatutSociete } from "../../types.js"
import { anneeExistante, donneesDeLAnnee } from "./annees.js"
import { comparerStatuts } from "./comparateur.js"
import { optimiserRemuneration } from "./optimisation-remuneration.js"
import { reglesDeLAnnee, type ReglesFiscales } from "./regles.js"
import { runMetaSimulation, type ContexteDeLAnnee } from "./simulation-engine.js"

/** Tout ce qu'il faut pour simuler une année : ses données, ses règles et son contexte ; ou l'erreur qui l'en empêche. */
type PreparationDeLAnnee = { donnees: DonneesDeLAnnee; regles: ReglesFiscales; contexte: ContexteDeLAnnee } | { erreur: string }

function preparerLAnnee(session: SessionState, annee: number): PreparationDeLAnnee {
  const regles = reglesDeLAnnee(annee)
  if (regles.regles === null) return { erreur: regles.erreur }
  const contexte: ContexteDeLAnnee = { annee, avertissements: regles.avertissement ? [regles.avertissement] : [] }
  return { donnees: donneesDeLAnnee(session, annee), regles: regles.regles, contexte }
}

function simulerUneAnnee(session: SessionState, annee: number): ResultatAnnee {
  const preparation = preparerLAnnee(session, annee)
  if ("erreur" in preparation) return { annee, report: null, erreur: preparation.erreur }
  return { annee, report: runMetaSimulation(preparation.donnees, preparation.regles, preparation.contexte), erreur: null }
}

/** Simule chaque année de la session, de la plus ancienne à la plus récente. */
export function simulerLesAnnees(session: SessionState): SimulationPluriannuelle {
  return { annees: session.annees.map(({ annee }) => simulerUneAnnee(session, annee)) }
}

/** Prépare l'année demandée (la plus récente si elle n'est pas dans la session) ; une année sans règles est une erreur. */
function preparerOuEchouer(session: SessionState, annee: number) {
  const preparation = preparerLAnnee(session, anneeExistante(session, annee))
  if ("erreur" in preparation) throw new Error(preparation.erreur)
  return preparation
}

/** Compare les statuts d'une activité sur une année de la session, avec les règles de cette année. */
export function comparerStatutsDeLAnnee(session: SessionState, options: ComparaisonOptions, annee: number): ComparaisonResult {
  const { donnees, regles, contexte } = preparerOuEchouer(session, annee)
  return comparerStatuts(donnees, options, regles, contexte)
}

/** Arbitre rémunération et dividendes sur une année de la session, avec les règles de cette année. */
export function optimiserRemunerationDeLAnnee(session: SessionState, options: ComparaisonOptions, statut: StatutSociete, annee: number): OptimisationRemuneration {
  const { donnees, regles, contexte } = preparerOuEchouer(session, annee)
  return optimiserRemuneration(donnees, options, statut, regles, contexte)
}
