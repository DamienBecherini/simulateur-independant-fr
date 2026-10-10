// src/backend/logic/routage-des-flux.ts
// Contexte du calcul d'une année et routage des flux : totaux annuels de la grille par entité, bulletins des salariés
// des activités, et inscription sur le compte de chaque personne de ce que ses activités lui versent (rémunération,
// dividendes, bénéfices, prélèvements) selon les relations de la session. Partagé par les modules du moteur, que
// simulation-engine.ts enchaîne.

import type { Company, DonneesDeLAnnee, EtatDeLaSociete, FinancialFlow, Relationship, SalarieDeLActivite } from "../../types.js"
import { brutPourUnNet, calculerCotisationsSalarie } from "./cotisationsSalarie.js"
import type { Foyer } from "./foyers.js"
import type { ReglesFiscales } from "./regles.js"
import type { RegimeMicroDeLAnnee } from "./dispositifs.js"

type FlowType = FinancialFlow["type"]
type FlowTotals = Partial<Record<FlowType, number>>

/** Ce qu'une personne reçoit de ses activités sur l'année, ventilé selon son traitement fiscal. */
interface RevenusDActivite {
  /** Rémunérations nettes de dirigeant, encaissées. */
  remunerations: number
  /** Les mêmes, telles qu'imposées comme des salaires (CSG non déductible et CRDS du gérant d'EURL comprises). */
  remunerationsImposables: number
  /** Bénéfices imposables au barème (micro-entreprise après abattement, entreprise individuelle après cotisations déductibles). */
  beneficesImposables: number
  dividendes: number
  dividendesSoumisPS: number
  versementLiberatoire: number
  /** Chiffre d'affaires après abattement des micro-entreprises au versement libératoire : hors barème, mais dans le revenu fiscal de référence. */
  revenusAuVersementLiberatoire: number
  /** Dividendes réellement encaissés, nets des cotisations sociales éventuelles. */
  dividendesEncaisses: number
  /** Bénéfices réellement encaissés (micro-entreprise, entreprise individuelle), nets de cotisations. */
  beneficesEncaisses: number
  /** Cotisations sociales et impôt sur les sociétés payés par ses activités, pour la part qui lui revient. */
  prelevementsActivites: number
  /** Sa part des bénéfices laissés dans les sociétés. */
  resultatConserve: number
}

/** Total encaissé par une personne depuis ses activités, net de cotisations. */
export function encaisse(revenus: RevenusDActivite): number {
  return revenus.remunerations + revenus.dividendesEncaisses + revenus.beneficesEncaisses
}

export interface Contexte {
  session: DonneesDeLAnnee
  regles: ReglesFiscales
  annee: ContexteDeLAnnee
  /** Foyers fiscaux, calculés avant les activités : le versement libératoire dépend des parts du foyer. */
  foyers: Foyer[]
  flux: Map<string, FlowTotals>
  /** Cotisations salariales par personne : écart entre brut et net des salaires dont le brut est renseigné, ou calculé pour les salariés d'une activité de la simulation. */
  cotisationsSalariales: Map<string, number>
  revenus: Map<string, RevenusDActivite>
  /** Bulletins de paie annuels des personnes salariées d'une activité de la simulation (relation « Salarié »). */
  salaries: Map<string, { employeurId: string; bulletin: SalarieDeLActivite }>
  /** Revenus versés par des activités qu'aucune relation ne rattache à une personne. */
  nonRattache: number
}

const RELATIONS_DE_DIRECTION: Relationship["type"][] = ["Président", "Gérant"]
export const RELATIONS_D_ASSOCIE: Relationship["type"][] = ["Président", "Gérant", "Associé"]
export const RELATIONS_D_EXPLOITANT: Relationship["type"][] = ["Titulaire", "Président", "Gérant"]

export function aggregateAnnualFlowsByEntity(session: DonneesDeLAnnee): Map<string, FlowTotals> {
  const map = new Map<string, FlowTotals>()
  for (const month of session.monthlyData) {
    for (const flow of month.flows) {
      const totals = map.get(flow.entityId) ?? {}
      totals[flow.type] = (totals[flow.type] ?? 0) + flow.amount
      map.set(flow.entityId, totals)
    }
  }
  return map
}

function aggregateSalaryContributions(session: DonneesDeLAnnee): Map<string, number> {
  const map = new Map<string, number>()
  for (const flow of session.monthlyData.flatMap(month => month.flows)) {
    if (flow.type !== "salary" || flow.grossAmount === undefined) continue
    map.set(flow.entityId, (map.get(flow.entityId) ?? 0) + Math.max(0, flow.grossAmount - flow.amount))
  }
  return map
}

/**
 * Salariés des activités de la simulation. Le salaire reste saisi, net, sur la personne ; une relation « Salarié »
 * vers une activité fait supporter à celle-ci le coût employeur de tous ses salaires. Le brut est celui saisi s'il
 * l'est pour chaque salaire, sinon il est retrouvé à partir du net par dichotomie. Sans relation, rien ne change :
 * le salaire est un revenu venu de l'extérieur de la simulation.
 */
export function bulletinsDesSalaries(session: DonneesDeLAnnee, flux: Map<string, FlowTotals>, regles: ReglesFiscales): Contexte["salaries"] {
  const typeDe = new Map(session.entities.map(e => [e.id, e.type]))
  const bulletins: Contexte["salaries"] = new Map()
  for (const rel of session.relationships.filter(r => r.type === "Salarié")) {
    // La relation peut avoir été créée depuis la carte de la personne comme depuis celle de l'activité.
    const [personId, employeurId] = typeDe.get(rel.fromId) === "person" ? [rel.fromId, rel.toId] : [rel.toId, rel.fromId]
    const net = flux.get(personId)?.salary ?? 0
    // Un seul employeur par personne : tous ses salaires viennent de la première activité qui l'emploie.
    if (typeDe.get(personId) !== "person" || [undefined, "person"].includes(typeDe.get(employeurId)) || bulletins.has(personId) || net <= 0) continue
    const salaires = session.monthlyData.flatMap(mois => mois.flows).filter(f => f.entityId === personId && f.type === "salary")
    const brut = salaires.every(f => f.grossAmount !== undefined) ? salaires.reduce((cumul, f) => cumul + (f.grossAmount ?? 0), 0) : brutPourUnNet(net, "salarie", regles.regimeGeneral)
    bulletins.set(personId, { employeurId, bulletin: { ...calculerCotisationsSalarie(brut, "salarie", regles.regimeGeneral), personId } })
  }
  return bulletins
}

/** Cotisations salariales : écart entre brut et net, pour les salaires dont le brut est connu (saisi ou calculé). */
export function cotisationsSalarialesParPersonne(session: DonneesDeLAnnee, flux: Map<string, FlowTotals>, salaries: Contexte["salaries"]): Map<string, number> {
  const cotisations = aggregateSalaryContributions(session)
  for (const [personId, { bulletin }] of salaries) cotisations.set(personId, bulletin.brut - (flux.get(personId)?.salary ?? 0))
  return cotisations
}

/** Somme annuelle de plusieurs types de flux d'une entité. */
export function total(ctx: Contexte, entityId: string, ...types: FlowType[]): number {
  const flux = ctx.flux.get(entityId)
  return types.reduce((somme, type) => somme + (flux?.[type] ?? 0), 0)
}

/** Personnes reliées à une activité par l'un des types de relation donnés, sans doublon, dans l'ordre des relations. */
export function personnesLiees(ctx: Contexte, entityId: string, types: Relationship["type"][]): string[] {
  const ids = new Set<string>()
  for (const rel of ctx.session.relationships) {
    if (!types.includes(rel.type) || (rel.fromId !== entityId && rel.toId !== entityId)) continue
    const autre = rel.fromId === entityId ? rel.toId : rel.fromId
    if (ctx.session.entities.some(e => e.id === autre && e.type === "person")) ids.add(autre)
  }
  return [...ids]
}

export function revenusDe(ctx: Contexte, personId: string): RevenusDActivite {
  let revenus = ctx.revenus.get(personId)
  if (!revenus) {
    revenus = { remunerations: 0, remunerationsImposables: 0, beneficesImposables: 0, dividendes: 0, dividendesSoumisPS: 0, versementLiberatoire: 0, revenusAuVersementLiberatoire: 0, dividendesEncaisses: 0, beneficesEncaisses: 0, prelevementsActivites: 0, resultatConserve: 0 }
    ctx.revenus.set(personId, revenus)
  }
  return revenus
}

/** La rémunération du dirigeant est versée à la première personne reliée par « Président » ou « Gérant ». */
export function verserRemuneration(ctx: Contexte, societe: Company, remuneration: { nette: number; imposable: number; cotisations: number }, warnings: string[]) {
  if (remuneration.nette <= 0) return
  const dirigeants = personnesLiees(ctx, societe.id, RELATIONS_DE_DIRECTION)
  if (dirigeants.length === 0) {
    warnings.push("Rémunération dirigeant saisie sans relation Président/Gérant vers une personne : non routée vers un foyer.")
    ctx.nonRattache += remuneration.nette
    return
  }
  if (dirigeants.length > 1) {
    warnings.push("Plusieurs dirigeants liés : la rémunération est attribuée au premier pour le routage fiscal simplifié.")
  }
  const revenus = revenusDe(ctx, dirigeants[0])
  revenus.remunerations += remuneration.nette
  revenus.remunerationsImposables += remuneration.imposable
  revenus.prelevementsActivites += remuneration.cotisations
}

/**
 * L'impôt sur les sociétés, les cotisations sur dividendes et le bénéfice conservé sont attribués
 * à parts égales aux personnes reliées à la société, pour mesurer ce que chaque foyer supporte.
 */
export function attribuerResultatSociete(ctx: Contexte, societe: Company, resultat: { impotSocietes: number; cotisationsSurDividendes: number; resultatConserve: number }) {
  const associes = personnesLiees(ctx, societe.id, RELATIONS_D_ASSOCIE)
  for (const associe of associes) {
    const revenus = revenusDe(ctx, associe)
    revenus.prelevementsActivites += (resultat.impotSocietes + resultat.cotisationsSurDividendes) / associes.length
    revenus.resultatConserve += resultat.resultatConserve / associes.length
  }
}

/** Les dividendes sont partagés à parts égales entre les personnes reliées à la société. */
export function verserDividendes(ctx: Contexte, societe: Company, dividendes: { verses: number; soumisPS: number; cotisations: number }, warnings: string[]) {
  if (dividendes.verses <= 0) return
  const associes = personnesLiees(ctx, societe.id, RELATIONS_D_ASSOCIE)
  if (associes.length === 0) {
    warnings.push("Dividendes versés sans relation Président, Gérant ou Associé vers une personne : non routés vers un foyer.")
    ctx.nonRattache += dividendes.verses - dividendes.cotisations
    return
  }
  if (associes.length > 1) {
    warnings.push(`Dividendes répartis à parts égales entre les ${associes.length} personnes liées : la répartition du capital n'est pas modélisée.`)
  }
  for (const associe of associes) {
    const revenus = revenusDe(ctx, associe)
    revenus.dividendes += dividendes.verses / associes.length
    revenus.dividendesSoumisPS += dividendes.soumisPS / associes.length
    revenus.dividendesEncaisses += (dividendes.verses - dividendes.cotisations) / associes.length
  }
}

/** Année simulée : celle de la session, ou celle des règles pour une simulation d'un an. */
export function anneeSimulee(ctx: Contexte): number {
  return ctx.annee.annee ?? ctx.regles.annee
}

export function somme<T>(elements: T[], valeur: (element: T) => number): number {
  return elements.reduce((cumul, element) => cumul + valeur(element), 0)
}

/** Ce que la simulation d'une année reçoit de la session au-delà de sa grille. */
export interface ContexteDeLAnnee {
  /** Année simulée, quand elle diffère de celle des règles (année sans règles connues). */
  annee?: number
  /** Avertissements sur l'année elle-même, repris dans le rapport. */
  avertissements?: string[]
  /**
   * Revenu fiscal de référence calculé pour l'année N-2, quand elle fait partie de la session : celui du foyer de
   * chaque personne. Il remplace, pour le versement libératoire, celui saisi dans la fiche de la micro-entreprise.
   */
  rfrN2?: { annee: number; parPersonne: Record<string, number> }
  /**
   * Régime des micro-entreprises cette année, d'après les années de la session (voir dispositifs.ts) : celles qui en
   * sont sorties sont déjà converties en entreprise individuelle au réel dans les données de l'année.
   */
  regimeMicro?: RegimeMicroDeLAnnee
  /**
   * Ce que chaque société à l'IS a gardé des années précédentes de la session, par identifiant (voir l'ADR 014). Une
   * société absente part de ce que dit sa fiche (`etatAuDebutDeLaSimulation`).
   */
  etatsDesSocietes?: Record<string, EtatDeLaSociete>
  /**
   * Assiette sociale de chaque activité au réel l'année précédente, quand elle fait partie de la session : la CARPIMKO
   * y assoit la retraite complémentaire et l'ASV de l'année (voir l'ADR 015). Une activité absente part de son année.
   */
  assiettesAnneePrecedente?: { annee: number; parActivite: Record<string, number> }
}
