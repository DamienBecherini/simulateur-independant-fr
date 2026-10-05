// src/backend/logic/simulation-engine.ts

import type { VersementLiberatoireInfo, ActivityResult, Company, FinancialFlow, FoyerFiscalResult, FraisProfessionnelsResult, MicroEntreprise, Person, PersonResult, Relationship, SalarieDeLActivite, DonneesDeLAnnee, SimulationBilan, SimulationReport } from "../../types.js"
import { calculerMicro, plafondRfrVersementLiberatoire } from "./calculsAE.js"
import { calculerEI } from "./calculsEI.js"
import { calculerEURL } from "./calculsEURL.js"
import { calculerIR } from "./calculsIR.js"
import { calculerSASU } from "./calculsSASU.js"
import type { ResultatSociete } from "./calculsSociete.js"
import type { PartageDuBenefice } from "../../types.js"
import { brutPourUnNet, calculerCotisationsSalarie } from "./cotisationsSalarie.js"
import { buildFoyers, type Foyer } from "./foyers.js"
import { euros } from "./format.js"
import { fraisReelsDeLaPersonne, montantBaremeKilometrique } from "./frais-kilometriques.js"
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
function encaisse(revenus: RevenusDActivite): number {
  return revenus.remunerations + revenus.dividendesEncaisses + revenus.beneficesEncaisses
}

interface Contexte {
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
const RELATIONS_D_ASSOCIE: Relationship["type"][] = ["Président", "Gérant", "Associé"]
const RELATIONS_D_EXPLOITANT: Relationship["type"][] = ["Titulaire", "Président", "Gérant"]

function aggregateAnnualFlowsByEntity(session: DonneesDeLAnnee): Map<string, FlowTotals> {
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
function bulletinsDesSalaries(session: DonneesDeLAnnee, flux: Map<string, FlowTotals>, regles: ReglesFiscales): Contexte["salaries"] {
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
function cotisationsSalarialesParPersonne(session: DonneesDeLAnnee, flux: Map<string, FlowTotals>, salaries: Contexte["salaries"]): Map<string, number> {
  const cotisations = aggregateSalaryContributions(session)
  for (const [personId, { bulletin }] of salaries) cotisations.set(personId, bulletin.brut - (flux.get(personId)?.salary ?? 0))
  return cotisations
}

/**
 * Masse salariale d'une activité : ses salariés, leurs salaires bruts (des charges) et les cotisations patronales
 * nettes de la réduction générale (des cotisations sociales), le tout déductible du résultat.
 */
function masseSalariale(ctx: Contexte, activiteId: string) {
  const salaries = [...ctx.salaries.values()].filter(s => s.employeurId === activiteId).map(s => s.bulletin)
  const bruts = somme(salaries, s => s.brut)
  const patronales = somme(salaries, s => s.coutEmployeur - s.brut)
  return { salaries, bruts, patronales, cout: bruts + patronales }
}

/** Champs du résultat d'une activité qui décrivent ses salariés, s'il en a. */
function detailSalaries(masse: ReturnType<typeof masseSalariale>): Pick<ActivityResult, "salaries"> {
  return masse.salaries.length > 0 ? { salaries: masse.salaries } : {}
}

/**
 * Déplacements professionnels d'une activité avec une voiture personnelle, au barème kilométrique de l'année : une charge
 * réelle. En société, ce sont les indemnités kilométriques remboursées au dirigeant : déductibles pour la société, ni
 * imposables ni soumises à cotisations pour lui (article 81, 1° du CGI), et neutres pour sa trésorerie, puisqu'elles
 * couvrent les frais de voiture qu'il a payés. En entreprise individuelle, une charge déductible (option des BNC pour le
 * barème ; en BIC, une approximation des frais réels de la voiture). En micro-entreprise, une dépense jamais déductible.
 */
function deplacementsProfessionnels(ctx: Contexte, activite: Company | MicroEntreprise): number {
  const deplacements = activite.deplacementsProfessionnels
  return deplacements ? montantBaremeKilometrique(deplacements.kmParAn, deplacements, ctx.regles.baremeKilometrique) : 0
}

/** Champ du résultat d'une activité qui décrit ses déplacements professionnels, s'il y en a. */
function detailDeplacements(activite: Company | MicroEntreprise, montant: number, deductible: boolean): Pick<ActivityResult, "fraisDeDeplacement"> {
  const kilometres = activite.deplacementsProfessionnels?.kmParAn ?? 0
  return montant > 0 ? { fraisDeDeplacement: { kilometres, montant: Math.round(montant), deductible } } : {}
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
    revenus = { remunerations: 0, remunerationsImposables: 0, beneficesImposables: 0, dividendes: 0, dividendesSoumisPS: 0, versementLiberatoire: 0, revenusAuVersementLiberatoire: 0, dividendesEncaisses: 0, beneficesEncaisses: 0, prelevementsActivites: 0, resultatConserve: 0 }
    ctx.revenus.set(personId, revenus)
  }
  return revenus
}

/** La rémunération du dirigeant est versée à la première personne reliée par « Président » ou « Gérant ». */
function verserRemuneration(ctx: Contexte, societe: Company, remuneration: { nette: number; imposable: number; cotisations: number }, warnings: string[]) {
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
function attribuerResultatSociete(ctx: Contexte, societe: Company, resultat: { impotSocietes: number; cotisationsSurDividendes: number; resultatConserve: number }) {
  const associes = personnesLiees(ctx, societe.id, RELATIONS_D_ASSOCIE)
  for (const associe of associes) {
    const revenus = revenusDe(ctx, associe)
    revenus.prelevementsActivites += (resultat.impotSocietes + resultat.cotisationsSurDividendes) / associes.length
    revenus.resultatConserve += resultat.resultatConserve / associes.length
  }
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
  const masse = masseSalariale(ctx, societe.id)
  const deplacements = deplacementsProfessionnels(ctx, societe)
  const entrees = {
    chiffreAffaires: total(ctx, societe.id, "ca_services", "ca_vente"),
    chargesDeductibles: total(ctx, societe.id, "deductible_expense") + masse.cout + deplacements,
    remunerationNette: total(ctx, societe.id, "director_remuneration"),
    dividendesDemandes: total(ctx, societe.id, "dividends_payment")
  }
  const resultat = societe.legalStatus === "SASU" ? calculerSASU(entrees, ctx.regles) : calculerEURL({ ...entrees, capitalSocial: societe.capitalSocial }, ctx.regles)
  const warnings = [...resultat.warnings]

  verserRemuneration(ctx, societe, { nette: resultat.remunerationNette, imposable: resultat.remunerationImposable, cotisations: resultat.cotisationsSociales - resultat.cotisationsSurDividendes }, warnings)
  attribuerResultatSociete(ctx, societe, resultat)
  verserDividendes(ctx, societe, { verses: resultat.dividendesVerses, soumisPS: resultat.dividendesSoumisPS, cotisations: resultat.cotisationsSurDividendes }, warnings)

  return {
    entityId: societe.id,
    name: societe.name,
    type: "company",
    statut: societe.legalStatus,
    chiffreAffaires: resultat.chiffreAffaires,
    // Les salaires bruts sont des charges, les cotisations patronales des cotisations sociales.
    charges: resultat.chargesDeductibles - masse.patronales,
    cotisationsSociales: resultat.cotisationsSociales + masse.patronales,
    impotSocietes: resultat.impotSocietes,
    revenuVerse: resultat.remunerationNette + resultat.dividendesVerses - resultat.cotisationsSurDividendes,
    resultatConserve: resultat.resultatConserve,
    beneficiaireIds: personnesLiees(ctx, societe.id, RELATIONS_D_ASSOCIE),
    ...(resultat.cotisationsTNS ? { cotisationsTNS: resultat.cotisationsTNS } : {}),
    ...(resultat.cotisationsPresident && resultat.remunerationNette > 0 ? { cotisationsPresident: resultat.cotisationsPresident } : {}),
    ...detailSalaries(masse),
    ...detailDeplacements(societe, deplacements, true),
    partage: partageDuBenefice(resultat),
    warnings
  }
}

/** Le bénéfice avant rémunération du dirigeant, poste par poste : la somme des postes le redonne exactement. */
function partageDuBenefice(resultat: ResultatSociete): PartageDuBenefice {
  const cotisationsRemuneration = resultat.cotisationsSociales - resultat.cotisationsSurDividendes
  return {
    beneficeAvantRemuneration: resultat.chiffreAffaires - resultat.chargesDeductibles,
    remunerationNette: resultat.remunerationNette,
    cotisationsRemuneration,
    impotSocietes: resultat.impotSocietes,
    dividendesNets: resultat.dividendesVerses - resultat.cotisationsSurDividendes,
    cotisationsSurDividendes: resultat.cotisationsSurDividendes,
    resultatConserve: resultat.resultatConserve
  }
}

function simulerEntrepriseIndividuelle(ctx: Contexte, entreprise: Company): ActivityResult {
  const masse = masseSalariale(ctx, entreprise.id)
  const deplacements = deplacementsProfessionnels(ctx, entreprise)
  const resultat = calculerEI({ chiffreAffaires: total(ctx, entreprise.id, "ca_services", "ca_vente"), chargesDeductibles: total(ctx, entreprise.id, "deductible_expense") + masse.cout + deplacements }, ctx.regles)
  const warnings = [...resultat.warnings]

  if (total(ctx, entreprise.id, "director_remuneration", "dividends_payment") > 0) {
    warnings.push("Une entreprise individuelle ne verse ni rémunération de dirigeant ni dividendes : ces flux sont ignorés, tout le bénéfice revient à l'entrepreneur.")
  }

  const exploitant = personnesLiees(ctx, entreprise.id, RELATIONS_D_EXPLOITANT)[0]
  if (exploitant) {
    const revenus = revenusDe(ctx, exploitant)
    // Un déficit d'entreprise individuelle au réel s'impute sur les autres revenus du foyer (article 156 du CGI).
    revenus.beneficesImposables += resultat.revenuImposable
    revenus.beneficesEncaisses += resultat.revenuNet
    revenus.prelevementsActivites += resultat.cotisationsSociales
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
    charges: resultat.chargesDeductibles - masse.patronales,
    cotisationsSociales: resultat.cotisationsSociales + masse.patronales,
    impotSocietes: 0,
    revenuVerse: resultat.revenuNet,
    resultatConserve: 0,
    beneficiaireIds: exploitant ? [exploitant] : [],
    cotisationsTNS: resultat.cotisationsTNS,
    ...detailSalaries(masse),
    ...detailDeplacements(entreprise, deplacements, true),
    warnings
  }
}

/**
 * Accès au versement libératoire : le revenu fiscal de référence N-2 du foyer du titulaire
 * ne doit pas dépasser un seuil proportionnel à son nombre de parts.
 */
function analyserVersementLiberatoire(ctx: Contexte, micro: MicroEntreprise, titulaire: string | undefined): VersementLiberatoireInfo {
  const foyer = titulaire ? ctx.foyers.find(f => f.declarantIds.includes(titulaire) || f.enfantIds.includes(titulaire)) : undefined
  const partsFiscales = foyer?.totalParts ?? 1
  const plafondRfr = plafondRfrVersementLiberatoire(partsFiscales, ctx.regles)
  const { rfrN2, origineRfr } = rfrDuTitulaire(ctx, micro, titulaire)
  const eligible = rfrN2 === null ? null : rfrN2 <= plafondRfr
  const anneeRfr = (ctx.annee.annee ?? ctx.regles.annee) - 2
  return { plafondRfr, partsFiscales, rfrN2, anneeRfr, origineRfr, eligible, applique: micro.opteVFL && eligible !== false }
}

/**
 * Revenu fiscal de référence N-2 du foyer du titulaire : celui que la simulation a calculé quand l'année N-2 en fait
 * partie, sinon celui saisi dans la fiche de la micro-entreprise.
 */
function rfrDuTitulaire(ctx: Contexte, micro: MicroEntreprise, titulaire: string | undefined): Pick<VersementLiberatoireInfo, "rfrN2" | "origineRfr"> {
  const calcule = titulaire === undefined ? undefined : ctx.annee.rfrN2?.parPersonne[titulaire]
  if (calcule !== undefined) return { rfrN2: calcule, origineRfr: "calcule" }
  if (micro.rfrN2 !== undefined) return { rfrN2: micro.rfrN2, origineRfr: "saisi" }
  return { rfrN2: null, origineRfr: null }
}

function avertissementsVersementLiberatoire(micro: MicroEntreprise, vfl: VersementLiberatoireInfo): string[] {
  if (!micro.opteVFL) return []
  const parts = vfl.partsFiscales.toLocaleString("fr-FR")
  if (vfl.eligible === false) {
    const origine = vfl.origineRfr === "calcule" ? "calculé par la simulation" : "saisi dans la fiche"
    return [`Versement libératoire impossible : le revenu fiscal de référence ${vfl.anneeRfr} (${euros(vfl.rfrN2 ?? 0)}, ${origine}) dépasse le seuil de ${euros(vfl.plafondRfr)} pour ${parts} part(s). L'impôt est calculé au barème.`]
  }
  if (vfl.eligible === null) {
    return [`Versement libératoire : il n'est ouvert que si le revenu fiscal de référence ${vfl.anneeRfr} du foyer ne dépasse pas ${euros(vfl.plafondRfr)} pour ${parts} part(s). Ajoutez l'année ${vfl.anneeRfr} à la simulation pour qu'il soit calculé, ou renseignez-le dans la fiche de la micro-entreprise.`]
  }
  return []
}

function simulerMicroEntreprise(ctx: Contexte, micro: MicroEntreprise): ActivityResult {
  const titulaire = personnesLiees(ctx, micro.id, ["Titulaire"])[0]
  const vfl = analyserVersementLiberatoire(ctx, micro, titulaire)
  const resultat = calculerMicro(
    {
      caVente: total(ctx, micro.id, "ca_micro_vente"),
      caServicesBic: total(ctx, micro.id, "ca_micro_services_bic"),
      caServicesBnc: total(ctx, micro.id, "ca_micro_services_bnc"),
      beneficieACRE: micro.beneficieACRE,
      opteVFL: vfl.applique
    },
    ctx.regles
  )
  const warnings = [...resultat.warnings, ...avertissementsVersementLiberatoire(micro, vfl)]
  // Au régime micro, les dépenses réelles ne réduisent ni les cotisations ni l'impôt : elles ne pèsent que sur la trésorerie.
  // Il en va de même du coût des salariés et des déplacements professionnels.
  const masse = masseSalariale(ctx, micro.id)
  const deplacements = deplacementsProfessionnels(ctx, micro)
  const depenses = total(ctx, micro.id, "expense") + masse.cout + deplacements
  const revenuVerse = resultat.chiffreAffaires - resultat.cotisationsSociales - depenses

  if (titulaire) {
    const revenus = revenusDe(ctx, titulaire)
    revenus.beneficesImposables += resultat.revenuImposable
    revenus.versementLiberatoire += resultat.versementLiberatoire
    if (vfl.applique) revenus.revenusAuVersementLiberatoire += resultat.revenuApresAbattement
    revenus.beneficesEncaisses += revenuVerse
    revenus.prelevementsActivites += resultat.cotisationsSociales
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
    charges: depenses - masse.patronales,
    cotisationsSociales: resultat.cotisationsSociales + masse.patronales,
    impotSocietes: 0,
    revenuVerse,
    resultatConserve: 0,
    beneficiaireIds: titulaire ? [titulaire] : [],
    versementLiberatoire: { ...vfl, plafondRfr: Math.round(vfl.plafondRfr) },
    ...detailSalaries(masse),
    ...detailDeplacements(micro, deplacements, false),
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
    cotisationsSalariales: Math.round(ctx.cotisationsSalariales.get(personne.id) ?? 0),
    depenses: Math.round(total(ctx, personne.id, "expense")),
    ...detailFraisProfessionnels(ctx, personne)
  }
}

/** La déduction retenue, pour une personne qui a saisi des frais réels et perçoit des revenus imposés comme des salaires. */
function detailFraisProfessionnels(ctx: Contexte, personne: Person): Pick<PersonResult, "fraisProfessionnels"> {
  if (!personne.fraisReels) return {}
  const frais = fraisProfessionnels(ctx, personne.id)
  if (frais.revenusSalariaux <= 0) return {}
  return {
    fraisProfessionnels: {
      ...frais,
      revenusSalariaux: Math.round(frais.revenusSalariaux),
      deductionForfaitaire: Math.round(frais.deductionForfaitaire),
      fraisReels: Math.round(frais.fraisReels),
      fraisDeTrajet: Math.round(frais.fraisDeTrajet),
      distanceRetenue: Math.round(frais.distanceRetenue),
      deduction: Math.round(frais.deduction)
    }
  }
}

/** Déduction forfaitaire pour frais professionnels sur les revenus imposés comme des salaires, par personne. */
function abattementSalaires(salaires: number, regles: ReglesFiscales["IR"]["abattementSalaires"]): number {
  const abattement = Math.min(Math.max(salaires * regles.taux, regles.minimum), regles.maximum)
  return Math.min(salaires, abattement)
}

/**
 * Revenus imposés comme des salaires d'une personne : salaires et allocations chômage saisis, rémunérations de dirigeant
 * (président de SASU, gérant d'EURL) imposables. Salarié d'une activité de la simulation : sa CSG non déductible et sa
 * CRDS s'ajoutent au net imposable. Ni les bénéfices (micro, EI) ni les dividendes n'en font partie.
 */
function revenusSalariaux(ctx: Contexte, personId: string): number {
  const salarie = ctx.salaries.get(personId)?.bulletin
  return total(ctx, personId, "salary", "are") + revenusDe(ctx, personId).remunerationsImposables + (salarie?.partNonDeductible ?? 0)
}

/**
 * Déduction pour frais professionnels d'une personne (article 83, 3° du CGI) : la déduction forfaitaire de 10 % (avec son
 * minimum et son maximum), ou ses frais réels s'ils sont plus élevés. Le choix vaut pour l'ensemble de ses revenus
 * imposés comme des salaires. Simplification : la déduction ne dépasse jamais ces revenus (pas de déficit).
 */
function fraisProfessionnels(ctx: Contexte, personId: string): FraisProfessionnelsResult {
  const salaires = revenusSalariaux(ctx, personId)
  const deductionForfaitaire = abattementSalaires(salaires, ctx.regles.IR.abattementSalaires)
  const personne = ctx.session.entities.find((e): e is Person => e.id === personId && e.type === "person")
  const reels = personne?.fraisReels ? fraisReelsDeLaPersonne(personne.fraisReels, ctx.regles.baremeKilometrique) : { distanceRetenue: 0, fraisDeTrajet: 0, total: 0 }
  const retenue = salaires > 0 && reels.total > deductionForfaitaire ? "reels" : "forfait"
  return {
    revenusSalariaux: salaires,
    deductionForfaitaire,
    fraisReels: reels.total,
    fraisDeTrajet: reels.fraisDeTrajet,
    distanceRetenue: reels.distanceRetenue,
    retenue,
    deduction: retenue === "reels" ? Math.min(salaires, reels.total) : deductionForfaitaire
  }
}

/** Additionne les revenus de tous les membres d'un foyer, par traitement fiscal. */
function revenusDuFoyer(ctx: Contexte, foyer: Foyer) {
  const cumul = { baseBareme: 0, dividendes: 0, dividendesSoumisPS: 0, versementLiberatoire: 0, revenusAuVersementLiberatoire: 0, encaisse: 0, depenses: 0, prelevementsActivites: 0, resultatConserve: 0 }
  for (const personId of [...foyer.declarantIds, ...foyer.enfantIds]) {
    const revenus = revenusDe(ctx, personId)
    const salarie = ctx.salaries.get(personId)?.bulletin
    const frais = fraisProfessionnels(ctx, personId)
    const autresRevenus = total(ctx, personId, "other_taxable_income")

    cumul.baseBareme += frais.revenusSalariaux - frais.deduction + autresRevenus + revenus.beneficesImposables
    cumul.dividendes += revenus.dividendes
    cumul.dividendesSoumisPS += revenus.dividendesSoumisPS
    cumul.versementLiberatoire += revenus.versementLiberatoire
    cumul.revenusAuVersementLiberatoire += revenus.revenusAuVersementLiberatoire
    cumul.encaisse += total(ctx, personId, "salary", "are", "other_taxable_income") + encaisse(revenus)
    cumul.depenses += total(ctx, personId, "expense")
    // Les cotisations patronales de son salaire comptent parmi les prélèvements de son foyer.
    cumul.prelevementsActivites += revenus.prelevementsActivites + (ctx.cotisationsSalariales.get(personId) ?? 0) + (salarie ? salarie.coutEmployeur - salarie.brut : 0)
    cumul.resultatConserve += revenus.resultatConserve
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
  const revenuImposableGlobal = Math.max(0, optionBareme ? baseAvecDividendes : revenus.baseBareme)
  // Revenu fiscal de référence : on rajoute ce que le barème ne voit pas. Au prélèvement forfaitaire, les dividendes
  // bruts ; au barème, l'abattement de 40 % (le reste y est déjà, net de la CSG déductible).
  const dividendesHorsBareme = optionBareme ? revenus.dividendes * reglesDividendes.abattementBareme : revenus.dividendes
  const revenuFiscalDeReference = revenuImposableGlobal + dividendesHorsBareme + revenus.revenusAuVersementLiberatoire

  return {
    personIds: [...foyer.declarantIds, ...foyer.enfantIds],
    totalParts: foyer.totalParts,
    revenusEncaisses: Math.round(revenus.encaisse),
    revenuImposableGlobal: Math.round(revenuImposableGlobal),
    revenuFiscalDeReference: Math.round(revenuFiscalDeReference),
    impotSurLeRevenu: Math.round(impotSurLeRevenu),
    prelevementsSociaux: Math.round(prelevementsSociaux),
    optionDividendes: revenus.dividendes > 0 ? optionDividendes : null,
    netApresImpots: Math.round(revenus.encaisse - impotSurLeRevenu - prelevementsSociaux),
    // Tout ce que le foyer produit se retrouve soit encaissé, soit prélevé en amont, soit conservé en société.
    revenusAvantPrelevements: Math.round(revenus.encaisse + revenus.prelevementsActivites + revenus.resultatConserve),
    totalPrelevements: Math.round(revenus.prelevementsActivites + impotSurLeRevenu + prelevementsSociaux),
    resultatConserve: Math.round(revenus.resultatConserve),
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
  const cotisationsSalariales = somme(persons, p => p.cotisationsSalariales)
  const cotisationsSociales = somme(activities, a => a.cotisationsSociales)
  const impotSocietes = somme(activities, a => a.impotSocietes)
  const impotSurLeRevenu = somme(foyers, f => f.impotSurLeRevenu)
  const prelevementsSociaux = somme(foyers, f => f.prelevementsSociaux)

  return {
    chiffreAffaires,
    charges,
    revenusDirects,
    cotisationsSalariales,
    revenusAvantPrelevements: chiffreAffaires - charges + revenusDirects + cotisationsSalariales,
    cotisationsSociales,
    impotSocietes,
    impotSurLeRevenu,
    prelevementsSociaux,
    totalPrelevements: cotisationsSociales + cotisationsSalariales + impotSocietes + impotSurLeRevenu + prelevementsSociaux,
    resultatConserve: somme(activities, a => a.resultatConserve),
    nonRattache: Math.round(ctx.nonRattache)
  }
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
}

export function runMetaSimulation(session: DonneesDeLAnnee, regles: ReglesFiscales = reglesEnVigueur, contexte: ContexteDeLAnnee = {}): SimulationReport {
  const foyersFiscaux = buildFoyers(session, regles.IR.partsParEnfant)
  const flux = aggregateAnnualFlowsByEntity(session)
  const salaries = bulletinsDesSalaries(session, flux, regles)
  const ctx: Contexte = { session, regles, annee: contexte, foyers: foyersFiscaux, flux, cotisationsSalariales: cotisationsSalarialesParPersonne(session, flux, salaries), salaries, revenus: new Map(), nonRattache: 0 }

  // Les activités d'abord : elles alimentent les revenus des personnes, dont dépend l'impôt des foyers.
  const activities = session.entities.filter((e): e is Company | MicroEntreprise => e.type !== "person").map(activite => arrondirActivite(simulerActivite(ctx, activite)))
  const persons = session.entities.filter((e): e is Person => e.type === "person").map(personne => resultatPersonne(ctx, personne))
  const foyers = foyersFiscaux.map(foyer => calculerFoyer(ctx, foyer))

  return {
    annee: contexte.annee ?? regles.annee,
    anneeDesRegles: regles.annee,
    avertissements: contexte.avertissements ?? [],
    bilan: calculerBilan(ctx, activities, persons, foyers),
    activities,
    persons,
    foyers,
    totalNetApresImpots: somme(foyers, f => f.netApresImpots)
  }
}
