// src/backend/logic/simulation-engine.ts

import type { ActivityResult, Company, FinancialFlow, FoyerFiscalResult, MicroEntreprise, Person, PersonResult, Relationship, SessionState, SimulationBilan, SimulationReport } from "../../types.js"
import { calculerMicro } from "./calculsAE.js"
import { calculerEI } from "./calculsEI.js"
import { calculerEURL } from "./calculsEURL.js"
import { calculerIR } from "./calculsIR.js"
import { calculerSASU } from "./calculsSASU.js"
import { buildFoyers, type Foyer } from "./foyers.js"
import { reglesEnVigueur, type ReglesFiscales } from "./regles.js"

/*
 * Le calcul va dans un seul sens :
 *   1. chaque activité calcule son résultat annuel et ce qu'elle verse aux personnes ;
 *   2. ces versements sont inscrits sur le compte de chaque personne ;
 *   3. l'impôt sur le revenu est calculé une seule fois par foyer, sur l'ensemble de ses revenus.
 */

type FlowType = FinancialFlow["type"]
type FlowTotals = Partial<Record<FlowType, number>>

/** Ce qu'une personne reçoit de ses activités sur l'année, ventilé selon son traitement fiscal. */
interface RevenusDActivite {
  /** Rémunérations de dirigeant, imposées comme des salaires. */
  remunerations: number
  /** Bénéfices imposables au barème (micro-entreprise après abattement, entreprise individuelle). */
  beneficesImposables: number
  dividendes: number
  dividendesSoumisPS: number
  versementLiberatoire: number
  /** Dividendes réellement encaissés, nets des cotisations sociales éventuelles. */
  dividendesEncaisses: number
  /** Bénéfices réellement encaissés (micro-entreprise, entreprise individuelle), nets de cotisations. */
  beneficesEncaisses: number
}

/** Total encaissé par une personne depuis ses activités, net de cotisations. */
function encaisse(revenus: RevenusDActivite): number {
  return revenus.remunerations + revenus.dividendesEncaisses + revenus.beneficesEncaisses
}

interface Contexte {
  session: SessionState
  regles: ReglesFiscales
  flux: Map<string, FlowTotals>
  revenus: Map<string, RevenusDActivite>
  /** Revenus versés par des activités qu'aucune relation ne rattache à une personne. */
  nonRattache: number
}

const RELATIONS_DE_DIRECTION: Relationship["type"][] = ["Président", "Gérant"]
const RELATIONS_D_ASSOCIE: Relationship["type"][] = ["Président", "Gérant", "Associé"]
const RELATIONS_D_EXPLOITANT: Relationship["type"][] = ["Titulaire", "Président", "Gérant"]

function aggregateAnnualFlowsByEntity(session: SessionState): Map<string, FlowTotals> {
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

/** Somme annuelle de plusieurs types de flux d'une entité. */
function total(ctx: Contexte, entityId: string, ...types: FlowType[]): number {
  const flux = ctx.flux.get(entityId)
  return types.reduce((somme, type) => somme + (flux?.[type] ?? 0), 0)
}

/** Personnes reliées à une activité par l'un des types de relation donnés, sans doublon, dans l'ordre des relations. */
function personnesLiees(ctx: Contexte, entityId: string, types: Relationship["type"][]): string[] {
  const ids = new Set<string>()
  for (const rel of ctx.session.relationships) {
    if (!types.includes(rel.type) || (rel.fromId !== entityId && rel.toId !== entityId)) continue
    const autre = rel.fromId === entityId ? rel.toId : rel.fromId
    if (ctx.session.entities.some(e => e.id === autre && e.type === "person")) ids.add(autre)
  }
  return [...ids]
}

function revenusDe(ctx: Contexte, personId: string): RevenusDActivite {
  let revenus = ctx.revenus.get(personId)
  if (!revenus) {
    revenus = { remunerations: 0, beneficesImposables: 0, dividendes: 0, dividendesSoumisPS: 0, versementLiberatoire: 0, dividendesEncaisses: 0, beneficesEncaisses: 0 }
    ctx.revenus.set(personId, revenus)
  }
  return revenus
}

/** La rémunération du dirigeant est versée à la première personne reliée par « Président » ou « Gérant ». */
function verserRemuneration(ctx: Contexte, societe: Company, remuneration: number, warnings: string[]) {
  if (remuneration <= 0) return
  const dirigeants = personnesLiees(ctx, societe.id, RELATIONS_DE_DIRECTION)
  if (dirigeants.length === 0) {
    warnings.push("Rémunération dirigeant saisie sans relation Président/Gérant vers une personne : non routée vers un foyer.")
    ctx.nonRattache += remuneration
    return
  }
  if (dirigeants.length > 1) {
    warnings.push("Plusieurs dirigeants liés : la rémunération est attribuée au premier pour le routage fiscal simplifié.")
  }
  revenusDe(ctx, dirigeants[0]).remunerations += remuneration
}

/** Les dividendes sont partagés à parts égales entre les personnes reliées à la société. */
function verserDividendes(ctx: Contexte, societe: Company, dividendes: { verses: number; soumisPS: number; cotisations: number }, warnings: string[]) {
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

function simulerSocieteIS(ctx: Contexte, societe: Company): ActivityResult {
  const entrees = {
    chiffreAffaires: total(ctx, societe.id, "ca_services", "ca_vente"),
    chargesDeductibles: total(ctx, societe.id, "deductible_expense"),
    remunerationNette: total(ctx, societe.id, "director_remuneration"),
    dividendesDemandes: total(ctx, societe.id, "dividends_payment")
  }
  const resultat = societe.legalStatus === "SASU" ? calculerSASU(entrees, ctx.regles) : calculerEURL({ ...entrees, capitalSocial: societe.capitalSocial }, ctx.regles)
  const warnings = [...resultat.warnings]

  verserRemuneration(ctx, societe, resultat.remunerationNette, warnings)
  verserDividendes(ctx, societe, { verses: resultat.dividendesVerses, soumisPS: resultat.dividendesSoumisPS, cotisations: resultat.cotisationsSurDividendes }, warnings)

  return {
    entityId: societe.id,
    name: societe.name,
    type: "company",
    statut: societe.legalStatus,
    chiffreAffaires: resultat.chiffreAffaires,
    charges: resultat.chargesDeductibles,
    cotisationsSociales: resultat.cotisationsSociales,
    impotSocietes: resultat.impotSocietes,
    revenuVerse: resultat.remunerationNette + resultat.dividendesVerses - resultat.cotisationsSurDividendes,
    resultatConserve: resultat.resultatConserve,
    warnings
  }
}

function simulerEntrepriseIndividuelle(ctx: Contexte, entreprise: Company): ActivityResult {
  const resultat = calculerEI({ chiffreAffaires: total(ctx, entreprise.id, "ca_services", "ca_vente"), chargesDeductibles: total(ctx, entreprise.id, "deductible_expense") }, ctx.regles)
  const warnings = [...resultat.warnings]

  if (total(ctx, entreprise.id, "director_remuneration", "dividends_payment") > 0) {
    warnings.push("Une entreprise individuelle ne verse ni rémunération de dirigeant ni dividendes : ces flux sont ignorés, tout le bénéfice revient à l'entrepreneur.")
  }

  const exploitant = personnesLiees(ctx, entreprise.id, RELATIONS_D_EXPLOITANT)[0]
  if (exploitant) {
    const revenus = revenusDe(ctx, exploitant)
    revenus.beneficesImposables += Math.max(0, resultat.revenuNet)
    revenus.beneficesEncaisses += resultat.revenuNet
  } else {
    warnings.push("Aucune relation « Titulaire » vers une personne : le bénéfice de cette entreprise n'est rattaché à aucun foyer.")
    ctx.nonRattache += resultat.revenuNet
  }

  return {
    entityId: entreprise.id,
    name: entreprise.name,
    type: "company",
    statut: "EI au réel",
    chiffreAffaires: resultat.chiffreAffaires,
    charges: resultat.chargesDeductibles,
    cotisationsSociales: resultat.cotisationsSociales,
    impotSocietes: 0,
    revenuVerse: resultat.revenuNet,
    resultatConserve: 0,
    warnings
  }
}

function simulerMicroEntreprise(ctx: Contexte, micro: MicroEntreprise): ActivityResult {
  const resultat = calculerMicro(
    {
      caVente: total(ctx, micro.id, "ca_micro_vente"),
      caServicesBic: total(ctx, micro.id, "ca_micro_services_bic"),
      caServicesBnc: total(ctx, micro.id, "ca_micro_services_bnc"),
      beneficieACRE: micro.beneficieACRE,
      opteVFL: micro.opteVFL
    },
    ctx.regles
  )
  const warnings = [...resultat.warnings]
  // Au régime micro, les dépenses réelles ne réduisent ni les cotisations ni l'impôt : elles ne pèsent que sur la trésorerie.
  const depenses = total(ctx, micro.id, "expense")
  const revenuVerse = resultat.chiffreAffaires - resultat.cotisationsSociales - depenses

  const titulaire = personnesLiees(ctx, micro.id, ["Titulaire"])[0]
  if (titulaire) {
    const revenus = revenusDe(ctx, titulaire)
    revenus.beneficesImposables += resultat.revenuImposable
    revenus.versementLiberatoire += resultat.versementLiberatoire
    revenus.beneficesEncaisses += revenuVerse
  } else {
    warnings.push("Aucune relation « Titulaire » vers une personne : les revenus de cette micro-entreprise ne sont rattachés à aucun foyer.")
    ctx.nonRattache += revenuVerse
  }

  return {
    entityId: micro.id,
    name: micro.name,
    type: "micro-entreprise",
    statut: "Micro-entreprise",
    chiffreAffaires: resultat.chiffreAffaires,
    charges: depenses,
    cotisationsSociales: resultat.cotisationsSociales,
    impotSocietes: 0,
    revenuVerse,
    resultatConserve: 0,
    warnings
  }
}

function simulerActivite(ctx: Contexte, activite: Company | MicroEntreprise): ActivityResult {
  if (activite.type === "micro-entreprise") return simulerMicroEntreprise(ctx, activite)
  return activite.legalStatus === "EI" ? simulerEntrepriseIndividuelle(ctx, activite) : simulerSocieteIS(ctx, activite)
}

function arrondirActivite(activite: ActivityResult): ActivityResult {
  return {
    ...activite,
    chiffreAffaires: Math.round(activite.chiffreAffaires),
    charges: Math.round(activite.charges),
    cotisationsSociales: Math.round(activite.cotisationsSociales),
    impotSocietes: Math.round(activite.impotSocietes),
    revenuVerse: Math.round(activite.revenuVerse),
    resultatConserve: Math.round(activite.resultatConserve)
  }
}

function resultatPersonne(ctx: Contexte, personne: Person): PersonResult {
  const revenus = revenusDe(ctx, personne.id)
  return {
    entityId: personne.id,
    name: personne.name,
    revenusDirects: Math.round(total(ctx, personne.id, "salary", "are", "other_taxable_income")),
    revenusActivites: Math.round(encaisse(revenus)),
    detail: {
      salaires: Math.round(total(ctx, personne.id, "salary")),
      allocationsChomage: Math.round(total(ctx, personne.id, "are")),
      autresRevenus: Math.round(total(ctx, personne.id, "other_taxable_income")),
      remunerationsDirigeant: Math.round(revenus.remunerations),
      dividendes: Math.round(revenus.dividendesEncaisses),
      benefices: Math.round(revenus.beneficesEncaisses)
    },
    depenses: Math.round(total(ctx, personne.id, "expense"))
  }
}

/** Déduction forfaitaire pour frais professionnels sur les revenus imposés comme des salaires, par personne. */
function abattementSalaires(salaires: number, regles: ReglesFiscales["IR"]["abattementSalaires"]): number {
  const abattement = Math.min(Math.max(salaires * regles.taux, regles.minimum), regles.maximum)
  return Math.min(salaires, abattement)
}

/** Additionne les revenus de tous les membres d'un foyer, par traitement fiscal. */
function revenusDuFoyer(ctx: Contexte, foyer: Foyer) {
  const cumul = { baseBareme: 0, dividendes: 0, dividendesSoumisPS: 0, versementLiberatoire: 0, encaisse: 0, depenses: 0 }
  for (const personId of [...foyer.declarantIds, ...foyer.enfantIds]) {
    const revenus = revenusDe(ctx, personId)
    const salaires = total(ctx, personId, "salary", "are") + revenus.remunerations
    const autresRevenus = total(ctx, personId, "other_taxable_income")

    cumul.baseBareme += salaires - abattementSalaires(salaires, ctx.regles.IR.abattementSalaires) + autresRevenus + revenus.beneficesImposables
    cumul.dividendes += revenus.dividendes
    cumul.dividendesSoumisPS += revenus.dividendesSoumisPS
    cumul.versementLiberatoire += revenus.versementLiberatoire
    cumul.encaisse += total(ctx, personId, "salary", "are", "other_taxable_income") + encaisse(revenus)
    cumul.depenses += total(ctx, personId, "expense")
  }
  return cumul
}

/**
 * Impôt du foyer. Les dividendes sont imposés de la façon la plus favorable entre le prélèvement
 * forfaitaire et l'option pour le barème (abattement, CSG en partie déductible) ; les prélèvements
 * sociaux sont dus dans les deux cas.
 */
function calculerFoyer(ctx: Contexte, foyer: Foyer): FoyerFiscalResult {
  const { IR, dividendes: reglesDividendes } = ctx.regles
  const revenus = revenusDuFoyer(ctx, foyer)
  const quotient = { partsFiscales: foyer.totalParts, nombreDeclarants: foyer.nombreDeclarants }

  const impotForfaitaire = calculerIR({ revenuNetGlobalImposable: revenus.baseBareme, ...quotient }, IR) + revenus.dividendes * reglesDividendes.tauxIrForfaitaire
  const baseAvecDividendes = revenus.baseBareme + revenus.dividendes * (1 - reglesDividendes.abattementBareme) - revenus.dividendesSoumisPS * reglesDividendes.csgDeductible
  const impotAuBareme = calculerIR({ revenuNetGlobalImposable: baseAvecDividendes, ...quotient }, IR)
  const optionBareme = revenus.dividendes > 0 && impotAuBareme < impotForfaitaire

  const impotSurLeRevenu = (optionBareme ? impotAuBareme : impotForfaitaire) + revenus.versementLiberatoire
  const prelevementsSociaux = revenus.dividendesSoumisPS * reglesDividendes.prelevementsSociaux
  const optionDividendes = optionBareme ? "bareme" : "pfu"

  return {
    personIds: [...foyer.declarantIds, ...foyer.enfantIds],
    totalParts: foyer.totalParts,
    revenusEncaisses: Math.round(revenus.encaisse),
    revenuImposableGlobal: Math.round(Math.max(0, optionBareme ? baseAvecDividendes : revenus.baseBareme)),
    impotSurLeRevenu: Math.round(impotSurLeRevenu),
    prelevementsSociaux: Math.round(prelevementsSociaux),
    optionDividendes: revenus.dividendes > 0 ? optionDividendes : null,
    netApresImpots: Math.round(revenus.encaisse - impotSurLeRevenu - prelevementsSociaux),
    depenses: Math.round(revenus.depenses),
    warnings: foyer.warnings
  }
}

function somme<T>(elements: T[], valeur: (element: T) => number): number {
  return elements.reduce((cumul, element) => cumul + valeur(element), 0)
}

/** Vue d'ensemble : ce que produisent les activités et les revenus directs, et ce qui part en prélèvements. */
function calculerBilan(ctx: Contexte, activities: ActivityResult[], persons: PersonResult[], foyers: FoyerFiscalResult[]): SimulationBilan {
  const chiffreAffaires = somme(activities, a => a.chiffreAffaires)
  const charges = somme(activities, a => a.charges)
  const revenusDirects = somme(persons, p => p.revenusDirects)
  const cotisationsSociales = somme(activities, a => a.cotisationsSociales)
  const impotSocietes = somme(activities, a => a.impotSocietes)
  const impotSurLeRevenu = somme(foyers, f => f.impotSurLeRevenu)
  const prelevementsSociaux = somme(foyers, f => f.prelevementsSociaux)

  return {
    chiffreAffaires,
    charges,
    revenusDirects,
    revenusAvantPrelevements: chiffreAffaires - charges + revenusDirects,
    cotisationsSociales,
    impotSocietes,
    impotSurLeRevenu,
    prelevementsSociaux,
    totalPrelevements: cotisationsSociales + impotSocietes + impotSurLeRevenu + prelevementsSociaux,
    resultatConserve: somme(activities, a => a.resultatConserve),
    nonRattache: Math.round(ctx.nonRattache)
  }
}

export function runMetaSimulation(session: SessionState, regles: ReglesFiscales = reglesEnVigueur): SimulationReport {
  const ctx: Contexte = { session, regles, flux: aggregateAnnualFlowsByEntity(session), revenus: new Map(), nonRattache: 0 }

  // Les activités d'abord : elles alimentent les revenus des personnes, dont dépend l'impôt des foyers.
  const activities = session.entities.filter((e): e is Company | MicroEntreprise => e.type !== "person").map(activite => arrondirActivite(simulerActivite(ctx, activite)))
  const persons = session.entities.filter((e): e is Person => e.type === "person").map(personne => resultatPersonne(ctx, personne))
  const foyers = buildFoyers(session, regles.IR.partsParEnfant).map(foyer => calculerFoyer(ctx, foyer))

  return {
    annee: regles.annee,
    bilan: calculerBilan(ctx, activities, persons, foyers),
    activities,
    persons,
    foyers,
    totalNetApresImpots: somme(foyers, f => f.netApresImpots)
  }
}
