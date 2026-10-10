// src/backend/logic/comparateur.ts

import { estSocieteIS, STATUTS_COMPARES, type ComparaisonCouple, type ComparaisonOptions, type ComparaisonResult, type DonneesDeLAnnee, type FinancialFlow, type OptimisationRemuneration, type RemunerationOptimale, type ScenarioStatut, type SimulationReport, type StatutCompare, type StatutSociete } from "../../types.js"
import type { ColonneEtudiee } from "./colonne-du-comparateur.js"
import { activiteComparee, estMicro, personnesDeLActivite, statutActuel, type Activite } from "./conversion-de-statut.js"
import { avecLaCFEDeLAnnee } from "./frais-de-fonctionnement.js"
import { optimiserLaColonne } from "./optimisation-remuneration.js"
import { microInterdite, professionDe, raisonMicroInterdite } from "./professions.js"
import type { ProfessionReglementee, ReglesFiscales } from "./regles.js"
import { avecLesReglages, simulerScenario, toutEnDividendes } from "./simulation-d-un-statut.js"
import { runMetaSimulation, type ContexteDeLAnnee } from "./simulation-engine.js"

/*
 * Comparateur de statuts : l'activité choisie est convertie dans chaque statut (SASU, EURL, entreprise
 * individuelle au réel, micro-entreprise avec et sans versement libératoire), puis toute la simulation est
 * relancée. Le reste de la session (autres activités, salaires, foyers) ne change pas : l'écart entre deux
 * colonnes vient donc uniquement du statut de cette activité.
 *
 * Ce module choisit les colonnes, désigne le meilleur net et compare les couples en union libre. Une colonne se
 * simule dans simulation-d-un-statut.ts (conversion de l'activité : conversion-de-statut.ts ; frais :
 * frais-de-fonctionnement.ts ; ce qu'elle affiche : colonne-du-comparateur.ts) ; au meilleur net, la rémunération
 * de chaque société vient de l'optimiseur (optimisation-remuneration.ts).
 */

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

/** Ce que la comparaison doit dire des personnes de l'activité et de sa profession, avant toute colonne. */
function avertissementsDeLActivite(session: DonneesDeLAnnee, source: Activite, profession: ProfessionReglementee | null): string[] {
  const warnings: string[] = []
  const { principale, associes } = personnesDeLActivite(session, source.id)
  if (!principale) warnings.push("Cette activité n'est reliée à aucune personne : ses revenus ne rejoignent aucun foyer, la comparaison ne mesure que les prélèvements.")
  if (associes.length > 0) warnings.push("En entreprise individuelle et en micro-entreprise, seul le dirigeant reprend l'activité : les autres associés n'en reçoivent plus rien.")
  if (profession && microInterdite(profession)) warnings.push(raisonMicroInterdite(profession))
  return warnings
}

/** Les statuts comparés : la micro-entreprise est interdite aux praticiens et auxiliaires médicaux, ses colonnes sont retirées. */
function statutsDeLaComparaison(profession: ProfessionReglementee | null): StatutCompare[] {
  const sansMicro = profession !== null && microInterdite(profession)
  return STATUTS_COMPARES.filter(statut => !(sansMicro && estMicro(statut)))
}

/**
 * Le statut au meilleur net, parmi les colonnes tenables : une micro-entreprise hors plafond ne l'est que deux ans, et
 * une profession qui exerce en principe en société d'exercice libéral n'a pas de SASU ou d'EURL classique à désigner ;
 * leurs colonnes restent, avec leur avertissement, mais le meilleur net se choisit ailleurs (ADR 015).
 */
function meilleurStatut(scenarios: ScenarioStatut[], profession: ProfessionReglementee | null): { meilleur: StatutCompare; warnings: string[] } {
  const sansSocieteClassique = profession?.societeExerciceLiberal === true
  const warnings =
    sansSocieteClassique && scenarios.some(s => estSocieteIS(s.statut))
      ? [`${profession.libelle} : la SASU et l'EURL classiques ne sont pas désignées comme meilleur statut, cette profession exerçant en principe en société d'exercice libéral, dont la rémunération n'est pas encore modélisée. Leurs colonnes restent indicatives.`]
      : []
  const tenables = scenarios.filter(s => !s.horsPlafond && !s.regimeMicroFerme && !(sansSocieteClassique && estSocieteIS(s.statut)))
  const candidats = tenables.length > 0 ? tenables : scenarios
  return { meilleur: candidats.reduce((a, b) => (b.netApresImpots > a.netApresImpots ? b : a), candidats[0]).statut, warnings }
}

export function comparerStatuts(session: DonneesDeLAnnee, optionsSaisies: ComparaisonOptions, regles: ReglesFiscales, contexte: ContexteDeLAnnee = {}): ComparaisonResult {
  const reportActuel = runMetaSimulation(session, regles, contexte)
  const couples = comparerCouples(session, regles, contexte, reportActuel)

  const source = activiteComparee(session, optionsSaisies.activityId)
  if (!source) {
    return { scenarios: [], meilleur: null, couples, warnings: ["Choisissez une activité à comparer."] }
  }
  const { options, ...cfe } = avecLaCFEDeLAnnee(optionsSaisies, source, contexte.annee ?? regles.annee, regles)
  const colonne: ColonneEtudiee = { donnees: session, source, options, regles, contexte }
  const profession = professionDe(source, regles)

  const auMeilleurNet = options.repartition.mode === "meilleurNet"
  const optimisations: Partial<Record<StatutSociete, OptimisationRemuneration>> = {}
  const scenarios = statutsDeLaComparaison(profession).map(statut => {
    if (!auMeilleurNet || !estSocieteIS(statut)) return simulerScenario(colonne, statut).scenario
    const auMeilleur = colonneAuMeilleurNet(colonne, statut)
    optimisations[statut] = auMeilleur.optimisation
    return auMeilleur.scenario
  })
  const { meilleur, warnings } = meilleurStatut(scenarios, profession)

  return { scenarios, meilleur, couples, warnings: [...avertissementsDeLActivite(session, source, profession), ...warnings], ...(auMeilleurNet ? { optimisations } : {}), ...cfe }
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
export function situationActuelle(colonne: ColonneEtudiee): SituationActuelle {
  const { donnees, source } = colonne
  const statut = statutActuel(source)
  const flux = donnees.monthlyData.flatMap(mois => mois.flows).filter(f => f.entityId === source.id)
  const total = (type: FinancialFlow["type"]) => flux.filter(f => f.type === type).reduce((somme, f) => somme + f.amount, 0)
  const societe = estSocieteIS(statut)
  const remunerationNette = societe ? total("director_remuneration") : 0
  const { scenario } = simulerScenario(avecLesReglages(colonne, { remunerationNette, repartition: { mode: "grille", partDistribuee: 1 } }), statut)
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
function colonneAuMeilleurNet(colonne: ColonneEtudiee, statut: StatutSociete): { scenario: ScenarioStatut; optimisation: OptimisationRemuneration } {
  const optimisation = optimiserLaColonne(colonne, statut)
  const retenue = remunerationOptimale(optimisation, colonne.options.repartition.avecRetraite === true)
  const { scenario } = simulerScenario(avecLesReglages(colonne, toutEnDividendes(retenue.remunerationNette)), statut)
  const repli = retenue.retraiteHorsDAtteinte ? [`Aucune rémunération possible en ${statut} ne valide 4 trimestres de retraite : la colonne retient le meilleur net, sans cette condition.`] : []
  return { scenario: { ...scenario, remunerationOptimale: retenue, warnings: [...scenario.warnings, ...repli] }, optimisation }
}
