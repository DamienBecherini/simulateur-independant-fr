// src/backend/logic/comparateur.ts

import type { StatutFrais, Company, ComparaisonCouple, ComparaisonOptions, ComparaisonResult, FinancialFlow, MicroEntreprise, Relationship, ScenarioStatut, DonneesDeLAnnee, SimulationReport, StatutCompare } from "../../types.js"
import { reglesEnVigueur, type ReglesFiscales } from "./regles.js"
import { evaluerProtectionSociale } from "./protection-sociale.js"
import { runMetaSimulation } from "./simulation-engine.js"

/*
 * Comparateur de statuts : l'activité choisie est convertie dans chaque statut (SASU, EURL, entreprise
 * individuelle au réel, micro-entreprise avec et sans versement libératoire), puis toute la simulation est
 * relancée. Le reste de la session (autres activités, salaires, foyers) ne change pas : l'écart entre deux
 * colonnes vient donc uniquement du statut de cette activité.
 */

export const STATUTS_COMPARES: StatutCompare[] = ["SASU", "EURL", "EI", "micro", "micro-vfl"]

const LIBELLES: Record<StatutCompare, string> = {
  SASU: "SASU",
  EURL: "EURL",
  EI: "EI au réel",
  micro: "Micro-entreprise",
  "micro-vfl": "Micro + versement libératoire"
}

export type Activite = Company | MicroEntreprise
type Nature = "vente" | "services" | "bic" | "bnc" | "charges" | "remuneration" | "dividendes" | "autre"

const NATURE_DES_FLUX: Partial<Record<FinancialFlow["type"], Nature>> = {
  ca_vente: "vente",
  ca_micro_vente: "vente",
  ca_services: "services",
  ca_micro_services_bic: "bic",
  ca_micro_services_bnc: "bnc",
  deductible_expense: "charges",
  expense: "charges",
  director_remuneration: "remuneration",
  dividends_payment: "dividendes"
}

export function estSocieteIS(statut: StatutCompare): statut is "SASU" | "EURL" {
  return statut === "SASU" || statut === "EURL"
}

export function statutActuel(activite: Activite): StatutCompare {
  if (activite.type === "micro-entreprise") return activite.opteVFL ? "micro-vfl" : "micro"
  return activite.legalStatus
}

/** Type d'un flux de l'activité dans le statut cible ; `null` si le flux n'y a pas d'équivalent. */
function typeCible(nature: Nature, statut: StatutCompare): FinancialFlow["type"] | null {
  if (statut === "micro" || statut === "micro-vfl") {
    const pourMicro: Partial<Record<Nature, FinancialFlow["type"]>> = { vente: "ca_micro_vente", bic: "ca_micro_services_bic", bnc: "ca_micro_services_bnc", charges: "expense" }
    return pourMicro[nature] ?? null
  }
  const pourReel: Partial<Record<Nature, FinancialFlow["type"]>> = { vente: "ca_vente", services: "ca_services", bic: "ca_services", bnc: "ca_services", charges: "deductible_expense" }
  return pourReel[nature] ?? null
}

/**
 * Convertit un flux de l'activité vers le statut cible. Les prestations d'une société deviennent, en micro,
 * du BNC ou du BIC selon la part choisie ; la rémunération et les dividendes sont recalculés à part.
 */
function convertirFlux(flux: FinancialFlow, statut: StatutCompare, partBnc: number): FinancialFlow[] {
  const nature = NATURE_DES_FLUX[flux.type] ?? "autre"
  if (nature === "autre") return [flux]
  if (nature === "remuneration" || nature === "dividendes") return []

  if (nature === "services" && (statut === "micro" || statut === "micro-vfl")) {
    const parts: [FinancialFlow["type"], number][] = [
      ["ca_micro_services_bnc", flux.amount * partBnc],
      ["ca_micro_services_bic", flux.amount * (1 - partBnc)]
    ]
    return parts.filter(([, amount]) => amount > 0).map(([type, amount]) => ({ ...flux, id: `${flux.id}-${type}`, type, amount, grossAmount: undefined }))
  }

  const type = typeCible(nature, statut)
  return type ? [{ ...flux, type }] : []
}

/** Personnes reliées à l'activité : la principale (dirigeant ou titulaire) et les autres associés. */
function personnesDeLActivite(session: DonneesDeLAnnee, activiteId: string): { principale: string | undefined; associes: string[] } {
  const personIds = new Set(session.entities.filter(e => e.type === "person").map(e => e.id))
  const liees = (types: Relationship["type"][]) =>
    session.relationships.filter(rel => types.includes(rel.type) && (rel.fromId === activiteId || rel.toId === activiteId)).map(rel => (rel.fromId === activiteId ? rel.toId : rel.fromId)).filter(id => personIds.has(id))

  const principale = liees(["Président", "Gérant", "Titulaire"])[0] ?? liees(["Associé"])[0]
  const associes = [...new Set(liees(["Associé"]))].filter(id => id !== principale)
  return { principale, associes }
}

function entiteCible(source: Activite, statut: StatutCompare): Activite {
  const commun = { id: source.id, name: source.name, avatar: source.avatar, locked: source.locked }
  if (statut === "micro" || statut === "micro-vfl") {
    const micro = source.type === "micro-entreprise" ? source : undefined
    return { ...commun, type: "micro-entreprise", beneficieACRE: micro?.beneficieACRE ?? false, opteVFL: statut === "micro-vfl", ...(micro?.rfrN2 !== undefined ? { rfrN2: micro.rfrN2 } : {}) }
  }
  const capitalSource = source.type === "company" && source.legalStatus !== "EI" ? source.capitalSocial : 1000
  return { ...commun, type: "company", legalStatus: statut, capitalSocial: statut === "EI" ? 0 : capitalSource }
}

function relationsCibles(session: DonneesDeLAnnee, source: Activite, statut: StatutCompare): Relationship[] {
  const { principale, associes } = personnesDeLActivite(session, source.id)
  // Les salariés de l'activité le restent dans tous les statuts : leur coût employeur pèse sur chaque colonne.
  const autres = session.relationships.filter(rel => rel.type === "Salarié" || (rel.fromId !== source.id && rel.toId !== source.id))
  if (!principale) return autres

  const lien = (personId: string, type: Relationship["type"]): Relationship => ({ id: `comparateur-${source.id}-${personId}-${type}`, fromId: personId, toId: source.id, type })
  if (!estSocieteIS(statut)) return [...autres, lien(principale, "Titulaire")]
  return [...autres, lien(principale, statut === "SASU" ? "Président" : "Gérant"), ...associes.map(id => lien(id, "Associé"))]
}

/** Session dans laquelle l'activité a pris le statut demandé, avec ses flux convertis. */
function sessionConvertie(session: DonneesDeLAnnee, source: Activite, statut: StatutCompare, options: ComparaisonOptions, dividendes: number | null): DonneesDeLAnnee {
  const partBnc = Math.min(1, Math.max(0, options.partBncPrestations))
  const monthlyData = session.monthlyData.map(mois => ({
    ...mois,
    flows: mois.flows.flatMap(flux => {
      if (flux.entityId !== source.id) return [flux]
      // Les dividendes saisis sont conservés tels quels quand on ne distribue pas tout le bénéfice.
      if (flux.type === "dividends_payment" && estSocieteIS(statut) && dividendes === null) return [flux]
      return convertirFlux(flux, statut, partBnc)
    })
  }))

  // La rémunération et les dividendes calculés sont saisis sur janvier : seuls les totaux annuels comptent.
  const ajouts: FinancialFlow[] = []
  if (estSocieteIS(statut) && options.remunerationNette > 0) {
    ajouts.push({ id: `comparateur-${source.id}-remuneration`, label: "Rémunération (comparateur)", amount: options.remunerationNette, entityId: source.id, type: "director_remuneration" })
  }
  if (estSocieteIS(statut) && dividendes !== null && dividendes > 0) {
    ajouts.push({ id: `comparateur-${source.id}-dividendes`, label: "Dividendes (comparateur)", amount: dividendes, entityId: source.id, type: "dividends_payment" })
  }
  const frais = fraisDuStatut(statut, options)
  if (frais > 0) {
    // Déductibles en société et en EI ; en micro, une simple dépense qui ne réduit ni cotisations ni impôt.
    ajouts.push({ id: `comparateur-${source.id}-frais`, label: "Frais de fonctionnement (comparateur)", amount: frais, entityId: source.id, type: statut === "micro" || statut === "micro-vfl" ? "expense" : "deductible_expense" })
  }
  monthlyData[0] = { ...monthlyData[0], flows: [...monthlyData[0].flows, ...ajouts] }

  return {
    ...session,
    entities: session.entities.map(e => (e.id === source.id ? entiteCible(source, statut) : e)),
    relationships: relationsCibles(session, source, statut),
    monthlyData
  }
}

/** Total annuel des frais de fonctionnement saisis pour un statut. */
export function fraisDuStatut(statut: StatutCompare, options: ComparaisonOptions): number {
  const cle: StatutFrais = statut === "micro-vfl" ? "micro" : statut
  const postes = options.fraisFonctionnement?.[cle]
  return postes ? Object.values(postes).reduce((somme, montant) => somme + Math.max(0, montant), 0) : 0
}

/** Chiffre d'affaires annuel par nature de l'activité, une fois convertie dans le statut. */
function chiffreAffairesMicro(session: DonneesDeLAnnee, activiteId: string) {
  const total = (type: FinancialFlow["type"]) => session.monthlyData.flatMap(m => m.flows).filter(f => f.entityId === activiteId && f.type === type).reduce((somme, f) => somme + f.amount, 0)
  return { caVente: total("ca_micro_vente"), caServicesBic: total("ca_micro_services_bic"), caServicesBnc: total("ca_micro_services_bnc") }
}

function scenario(statut: StatutCompare, actuel: boolean, simulation: Simulation, activiteId: string, options: ComparaisonOptions, regles: ReglesFiscales): ScenarioStatut {
  const { report } = simulation
  const { bilan } = report
  const activite = report.activities.find(a => a.entityId === activiteId)
  return {
    statut,
    libelle: LIBELLES[statut],
    actuel,
    fraisFonctionnement: fraisDuStatut(statut, options),
    protectionSociale: evaluerProtectionSociale(statut, { remunerationBrute: activite?.cotisationsPresident?.brut ?? 0, assietteTNS: activite?.cotisationsTNS?.assiette ?? 0, chiffreAffairesMicro: chiffreAffairesMicro(simulation.session, activiteId), beneficieACRE: simulation.session.entities.some(e => e.id === activiteId && e.type === "micro-entreprise" && e.beneficieACRE) }, regles),
    netApresImpots: report.totalNetApresImpots,
    revenusAvantPrelevements: bilan.revenusAvantPrelevements,
    totalPrelevements: bilan.totalPrelevements,
    cotisationsSociales: bilan.cotisationsSociales + bilan.cotisationsSalariales,
    impotSocietes: bilan.impotSocietes,
    impotSurLeRevenu: bilan.impotSurLeRevenu,
    prelevementsSociaux: bilan.prelevementsSociaux,
    resultatConserve: bilan.resultatConserve,
    resultatConserveActivite: Math.round(activite?.resultatConserve ?? 0),
    warnings: activite?.warnings ?? []
  }
}

interface Simulation {
  report: SimulationReport
  session: DonneesDeLAnnee
  /** Dividendes calculés pour verser tout le bénéfice ; `null` quand ce sont ceux de la grille. */
  dividendes: number | null
}

function simulerStatut(session: DonneesDeLAnnee, source: Activite, statut: StatutCompare, options: ComparaisonOptions, regles: ReglesFiscales): Simulation {
  if (!estSocieteIS(statut) || !options.distribuerToutLeBenefice) {
    const convertie = sessionConvertie(session, source, statut, options, null)
    return { report: runMetaSimulation(convertie, regles), session: convertie, dividendes: null }
  }
  // Pour tout distribuer, on verse ce qui reste dans la société, et on recommence tant qu'il reste quelque chose :
  // les cotisations dépendent des dividendes (minimum du gérant d'EURL, part au-delà de 10 % du capital).
  let dividendes = 0
  let convertie = sessionConvertie(session, source, statut, options, dividendes)
  let report = runMetaSimulation(convertie, regles)
  for (let tour = 0; tour < 5; tour++) {
    const reste = report.activities.find(a => a.entityId === source.id)?.resultatConserve ?? 0
    if (reste < 1) break
    dividendes += reste
    convertie = sessionConvertie(session, source, statut, options, dividendes)
    report = runMetaSimulation(convertie, regles)
  }
  return { report, session: convertie, dividendes }
}

/** Simule l'activité dans un statut, avec les réglages donnés : la colonne du comparateur et les dividendes versés. */
export function simulerScenario(session: DonneesDeLAnnee, source: Activite, statut: StatutCompare, options: ComparaisonOptions, regles: ReglesFiscales = reglesEnVigueur): { scenario: ScenarioStatut; dividendes: number | null } {
  const simulation = simulerStatut(session, source, statut, options, regles)
  return { scenario: scenario(statut, statut === statutActuel(source), simulation, source.id, options, regles), dividendes: simulation.dividendes }
}

/** Bénéfice après impôt sur les sociétés que la société garde avec cette rémunération, avant tout dividende. */
export function beneficeAvantDividendes(session: DonneesDeLAnnee, source: Activite, statut: "SASU" | "EURL", options: ComparaisonOptions, regles: ReglesFiscales = reglesEnVigueur): number {
  const report = runMetaSimulation(sessionConvertie(session, source, statut, options, 0), regles)
  return report.activities.find(a => a.entityId === source.id)?.resultatConserve ?? 0
}

/** L'activité à comparer, ou `undefined` si l'identifiant ne désigne aucune activité. */
export function activiteComparee(session: DonneesDeLAnnee, activityId: string): Activite | undefined {
  return session.entities.find((e): e is Activite => e.id === activityId && e.type !== "person")
}

/** Pour chaque couple en union libre : le net et l'impôt actuels, puis ceux d'une imposition commune (mariage ou PACS). */
function comparerCouples(session: DonneesDeLAnnee, regles: ReglesFiscales, reportActuel: SimulationReport): ComparaisonCouple[] {
  const impotDe = (report: SimulationReport, ids: string[]) => report.foyers.filter(f => f.personIds.some(id => ids.includes(id))).reduce((somme, f) => somme + f.impotSurLeRevenu, 0)

  return session.relationships
    .filter(rel => rel.type === "En couple")
    .map(rel => {
      const ids: [string, string] = [rel.fromId, rel.toId]
      const maries = runMetaSimulation({ ...session, relationships: session.relationships.map(r => (r.id === rel.id ? { ...r, type: "Marié(e)" as const } : r)) }, regles)
      return {
        personIds: ids,
        netApresImpotsActuel: reportActuel.totalNetApresImpots,
        impotSurLeRevenuActuel: impotDe(reportActuel, ids),
        netApresImpotsMaries: maries.totalNetApresImpots,
        impotSurLeRevenuMaries: impotDe(maries, ids)
      }
    })
}

export function comparerStatuts(session: DonneesDeLAnnee, options: ComparaisonOptions, regles: ReglesFiscales = reglesEnVigueur): ComparaisonResult {
  const reportActuel = runMetaSimulation(session, regles)
  const couples = comparerCouples(session, regles, reportActuel)

  const source = activiteComparee(session, options.activityId)
  if (!source) {
    return { scenarios: [], meilleur: null, couples, warnings: ["Choisissez une activité à comparer."] }
  }

  const warnings: string[] = []
  const { principale, associes } = personnesDeLActivite(session, source.id)
  if (!principale) warnings.push("Cette activité n'est reliée à aucune personne : ses revenus ne rejoignent aucun foyer, la comparaison ne mesure que les prélèvements.")
  if (associes.length > 0) warnings.push("En entreprise individuelle et en micro-entreprise, seul le dirigeant reprend l'activité : les autres associés n'en reçoivent plus rien.")

  const actuel = statutActuel(source)
  const scenarios = STATUTS_COMPARES.map(statut => scenario(statut, statut === actuel, simulerStatut(session, source, statut, options, regles), source.id, options, regles))
  const meilleur = scenarios.reduce((a, b) => (b.netApresImpots > a.netApresImpots ? b : a), scenarios[0]).statut

  return { scenarios, meilleur, couples, warnings }
}
