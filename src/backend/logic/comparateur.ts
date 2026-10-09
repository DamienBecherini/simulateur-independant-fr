// src/backend/logic/comparateur.ts

import type { StatutFrais, FraisFonctionnement, Company, ComparaisonCouple, ComparaisonOptions, ComparaisonResult, FinancialFlow, MicroEntreprise, OptimisationRemuneration, Relationship, RemunerationOptimale, ScenarioStatut, DonneesDeLAnnee, SimulationReport, StatutCompare, StatutSociete } from "../../types.js"
import { optimiserRemuneration } from "./optimisation-remuneration.js"
import { reglesEnVigueur, type ReglesFiscales } from "./regles.js"
import { evaluerProtectionSociale } from "./protection-sociale.js"
import { depassePlafondMicro } from "./calculsAE.js"
import { acreDeLAnnee, chiffreAffairesDeLaMicro, lireMois, noteCFE, partDeCFEDue, prorataDesPlafonds } from "./dispositifs.js"
import { microInterdite, professionDe, raisonMicroInterdite, reglesDeLaMicro, retraiteMicroDeLaProfession } from "./professions.js"
import { runMetaSimulation, type ContexteDeLAnnee } from "./simulation-engine.js"

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
  // Les déplacements professionnels suivent l'activité dans chaque statut : le moteur les convertit au barème de
  // l'année, en charge déductible (société, EI) ou en simple dépense (micro-entreprise).
  const deplacements = source.deplacementsProfessionnels ? { deplacementsProfessionnels: source.deplacementsProfessionnels } : {}
  // La date de création suit l'activité : ACRE, plafonds au prorata et CFE en dépendent dans chaque statut.
  const creation = source.dateDeCreation ? { dateDeCreation: source.dateDeCreation } : {}
  // La profession aussi : sa caisse, son taux micro et ses avertissements s'appliquent dans chaque statut (ADR 015).
  const profession = source.profession === undefined ? {} : { profession: source.profession }
  const partConventionnee = source.partConventionnee === undefined ? {} : { partConventionnee: source.partConventionnee }
  const commun = { id: source.id, name: source.name, avatar: source.avatar, locked: source.locked, ...deplacements, ...creation, ...profession, ...partConventionnee }
  if (statut === "micro" || statut === "micro-vfl") {
    const micro = source.type === "micro-entreprise" ? source : undefined
    return { ...commun, type: "micro-entreprise", beneficieACRE: micro?.beneficieACRE ?? false, opteVFL: statut === "micro-vfl", ...(micro?.rfrN2 !== undefined ? { rfrN2: micro.rfrN2 } : {}) }
  }
  const capitalSource = source.type === "company" && source.legalStatus !== "EI" ? source.capitalSocial : 1000
  return { ...commun, type: "company", legalStatus: statut, capitalSocial: statut === "EI" ? 0 : capitalSource, ...reservesQuiSuivent(source, statut) }
}

/** Les réserves de départ d'une société à l'IS la suivent dans l'autre statut de société (voir l'ADR 014). */
function reservesQuiSuivent(source: Activite, statut: StatutCompare): Pick<Company, "reservesInitiales"> {
  return source.type === "company" && source.reservesInitiales !== undefined && estSocieteIS(statut) ? { reservesInitiales: source.reservesInitiales } : {}
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

/**
 * Données de l'année dans lesquelles l'activité a pris le statut demandé : entité, relations et flux convertis, sans
 * rien ajouter. Sert aussi à simuler au réel une micro-entreprise sortie du régime micro (simulation-pluriannuelle.ts).
 */
export function convertirLActivite(session: DonneesDeLAnnee, source: Activite, statut: StatutCompare, partBncPrestations = 1, garderLesDividendes = false): DonneesDeLAnnee {
  const partBnc = Math.min(1, Math.max(0, partBncPrestations))
  const monthlyData = session.monthlyData.map(mois => ({
    ...mois,
    flows: mois.flows.flatMap(flux => {
      if (flux.entityId !== source.id) return [flux]
      // Les dividendes saisis sont conservés tels quels quand on ne distribue pas tout le bénéfice.
      if (flux.type === "dividends_payment" && estSocieteIS(statut) && garderLesDividendes) return [flux]
      return convertirFlux(flux, statut, partBnc)
    })
  }))
  return {
    ...session,
    entities: session.entities.map(e => (e.id === source.id ? entiteCible(source, statut) : e)),
    relationships: relationsCibles(session, source, statut),
    monthlyData
  }
}

/** Session dans laquelle l'activité a pris le statut demandé, avec ses flux convertis, sa rémunération, ses dividendes et ses frais. */
export function sessionConvertie(session: DonneesDeLAnnee, source: Activite, statut: StatutCompare, options: ComparaisonOptions, dividendes: number | null): DonneesDeLAnnee {
  const convertie = convertirLActivite(session, source, statut, options.partBncPrestations, dividendes === null)
  const monthlyData = [...convertie.monthlyData]

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
  return { ...convertie, monthlyData }
}

/** Total annuel des frais de fonctionnement saisis pour un statut. */
export function fraisDuStatut(statut: StatutCompare, options: ComparaisonOptions): number {
  const cle: StatutFrais = statut === "micro-vfl" ? "micro" : statut
  const postes = options.fraisFonctionnement?.[cle]
  return postes ? Object.values(postes).reduce((somme, montant) => somme + Math.max(0, montant), 0) : 0
}

const estMicro = (statut: StatutCompare) => statut === "micro" || statut === "micro-vfl"

/**
 * Ce que la micro-entreprise de la colonne donne à la protection sociale : son ACRE (mois couverts si la date de
 * création est connue, toute l'année sinon) et ses plafonds de l'année (au prorata l'année de création).
 */
function microDeLaColonne(simulation: Simulation, activiteId: string, regles: ReglesFiscales, annee: number) {
  const micro = simulation.session.entities.find((e): e is MicroEntreprise => e.id === activiteId && e.type === "micro-entreprise")
  // Un micro-entrepreneur de la CIPAV a son taux global et sa part de retraite de base (ADR 015).
  const profession = micro ? professionDe(micro, regles) : null
  const reglesMicro = reglesDeLaMicro(regles, profession)
  const retraite = retraiteMicroDeLaProfession(regles, profession)
  const acre = micro ? acreDeLAnnee(micro, annee, simulation.session.monthlyData, reglesMicro) : null
  return {
    beneficieACRE: micro?.beneficieACRE ?? false,
    ...(acre ? { acre: { reduction: acre.reduction, chiffreAffaires: acre.chiffreAffaires } } : {}),
    ...(retraite ? { retraiteBnc: retraite } : {}),
    prorata: prorataDesPlafonds(lireMois(micro?.dateDeCreation), annee),
    reglesMicro
  }
}

/** Colonne micro d'une activité sortie du régime micro cette année : le régime fermé et pourquoi, dans les notes. */
function regimeFerme(statut: StatutCompare, activiteId: string, contexte: ContexteDeLAnnee): Pick<ScenarioStatut, "regimeMicroFerme"> & { notes: string[] } {
  const sortie = estMicro(statut) ? contexte.regimeMicro?.sorties[activiteId] : undefined
  if (!sortie) return { notes: [] }
  return { regimeMicroFerme: sortie, notes: [`Régime micro fermé en ${contexte.annee ?? sortie.depuis} : chiffre d'affaires au-delà des plafonds en ${sortie.depassements[0]} et ${sortie.depassements[1]}, sortie au 1er janvier ${sortie.depuis}. Cette colonne n'est donnée qu'à titre de comparaison.`] }
}

/**
 * Ce sur quoi le dirigeant cotise dans la colonne : rémunération brute du président, assiette du travailleur non salarié
 * et, pour une profession libérale réglementée, sa caisse.
 */
function assiettesDeProtection(activite: SimulationReport["activities"][number] | undefined) {
  const caisse = activite?.cotisationsTNS?.caisse?.caisse
  return { remunerationBrute: activite?.cotisationsPresident?.brut ?? 0, assietteTNS: activite?.cotisationsTNS?.assiette ?? 0, ...(caisse ? { caisse } : {}) }
}

function scenario(statut: StatutCompare, actuel: boolean, simulation: Simulation, activiteId: string, options: ComparaisonOptions, regles: ReglesFiscales, contexte: ContexteDeLAnnee): ScenarioStatut {
  const { report } = simulation
  const { bilan } = report
  const activite = report.activities.find(a => a.entityId === activiteId)
  const caMicro = chiffreAffairesDeLaMicro(simulation.session.monthlyData, activiteId)
  const { prorata, reglesMicro, ...acre } = microDeLaColonne(simulation, activiteId, regles, contexte.annee ?? regles.annee)
  const { notes, ...ferme } = regimeFerme(statut, activiteId, contexte)
  return {
    statut,
    libelle: LIBELLES[statut],
    actuel,
    fraisFonctionnement: fraisDuStatut(statut, options),
    protectionSociale: evaluerProtectionSociale(statut, { ...assiettesDeProtection(activite), chiffreAffairesMicro: caMicro, ...acre }, estMicro(statut) ? reglesMicro : regles),
    netApresImpots: report.totalNetApresImpots,
    revenusAvantPrelevements: bilan.revenusAvantPrelevements,
    totalPrelevements: bilan.totalPrelevements,
    cotisationsSociales: bilan.cotisationsSociales + bilan.cotisationsSalariales,
    impotSocietes: bilan.impotSocietes,
    impotSurLeRevenu: bilan.impotSurLeRevenu,
    prelevementsSociaux: bilan.prelevementsSociaux,
    resultatConserve: bilan.resultatConserve,
    resultatConserveActivite: Math.round(activite?.resultatConserve ?? 0),
    horsPlafond: estMicro(statut) && depassePlafondMicro(caMicro, regles, prorata),
    ...ferme,
    // Les dispositifs de l'année (sortie du régime micro, ACRE…) rejoignent les notes de la colonne.
    warnings: [...notes, ...(activite?.dispositifs ?? []), ...(activite?.warnings ?? [])],
    ...(activite?.partage ? { partage: activite.partage } : {}),
    ...(activite?.reserves ? { reserves: activite.reserves } : {})
  }
}

interface Simulation {
  report: SimulationReport
  session: DonneesDeLAnnee
  /** Dividendes calculés selon la répartition choisie ; `null` quand ce sont ceux de la grille. */
  dividendes: number | null
}

/** Précision des rémunérations calculées. */
export const PRECISION_REMUNERATION = 100

/**
 * Rémunération nette la plus haute qui laisse un bénéfice positif ou nul, à 100 € près. Le bénéfice baisse quand
 * la rémunération monte : on double la borne haute jusqu'à le rendre négatif, puis on procède par dichotomie.
 */
export function remunerationMaximale(benefice: (remuneration: number) => number): number {
  let haut = Math.max(PRECISION_REMUNERATION, benefice(0))
  for (let i = 0; i < 20 && benefice(haut) >= 0; i++) haut *= 2
  let bas = 0
  while (haut - bas > PRECISION_REMUNERATION / 10) {
    const milieu = (bas + haut) / 2
    if (benefice(milieu) >= 0) bas = milieu
    else haut = milieu
  }
  return Math.floor(bas / PRECISION_REMUNERATION) * PRECISION_REMUNERATION
}

/**
 * Rémunération et part du bénéfice distribuable versée en dividendes, selon la répartition choisie. Au meilleur net,
 * le comparateur fixe d'abord la rémunération de chaque statut ; appelée seule, la simulation verse alors celle saisie.
 */
function remunerationEtPart(session: DonneesDeLAnnee, source: Activite, statut: "SASU" | "EURL", options: ComparaisonOptions, regles: ReglesFiscales, contexte: ContexteDeLAnnee): { remunerationNette: number; part: number } {
  const { mode, partDistribuee } = options.repartition
  if (mode === "remuneration") {
    const benefice = (remunerationNette: number) => beneficeAvantDividendes(session, source, statut, { ...options, remunerationNette }, regles, contexte)
    return { remunerationNette: benefice(0) > 0 ? remunerationMaximale(benefice) : 0, part: 0 }
  }
  return { remunerationNette: options.remunerationNette, part: mode === "personnalisee" ? Math.min(1, Math.max(0, partDistribuee)) : 1 }
}

function simulerStatut(session: DonneesDeLAnnee, source: Activite, statut: StatutCompare, options: ComparaisonOptions, regles: ReglesFiscales, contexte: ContexteDeLAnnee): Simulation {
  if (!estSocieteIS(statut) || options.repartition.mode === "grille") {
    const convertie = sessionConvertie(session, source, statut, options, null)
    return { report: runMetaSimulation(convertie, regles, contexte), session: convertie, dividendes: null }
  }
  const { remunerationNette, part } = remunerationEtPart(session, source, statut, options, regles, contexte)
  const reglages = { ...options, remunerationNette }
  // On verse la part choisie du bénéfice distribuable de l'année (les réserves des années précédentes restent dans la
  // société), et on recommence tant que les dividendes changent, par prudence : ce bénéfice n'en dépend pas aujourd'hui.
  let dividendes = 0
  let convertie = sessionConvertie(session, source, statut, reglages, dividendes)
  let report = runMetaSimulation(convertie, regles, contexte)
  for (let tour = 0; tour < 5; tour++) {
    const suivants = Math.max(0, part * beneficeDistribuableDeLAnnee(report, source.id))
    if (Math.abs(suivants - dividendes) < 1) break
    dividendes = suivants
    convertie = sessionConvertie(session, source, statut, reglages, dividendes)
    report = runMetaSimulation(convertie, regles, contexte)
  }
  return { report, session: convertie, dividendes }
}

/** Bénéfice distribuable de l'année de l'activité dans un rapport : après IS et réserve légale, pertes antérieures déduites. */
export function beneficeDistribuableDeLAnnee(report: SimulationReport, activiteId: string): number {
  return report.activities.find(a => a.entityId === activiteId)?.reserves?.beneficeDistribuableDeLAnnee ?? 0
}

/** Simule l'activité dans un statut, avec les réglages donnés : la colonne du comparateur et les dividendes versés. */
export function simulerScenario(session: DonneesDeLAnnee, source: Activite, statut: StatutCompare, options: ComparaisonOptions, regles: ReglesFiscales = reglesEnVigueur, contexte: ContexteDeLAnnee = {}): { scenario: ScenarioStatut; dividendes: number | null } {
  const simulation = simulerStatut(session, source, statut, options, regles, contexte)
  return { scenario: scenario(statut, statut === statutActuel(source), simulation, source.id, options, regles, contexte), dividendes: simulation.dividendes }
}

/** Bénéfice après impôt sur les sociétés que la société garde avec cette rémunération, avant tout dividende. */
export function beneficeAvantDividendes(session: DonneesDeLAnnee, source: Activite, statut: "SASU" | "EURL", options: ComparaisonOptions, regles: ReglesFiscales = reglesEnVigueur, contexte: ContexteDeLAnnee = {}): number {
  const report = runMetaSimulation(sessionConvertie(session, source, statut, options, 0), regles, contexte)
  return report.activities.find(a => a.entityId === source.id)?.resultatConserve ?? 0
}

/** L'activité à comparer, ou `undefined` si l'identifiant ne désigne aucune activité. */
export function activiteComparee(session: DonneesDeLAnnee, activityId: string): Activite | undefined {
  return session.entities.find((e): e is Activite => e.id === activityId && e.type !== "person")
}

/** Pour chaque couple en union libre : le net et l'impôt actuels, puis ceux d'une imposition commune (mariage ou PACS). */
function comparerCouples(session: DonneesDeLAnnee, regles: ReglesFiscales, contexte: ContexteDeLAnnee, reportActuel: SimulationReport): ComparaisonCouple[] {
  const impotDe = (report: SimulationReport, ids: string[]) => report.foyers.filter(f => f.personIds.some(id => ids.includes(id))).reduce((somme, f) => somme + f.impotSurLeRevenu, 0)

  return session.relationships
    .filter(rel => rel.type === "En couple")
    .map(rel => {
      const ids: [string, string] = [rel.fromId, rel.toId]
      const maries = runMetaSimulation({ ...session, relationships: session.relationships.map(r => (r.id === rel.id ? { ...r, type: "Marié(e)" as const } : r)) }, regles, contexte)
      return {
        personIds: ids,
        netApresImpotsActuel: reportActuel.totalNetApresImpots,
        impotSurLeRevenuActuel: impotDe(reportActuel, ids),
        netApresImpotsMaries: maries.totalNetApresImpots,
        impotSurLeRevenuMaries: impotDe(maries, ids)
      }
    })
}

/**
 * Frais de fonctionnement de l'année : le poste CFE de chaque statut multiplié par la part due d'après la date de
 * création de l'activité (rien l'année de création, la moitié l'année suivante), avec la note qui le dit.
 */
export function avecLaCFEDeLAnnee(options: ComparaisonOptions, source: Activite, annee: number, regles: ReglesFiscales): { options: ComparaisonOptions } & Pick<ComparaisonResult, "noteCFE" | "partCFE"> {
  const creation = lireMois(source.dateDeCreation)
  const part = partDeCFEDue(creation, annee, regles)
  const note = noteCFE(creation, annee, regles)
  if (!options.fraisFonctionnement || part >= 1 || !note) return { options }
  const frais = Object.fromEntries(Object.entries(options.fraisFonctionnement).map(([statut, postes]) => [statut, { ...postes, cfe: postes.cfe * part }])) as FraisFonctionnement
  return { options: { ...options, fraisFonctionnement: frais }, noteCFE: note, partCFE: part }
}

export function comparerStatuts(session: DonneesDeLAnnee, optionsSaisies: ComparaisonOptions, regles: ReglesFiscales = reglesEnVigueur, contexte: ContexteDeLAnnee = {}): ComparaisonResult {
  const reportActuel = runMetaSimulation(session, regles, contexte)
  const couples = comparerCouples(session, regles, contexte, reportActuel)

  const source = activiteComparee(session, optionsSaisies.activityId)
  if (!source) {
    return { scenarios: [], meilleur: null, couples, warnings: ["Choisissez une activité à comparer."] }
  }
  const { options, ...cfe } = avecLaCFEDeLAnnee(optionsSaisies, source, contexte.annee ?? regles.annee, regles)

  const warnings: string[] = []
  const { principale, associes } = personnesDeLActivite(session, source.id)
  if (!principale) warnings.push("Cette activité n'est reliée à aucune personne : ses revenus ne rejoignent aucun foyer, la comparaison ne mesure que les prélèvements.")
  if (associes.length > 0) warnings.push("En entreprise individuelle et en micro-entreprise, seul le dirigeant reprend l'activité : les autres associés n'en reçoivent plus rien.")

  const actuel = statutActuel(source)
  const auMeilleurNet = options.repartition.mode === "meilleurNet"
  const optimisations: Partial<Record<StatutSociete, OptimisationRemuneration>> = {}
  // La micro-entreprise est interdite aux praticiens et auxiliaires médicaux : ses colonnes sont retirées, avec la raison.
  const profession = professionDe(source, regles)
  const sansMicro = profession !== null && microInterdite(profession)
  if (profession && sansMicro) warnings.push(raisonMicroInterdite(profession))
  const statuts = STATUTS_COMPARES.filter(statut => !(sansMicro && estMicro(statut)))
  const scenarios = statuts.map(statut => {
    if (!auMeilleurNet || !estSocieteIS(statut)) return scenario(statut, statut === actuel, simulerStatut(session, source, statut, options, regles, contexte), source.id, options, regles, contexte)
    const colonne = colonneAuMeilleurNet(session, source, statut, options, regles, contexte)
    optimisations[statut] = colonne.optimisation
    return colonne.scenario
  })
  // Une micro-entreprise hors plafond n'est tenable que deux ans : le meilleur net se choisit parmi les autres colonnes.
  // Une profession qui exerce en principe en société d'exercice libéral n'a pas de SASU ou d'EURL classique à désigner :
  // leurs colonnes restent, avec leur avertissement, mais le meilleur net se choisit ailleurs (ADR 015).
  const sansSocieteClassique = profession?.societeExerciceLiberal === true
  if (sansSocieteClassique && scenarios.some(s => estSocieteIS(s.statut))) warnings.push(`${profession.libelle} : la SASU et l'EURL classiques ne sont pas désignées comme meilleur statut, cette profession exerçant en principe en société d'exercice libéral, dont la rémunération n'est pas encore modélisée. Leurs colonnes restent indicatives.`)
  const tenables = scenarios.filter(s => !s.horsPlafond && !s.regimeMicroFerme && !(sansSocieteClassique && estSocieteIS(s.statut)))
  const candidats = tenables.length > 0 ? tenables : scenarios
  const meilleur = candidats.reduce((a, b) => (b.netApresImpots > a.netApresImpots ? b : a), candidats[0]).statut

  return { scenarios, meilleur, couples, warnings, ...(auMeilleurNet ? { optimisations } : {}), ...cfe }
}

/** La situation actuelle d'une activité, simulée comme une colonne du comparateur (voir `situationActuelle`). */
export interface SituationActuelle {
  scenario: ScenarioStatut
  /** Rémunération nette annuelle et dividendes saisis dans la grille, en SASU et en EURL ; `null` dans les autres statuts. */
  remunerationNette: number | null
  dividendes: number | null
}

/**
 * L'activité telle que la grille la décrit, dans son statut actuel : rémunération et dividendes saisis, frais de
 * fonctionnement de ce statut compris, comme la colonne « actuel » du comparateur avec le partage « grille ». Sert de
 * point de départ à l'arbitrage rémunération / dividendes : ses nets se comparent à ceux de la courbe.
 */
export function situationActuelle(session: DonneesDeLAnnee, source: Activite, options: ComparaisonOptions, regles: ReglesFiscales = reglesEnVigueur, contexte: ContexteDeLAnnee = {}): SituationActuelle {
  const statut = statutActuel(source)
  const flux = session.monthlyData.flatMap(mois => mois.flows).filter(f => f.entityId === source.id)
  const total = (type: FinancialFlow["type"]) => flux.filter(f => f.type === type).reduce((somme, f) => somme + f.amount, 0)
  const societe = estSocieteIS(statut)
  const remunerationNette = societe ? total("director_remuneration") : 0
  const { scenario } = simulerScenario(session, source, statut, { ...options, remunerationNette, repartition: { mode: "grille", partDistribuee: 1 } }, regles, contexte)
  return { scenario, remunerationNette: societe ? remunerationNette : null, dividendes: societe ? total("dividends_payment") : null }
}

/** Ce que coûtent les 4 trimestres de retraite en net du foyer, arrondi à l'euro ; 0 si le meilleur net les valide déjà. */
export function coutDesQuatreTrimestres({ meilleur, meilleurAvecRetraite }: OptimisationRemuneration): number {
  if (!meilleur || !meilleurAvecRetraite) return 0
  return Math.max(0, Math.round(meilleur.netApresImpots - meilleurAvecRetraite.netApresImpots))
}

/**
 * Au meilleur net, la rémunération retenue d'après l'arbitrage du statut : la meilleure, ou la meilleure parmi celles
 * qui valident 4 trimestres de retraite si on le demande et qu'il en existe. Sans bénéfice, aucune rémunération.
 * Cochée ou non, la case s'accompagne de ce que coûtent les 4 trimestres, pour choisir en connaissance de cause.
 */
export function remunerationOptimale(optimisation: OptimisationRemuneration, avecRetraite: boolean): RemunerationOptimale {
  const { meilleur, meilleurAvecRetraite } = optimisation
  const cout = coutDesQuatreTrimestres(optimisation)
  const avecCout = cout > 0 ? { coutDesQuatreTrimestres: cout } : {}
  if (avecRetraite && meilleurAvecRetraite) return { remunerationNette: meilleurAvecRetraite.remunerationNette, avecRetraite: true, retraiteHorsDAtteinte: false, ...avecCout }
  return { remunerationNette: meilleur?.remunerationNette ?? 0, avecRetraite: false, retraiteHorsDAtteinte: avecRetraite, ...avecCout }
}

/**
 * Colonne SASU ou EURL au meilleur net : l'arbitrage rémunération / dividendes de ce statut, puis la simulation à la
 * rémunération retenue, tout le bénéfice restant versé en dividendes. Chaque statut a donc sa propre rémunération.
 */
function colonneAuMeilleurNet(session: DonneesDeLAnnee, source: Activite, statut: StatutSociete, options: ComparaisonOptions, regles: ReglesFiscales, contexte: ContexteDeLAnnee): { scenario: ScenarioStatut; optimisation: OptimisationRemuneration } {
  const optimisation = optimiserRemuneration(session, options, statut, regles, contexte)
  const retenue = remunerationOptimale(optimisation, options.repartition.avecRetraite === true)
  const { scenario } = simulerScenario(session, source, statut, { ...options, remunerationNette: retenue.remunerationNette, repartition: { mode: "dividendes", partDistribuee: 1 } }, regles, contexte)
  const repli = retenue.retraiteHorsDAtteinte ? [`Aucune rémunération possible en ${statut} ne valide 4 trimestres de retraite : la colonne retient le meilleur net, sans cette condition.`] : []
  return { scenario: { ...scenario, remunerationOptimale: retenue, warnings: [...scenario.warnings, ...repli] }, optimisation }
}
