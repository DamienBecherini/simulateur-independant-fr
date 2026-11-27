// src/backend/logic/routage-des-flux.ts
// Contexte du calcul d'une année et routage des flux : totaux annuels de la grille par entité, bulletins des salariés
// des activités, et inscription sur le compte de chaque personne de ce que ses activités lui versent (rémunération,
// dividendes, bénéfices, prélèvements) selon les relations de la session. Partagé par les modules du moteur, que
// simulation-engine.ts enchaîne.

import type { Company, DeductionDuRevenuProfessionnel, DonneesDeLAnnee, EtatDeLaSociete, FinancialFlow, SalarieDeLActivite } from "../../types.js"
import { brutPourUnNet, calculerCotisationsSalarie } from "./cotisationsSalarie.js"
import type { PlafondsHerites, RevenuProfessionnelDeLActivite } from "./epargne-retraite.js"
import type { Foyer } from "./foyers.js"
import type { ReglesFiscales } from "./regles.js"
import type { RegimeMicroDeLAnnee } from "./dispositifs.js"
import { anneeDeCreation, reglesDeLAnneeDeCreation } from "./annee-de-creation.js"
import { anomaliesDeStructure, personnesQui, type Activite } from "./regles-de-structure.js"

type FlowType = FinancialFlow["type"]
type FlowTotals = Partial<Record<FlowType, number>>

/** Ce qu'une personne reçoit de ses activités sur l'année, ventilé selon son traitement fiscal. */
interface RevenusDActivite {
  /** Rémunérations nettes de dirigeant, encaissées. */
  remunerations: number
  /** Les mêmes, telles qu'imposées comme des salaires (CSG non déductible et CRDS du gérant d'EURL comprises). */
  remunerationsImposables: number
  /** Salaires nets versés par ses activités en portage salarial, encaissés (voir l'ADR 016). */
  salairesPortes: number
  /** Les mêmes, tels qu'imposés : CSG non déductible et CRDS comprises. */
  salairesPortesImposables: number
  /** Bénéfices imposables au barème (micro-entreprise après abattement, entreprise individuelle après cotisations déductibles). */
  beneficesImposables: number
  dividendes: number
  dividendesSoumisPS: number
  versementLiberatoire: number
  /** Chiffre d'affaires après abattement des micro-entreprises au versement libératoire : hors barème, mais dans le revenu fiscal de référence. */
  revenusAuVersementLiberatoire: number
  /** Bénéfices exonérés d'impôt sur le revenu en zone (entreprise individuelle, micro-entreprise) : hors barème, mais dans le revenu fiscal de référence. */
  beneficesExoneres: number
  /** Dividendes réellement encaissés, nets des cotisations sociales éventuelles. */
  dividendesEncaisses: number
  /** Bénéfices réellement encaissés (micro-entreprise, entreprise individuelle), nets de cotisations. */
  beneficesEncaisses: number
  /** Cotisations sociales et impôt sur les sociétés payés par ses activités, pour la part qui lui revient. */
  prelevementsActivites: number
  /** Sa part des bénéfices laissés dans les sociétés, et la réserve de ses activités en portage salarial en CDI. */
  resultatConserve: number
}

/** Total encaissé par une personne depuis ses activités, net de cotisations. */
export function encaisse(revenus: RevenusDActivite): number {
  return revenus.remunerations + revenus.salairesPortes + revenus.dividendesEncaisses + revenus.beneficesEncaisses
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
  /**
   * Épargne retraite (ADR 021) : ce que chaque entreprise individuelle au réel ou EURL déduit du bénéfice ou de la
   * rémunération de son titulaire ou de son gérant, par identifiant de l'activité. Vide au premier calcul des activités,
   * qui sert à mesurer ces revenus ; rempli au second, s'il y a lieu (simulation-engine.ts).
   */
  deductionsDuRevenuProfessionnel: ReadonlyMap<string, DeductionDuRevenuProfessionnel>
  /** Les bénéfices et rémunérations dont une personne peut déduire ses versements d'épargne retraite, inscrits par le calcul des activités. */
  revenusProfessionnelsDeductibles: RevenuProfessionnelDeLActivite[]
}


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
 * le salaire est un revenu venu de l'extérieur de la simulation. L'année de création de l'employeur, le plafond et le
 * SMIC de la réduction générale sont réduits aux mois d'activité : l'emploi est supposé commencer avec elle (ADR 020).
 */
export function bulletinsDesSalaries(session: DonneesDeLAnnee, flux: Map<string, FlowTotals>, reglesDeLAnnee: ReglesFiscales, annee: number): Contexte["salaries"] {
  const typeDe = new Map(session.entities.map(e => [e.id, e.type]))
  const creationDe = new Map(session.entities.map(e => [e.id, "dateDeCreation" in e ? e.dateDeCreation : undefined]))
  const bulletins: Contexte["salaries"] = new Map()
  for (const rel of session.relationships.filter(r => r.type === "Salarié")) {
    // La relation peut avoir été créée depuis la carte de la personne comme depuis celle de l'activité.
    const [personId, employeurId] = typeDe.get(rel.fromId) === "person" ? [rel.fromId, rel.toId] : [rel.toId, rel.fromId]
    const net = flux.get(personId)?.salary ?? 0
    // Un seul employeur par personne : tous ses salaires viennent de la première activité qui l'emploie.
    if (typeDe.get(personId) !== "person" || [undefined, "person", "portage"].includes(typeDe.get(employeurId)) || bulletins.has(personId) || net <= 0) continue
    const creation = anneeDeCreation(creationDe.get(employeurId), annee)
    const regles = creation ? reglesDeLAnneeDeCreation(reglesDeLAnnee, creation) : reglesDeLAnnee
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
/**
 * Qui dirige l'activité (dirigeant d'une société, titulaire), et qui en est associé : les rôles qu'en donne la table
 * des règles de structure, selon la forme de l'activité. Le président d'une SASU ne reçoit donc des dividendes que
 * s'il en est aussi l'associé ; le gérant d'une EURL en est toujours un.
 */
export function dirigeantsDe(ctx: Contexte, activite: Activite): string[] {
  return personnesQui(ctx.session, activite, "dirige")
}

export function associesDe(ctx: Contexte, societe: Activite): string[] {
  return personnesQui(ctx.session, societe, "associe")
}

/** Ce qui, dans les relations de l'activité, contredit les règles de sa forme (sauvegarde ancienne, fichier importé). */
export function anomaliesDeLActivite(ctx: Contexte, activite: Activite): string[] {
  return anomaliesDeStructure(ctx.session, activite)
}

export function revenusDe(ctx: Contexte, personId: string): RevenusDActivite {
  let revenus = ctx.revenus.get(personId)
  if (!revenus) {
    revenus = { remunerations: 0, remunerationsImposables: 0, salairesPortes: 0, salairesPortesImposables: 0, beneficesImposables: 0, dividendes: 0, dividendesSoumisPS: 0, versementLiberatoire: 0, revenusAuVersementLiberatoire: 0, beneficesExoneres: 0, dividendesEncaisses: 0, beneficesEncaisses: 0, prelevementsActivites: 0, resultatConserve: 0 }
    ctx.revenus.set(personId, revenus)
  }
  return revenus
}

/** La rémunération du dirigeant est versée à la première personne qui dirige la société (président de SASU, gérant d'EURL). */
export function verserRemuneration(ctx: Contexte, societe: Company, remuneration: { nette: number; imposable: number; cotisations: number }, warnings: string[]) {
  if (remuneration.nette <= 0) return
  const dirigeants = dirigeantsDe(ctx, societe)
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
 * à parts égales aux associés de la société, pour mesurer ce que chaque foyer supporte.
 */
export function attribuerResultatSociete(ctx: Contexte, societe: Company, resultat: { impotSocietes: number; cotisationsSurDividendes: number; resultatConserve: number }) {
  const associes = associesDe(ctx, societe)
  for (const associe of associes) {
    const revenus = revenusDe(ctx, associe)
    revenus.prelevementsActivites += (resultat.impotSocietes + resultat.cotisationsSurDividendes) / associes.length
    revenus.resultatConserve += resultat.resultatConserve / associes.length
  }
}

/** Dividendes versés par une société qui n'a pas d'associé relié : à qui les verser, et comment le dire. */
const DIVIDENDES_SANS_ASSOCIE = {
  SASU: "Dividendes versés sans associé : non routés vers un foyer. Reliez une personne à la société par « Associé » ; son président n'en reçoit que s'il est aussi associé.",
  EURL: "Dividendes versés sans associé : non routés vers un foyer. Reliez une personne à la société par « Gérant » ou « Associé »."
}

/** Les dividendes sont partagés à parts égales entre les associés de la société. */
export function verserDividendes(ctx: Contexte, societe: Company, dividendes: { verses: number; soumisPS: number; cotisations: number }, warnings: string[]) {
  if (dividendes.verses <= 0) return
  const associes = associesDe(ctx, societe)
  if (associes.length === 0) {
    warnings.push(societe.legalStatus === "SASU" ? DIVIDENDES_SANS_ASSOCIE.SASU : DIVIDENDES_SANS_ASSOCIE.EURL)
    ctx.nonRattache += dividendes.verses - dividendes.cotisations
    return
  }
  if (associes.length > 1) {
    warnings.push(`Dividendes répartis à parts égales entre les ${associes.length} associés : la répartition du capital n'est pas modélisée.`)
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
  /**
   * Épargne retraite (voir l'ADR 021) : ce que chaque personne reçoit de l'année précédente, son plafond calculé et ses
   * plafonds reportés. Absent : c'est la première année de la session, ou une simulation d'un an, et le plafond saisi
   * dans la fiche de chaque personne s'applique. `parPersonne` vaut `null` quand l'année précédente n'est pas dans la
   * session ou n'a pas pu être simulée : le minimum légal s'applique.
   */
  epargneRetraite?: { parPersonne: Record<string, PlafondsHerites> | null }
  /**
   * Chercher aussi, pour chaque société à l'IS, la plus haute rémunération du dirigeant sans déficit
   * (`limiteDeRemuneration` du résultat) : pour les résultats de l'année, pas pour les colonnes du comparateur.
   */
  limitesDeRemuneration?: true
}
