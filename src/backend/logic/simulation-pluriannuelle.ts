// src/backend/logic/simulation-pluriannuelle.ts

/*
 * Simulation de toutes les années d'une session (voir l'ADR 008) : chaque année est simulée comme une
 * simulation d'un an, avec les acteurs et les relations de la session, sa propre grille et ses propres règles
 * (reglesDeLAnnee : celles de l'année, les dernières connues pour une année plus récente, aucune avant).
 * Le comparateur et l'optimiseur travaillent sur une seule année, celle que l'utilisateur consulte.
 */

import type { ComparaisonOptions, EtatDeLaSociete, ComparaisonResult, DonneesDeLAnnee, OptimisationRemuneration, ResultatAnnee, SessionState, SimulationPluriannuelle, SimulationReport, StatutSociete } from "../../types.js"
import { anneeExistante, donneesDeLAnnee } from "./annees.js"
import { activiteComparee, avecLaCFEDeLAnnee, comparerStatuts, convertirLActivite, fraisDuStatut, situationActuelle, type SituationActuelle } from "./comparateur.js"
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

/** Ce qu'une année reçoit des années précédentes de la session. */
interface Heritage {
  /** Rapport de l'année N-2 s'il a pu être calculé : son revenu fiscal de référence sert au versement libératoire de N. */
  reportN2: SimulationReport | null
  regimeMicro: RegimeMicroDeLAnnee | undefined
  /** Réserves, réserve légale et déficit reportable de chaque société au 1er janvier (voir l'ADR 012). */
  etatsDesSocietes: Record<string, EtatDeLaSociete>
}

/** Prépare une année avec ce qu'elle hérite des précédentes. */
function preparerLAnnee(session: SessionState, annee: number, heritage: Heritage): PreparationDeLAnnee {
  const { reportN2, regimeMicro, etatsDesSocietes } = heritage
  const regles = reglesDeLAnnee(annee)
  if (regles.regles === null) return { erreur: regles.erreur }
  const contexte: ContexteDeLAnnee = {
    annee,
    avertissements: regles.avertissement ? [regles.avertissement] : [],
    ...(reportN2 ? { rfrN2: { annee: annee - 2, parPersonne: rfrParPersonne(reportN2) } } : {}),
    ...(regimeMicro ? { regimeMicro } : {}),
    ...(Object.keys(etatsDesSocietes).length > 0 ? { etatsDesSocietes } : {})
  }
  return { donnees: auRegimeReel(donneesDeLAnnee(session, annee), regimeMicro), regles: regles.regles, contexte }
}

/**
 * Ce que les sociétés à l'IS passent à l'année suivante : leur situation au 31 décembre d'après le rapport de l'année,
 * ou, pour une année qui n'a pas pu être simulée, celle qu'elles avaient au 1er janvier.
 */
function etatsALaFin(report: SimulationReport | null, auDebut: Record<string, EtatDeLaSociete>): Record<string, EtatDeLaSociete> {
  if (!report) return auDebut
  return { ...auDebut, ...Object.fromEntries(report.activities.flatMap(a => (a.reserves ? [[a.entityId, a.reserves.aLaFin]] : []))) }
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

/** Une année préparée : ses données, ses règles et son contexte. */
export type AnneePreparee = Exclude<PreparationDeLAnnee, { erreur: string }>

/** Ce que chaque année hérite des précédentes, et son résultat. */
interface Parcours {
  annee: number
  heritage: Heritage
  resultat: ResultatAnnee
}

/**
 * Simule chaque année de la session, de la plus ancienne à la plus récente : le revenu fiscal de référence calculé
 * pour l'année N-2 sert au versement libératoire de l'année N, le chiffre d'affaires des années précédentes décide
 * du régime des micro-entreprises (voir dispositifs.ts), et les sociétés à l'IS gardent d'une année à l'autre leurs
 * réserves, leur réserve légale et leur déficit reportable (voir l'ADR 012). `ajuster` peut modifier les données de
 * chaque année avant sa simulation (stratégies de distribution du comparateur).
 */
function parcourirLesAnnees(session: SessionState, ajuster?: (preparee: AnneePreparee) => DonneesDeLAnnee): Parcours[] {
  const regimes = regimesMicroDesAnnees(session)
  const parcours: Parcours[] = []
  let etatsDesSocietes: Record<string, EtatDeLaSociete> = {}
  for (const { annee } of session.annees) {
    const reportN2 = parcours.find(p => p.annee === annee - 2)?.resultat.report ?? null
    const heritage: Heritage = { reportN2, regimeMicro: regimes.get(annee), etatsDesSocietes }
    const preparation = preparerLAnnee(session, annee, heritage)
    const resultat: ResultatAnnee =
      "erreur" in preparation
        ? { annee, report: null, erreur: preparation.erreur }
        : { annee, report: runMetaSimulation(ajuster ? ajuster(preparation) : preparation.donnees, preparation.regles, preparation.contexte), erreur: null }
    parcours.push({ annee, heritage, resultat })
    etatsDesSocietes = etatsALaFin(resultat.report, etatsDesSocietes)
  }
  return parcours
}

/** Simule chaque année de la session (voir `parcourirLesAnnees`). */
export function simulerLesAnnees(session: SessionState, ajuster?: (preparee: AnneePreparee) => DonneesDeLAnnee): SimulationPluriannuelle {
  return { annees: parcourirLesAnnees(session, ajuster).map(p => p.resultat) }
}

/**
 * Prépare l'année demandée (la plus récente si elle n'est pas dans la session), avec ce qu'elle hérite des années
 * précédentes de la session ; une année sans règles est une erreur.
 */
function preparerOuEchouer(session: SessionState, annee: number) {
  const existante = anneeExistante(session, annee)
  const { heritage } = parcourirLesAnnees(session).find(p => p.annee === existante)!
  const preparation = preparerLAnnee(session, existante, heritage)
  if ("erreur" in preparation) throw new Error(preparation.erreur)
  return preparation
}

/** Compare les statuts d'une activité sur une année de la session, avec les règles de cette année. */
export function comparerStatutsDeLAnnee(session: SessionState, options: ComparaisonOptions, annee: number): ComparaisonResult {
  const { donnees, regles, contexte } = preparerOuEchouer(session, annee)
  return comparerStatuts(donnees, options, regles, contexte)
}

/**
 * Prépare l'arbitrage d'une année : ses données, ses règles, l'activité étudiée et les réglages, dont la CFE des frais
 * de fonctionnement tient compte, comme dans le comparateur, de la date de création de l'activité.
 */
function preparerLArbitrage(session: SessionState, options: ComparaisonOptions, annee: number) {
  const { donnees, regles, contexte } = preparerOuEchouer(session, annee)
  const source = activiteComparee(donnees, options.activityId)
  const cfe = source ? avecLaCFEDeLAnnee(options, source, contexte.annee ?? regles.annee, regles) : { options }
  return { donnees, regles, contexte, source, ...cfe }
}

/** Arbitre rémunération et dividendes sur une année de la session, avec les règles de cette année. */
export function optimiserRemunerationDeLAnnee(session: SessionState, options: ComparaisonOptions, statut: StatutSociete, annee: number): OptimisationRemuneration {
  const { donnees, regles, contexte, options: avecCFE } = preparerLArbitrage(session, options, annee)
  return optimiserRemuneration(donnees, avecCFE, statut, regles, contexte)
}

/** L'arbitrage d'une année, avec la situation actuelle de l'activité et les frais de fonctionnement retenus. */
export interface ArbitrageDeLAnnee {
  optimisation: OptimisationRemuneration
  /** L'activité telle que la grille la décrit, dans son statut actuel ; `null` sans activité à étudier. */
  situationActuelle: SituationActuelle | null
  /** Frais de fonctionnement annuels retenus pour le statut étudié, CFE de l'année comprise. */
  fraisFonctionnement: number
  /** CFE exonérée ou réduite l'année de création ou la suivante : ce qui est retenu. */
  noteCFE?: string
}

/**
 * L'arbitrage rémunération / dividendes d'une année et, en une simulation de plus, la situation actuelle de l'activité
 * avec les mêmes réglages : de quoi dire l'écart entre ce qui est saisi et le meilleur net.
 */
export function arbitrageDeLAnnee(session: SessionState, options: ComparaisonOptions, statut: StatutSociete, annee: number): ArbitrageDeLAnnee {
  const { donnees, regles, contexte, source, options: avecCFE, noteCFE } = preparerLArbitrage(session, options, annee)
  return {
    optimisation: optimiserRemuneration(donnees, avecCFE, statut, regles, contexte),
    situationActuelle: source ? situationActuelle(donnees, source, avecCFE, regles, contexte) : null,
    fraisFonctionnement: fraisDuStatut(statut, avecCFE),
    ...(noteCFE ? { noteCFE } : {})
  }
}
