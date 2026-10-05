// src/backend/logic/simulation-pluriannuelle.ts

/*
 * Simulation de toutes les années d'une session (voir l'ADR 008) : chaque année est simulée comme une
 * simulation d'un an, avec les acteurs et les relations de la session, sa propre grille et ses propres règles
 * (reglesDeLAnnee : celles de l'année, les dernières connues pour une année plus récente, aucune avant).
 * Le comparateur et l'optimiseur travaillent sur une seule année, celle que l'utilisateur consulte.
 */

import type { ComparaisonOptions, ComparaisonResult, DonneesDeLAnnee, OptimisationRemuneration, ResultatAnnee, SessionState, SimulationPluriannuelle, SimulationReport, StatutSociete } from "../../types.js"
import { anneeExistante, donneesDeLAnnee } from "./annees.js"
import { activiteComparee, avecLaCFEDeLAnnee, comparerStatuts, convertirLActivite } from "./comparateur.js"
import { regimesMicroDesAnnees, type RegimeMicroDeLAnnee } from "./dispositifs.js"
import { optimiserRemuneration } from "./optimisation-remuneration.js"
import { reglesDeLAnnee, type ReglesFiscales } from "./regles.js"
import { runMetaSimulation, type ContexteDeLAnnee } from "./simulation-engine.js"

/** Tout ce qu'il faut pour simuler une année : ses données, ses règles et son contexte ; ou l'erreur qui l'en empêche. */
type PreparationDeLAnnee = { donnees: DonneesDeLAnnee; regles: ReglesFiscales; contexte: ContexteDeLAnnee } | { erreur: string }

/** Revenu fiscal de référence de chaque personne, celui de son foyer, d'après le rapport d'une année. */
function rfrParPersonne(report: SimulationReport): Record<string, number> {
  return Object.fromEntries(report.foyers.flatMap(foyer => foyer.personIds.map(id => [id, foyer.revenuFiscalDeReference])))
}

/**
 * Prépare une année. `reportN2` est le rapport de l'année N-2 s'il a pu être calculé : son revenu fiscal de référence
 * sert alors au versement libératoire de l'année N.
 */
function preparerLAnnee(session: SessionState, annee: number, reportN2: SimulationReport | null, regimeMicro: RegimeMicroDeLAnnee | undefined): PreparationDeLAnnee {
  const regles = reglesDeLAnnee(annee)
  if (regles.regles === null) return { erreur: regles.erreur }
  const contexte: ContexteDeLAnnee = {
    annee,
    avertissements: regles.avertissement ? [regles.avertissement] : [],
    ...(reportN2 ? { rfrN2: { annee: annee - 2, parPersonne: rfrParPersonne(reportN2) } } : {}),
    ...(regimeMicro ? { regimeMicro } : {})
  }
  return { donnees: auRegimeReel(donneesDeLAnnee(session, annee), regimeMicro), regles: regles.regles, contexte }
}

/**
 * Les micro-entreprises sorties du régime micro cette année (deux années de suite au-delà des plafonds) sont simulées
 * en entreprise individuelle au réel, avec la conversion du comparateur : chiffre d'affaires en recettes, dépenses en
 * charges déductibles, relation « Titulaire » conservée. La session elle-même ne change pas.
 */
function auRegimeReel(donnees: DonneesDeLAnnee, regimeMicro: RegimeMicroDeLAnnee | undefined): DonneesDeLAnnee {
  const sorties = Object.keys(regimeMicro?.sorties ?? {})
  return sorties.reduce((courantes, id) => {
    const micro = activiteComparee(courantes, id)
    return micro?.type === "micro-entreprise" ? convertirLActivite(courantes, micro, "EI") : courantes
  }, donnees)
}

function simulerUneAnnee(session: SessionState, annee: number, reportN2: SimulationReport | null, regimeMicro: RegimeMicroDeLAnnee | undefined): ResultatAnnee {
  const preparation = preparerLAnnee(session, annee, reportN2, regimeMicro)
  if ("erreur" in preparation) return { annee, report: null, erreur: preparation.erreur }
  return { annee, report: runMetaSimulation(preparation.donnees, preparation.regles, preparation.contexte), erreur: null }
}

/**
 * Simule chaque année de la session, de la plus ancienne à la plus récente : le revenu fiscal de référence calculé
 * pour l'année N-2 sert au versement libératoire de l'année N, et le chiffre d'affaires des années précédentes décide
 * du régime des micro-entreprises (voir dispositifs.ts).
 */
export function simulerLesAnnees(session: SessionState): SimulationPluriannuelle {
  const regimes = regimesMicroDesAnnees(session)
  const annees: ResultatAnnee[] = []
  for (const { annee } of session.annees) {
    const reportN2 = annees.find(a => a.annee === annee - 2)?.report ?? null
    annees.push(simulerUneAnnee(session, annee, reportN2, regimes.get(annee)))
  }
  return { annees }
}

/**
 * Prépare l'année demandée (la plus récente si elle n'est pas dans la session), avec le revenu fiscal de référence
 * de N-2 si la session le permet et le régime de ses micro-entreprises ; une année sans règles est une erreur.
 */
function preparerOuEchouer(session: SessionState, annee: number) {
  const existante = anneeExistante(session, annee)
  const reportN2 = simulerLesAnnees(session).annees.find(a => a.annee === existante - 2)?.report ?? null
  const preparation = preparerLAnnee(session, existante, reportN2, regimesMicroDesAnnees(session).get(existante))
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
  // Comme dans le comparateur, la CFE des frais de fonctionnement tient compte de la date de création de l'activité.
  const source = activiteComparee(donnees, options.activityId)
  const avecCFE = source ? avecLaCFEDeLAnnee(options, source, contexte.annee ?? regles.annee, regles).options : options
  return optimiserRemuneration(donnees, avecCFE, statut, regles, contexte)
}
