// src/backend/logic/simulation-d-un-statut.ts

import { estSocieteIS, type ComparaisonOptions, type DonneesDeLAnnee, type FinancialFlow, type ScenarioStatut, type SimulationReport, type StatutCompare, type StatutSociete } from "../../types.js"
import { scenarioDeLaColonne, type ColonneEtudiee, type SimulationDeLaColonne } from "./colonne-du-comparateur.js"
import { convertirLActivite, estMicro } from "./conversion-de-statut.js"
import { fraisDuStatut } from "./frais-de-fonctionnement.js"
import { runMetaSimulation } from "./simulation-engine.js"

/*
 * Simulation d'une activité dans un statut, avec les réglages de la colonne : l'activité est convertie, reçoit la
 * rémunération, les dividendes et les frais de fonctionnement du statut, puis toute l'année est simulée par le moteur.
 * En SASU ou en EURL, les dividendes suivent la répartition choisie : part du bénéfice distribuable de l'année, ou
 * rémunération la plus haute que la société peut verser. Le comparateur (une colonne par statut) et l'optimiseur
 * (une simulation par rémunération essayée) s'appuient tous deux sur ce module.
 */

/** Précision des rémunérations calculées. */
export const PRECISION_REMUNERATION = 100

/** La colonne avec d'autres réglages. */
export function avecLesReglages(colonne: ColonneEtudiee, reglages: Partial<ComparaisonOptions>): ColonneEtudiee {
  return { ...colonne, options: { ...colonne.options, ...reglages } }
}

/** Réglages d'une colonne de société qui verse cette rémunération, et tout le bénéfice distribuable en dividendes. */
export function toutEnDividendes(remunerationNette: number): Partial<ComparaisonOptions> {
  return { remunerationNette, repartition: { mode: "dividendes", partDistribuee: 1 } }
}

/** Les flux que le comparateur ajoute à l'activité convertie : rémunération, dividendes et frais de fonctionnement. */
function fluxAjoutes(sourceId: string, statut: StatutCompare, options: ComparaisonOptions, dividendes: number | null): FinancialFlow[] {
  const ajouts: FinancialFlow[] = []
  if (estSocieteIS(statut) && options.remunerationNette > 0) {
    ajouts.push({ id: `comparateur-${sourceId}-remuneration`, label: "Rémunération (comparateur)", amount: options.remunerationNette, entityId: sourceId, type: "director_remuneration" })
  }
  if (estSocieteIS(statut) && dividendes !== null && dividendes > 0) {
    ajouts.push({ id: `comparateur-${sourceId}-dividendes`, label: "Dividendes (comparateur)", amount: dividendes, entityId: sourceId, type: "dividends_payment" })
  }
  const frais = fraisDuStatut(statut, options)
  if (frais > 0) {
    // Déductibles en société et en EI ; en micro, une simple dépense qui ne réduit ni cotisations ni impôt.
    ajouts.push({ id: `comparateur-${sourceId}-frais`, label: "Frais de fonctionnement (comparateur)", amount: frais, entityId: sourceId, type: estMicro(statut) ? "expense" : "deductible_expense" })
  }
  return ajouts
}

/**
 * Données de l'année dans lesquelles l'activité a pris le statut demandé, avec ses flux convertis, sa rémunération, ses
 * dividendes et ses frais ; `dividendes` à `null` garde ceux de la grille.
 */
export function sessionConvertie({ donnees, source, options }: Pick<ColonneEtudiee, "donnees" | "source" | "options">, statut: StatutCompare, dividendes: number | null): DonneesDeLAnnee {
  const convertie = convertirLActivite(donnees, source, statut, options.partBncPrestations, dividendes === null)
  const monthlyData = [...convertie.monthlyData]
  // La rémunération et les dividendes calculés sont saisis sur janvier : seuls les totaux annuels comptent.
  monthlyData[0] = { ...monthlyData[0], flows: [...monthlyData[0].flows, ...fluxAjoutes(source.id, statut, options, dividendes)] }
  return { ...convertie, monthlyData }
}

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

/** Bénéfice après impôt sur les sociétés que la société garde avec la rémunération de la colonne, avant tout dividende. */
export function beneficeAvantDividendes(colonne: ColonneEtudiee, statut: StatutSociete): number {
  const report = runMetaSimulation(sessionConvertie(colonne, statut, 0), colonne.regles, colonne.contexte)
  return report.activities.find(a => a.entityId === colonne.source.id)?.resultatConserve ?? 0
}

/** Bénéfice distribuable de l'année de l'activité dans un rapport : après IS et réserve légale, pertes antérieures déduites. */
export function beneficeDistribuableDeLAnnee(report: SimulationReport, activiteId: string): number {
  return report.activities.find(a => a.entityId === activiteId)?.reserves?.beneficeDistribuableDeLAnnee ?? 0
}

/**
 * Rémunération et part du bénéfice distribuable versée en dividendes, selon la répartition choisie. Au meilleur net,
 * le comparateur fixe d'abord la rémunération de chaque statut ; appelée seule, la simulation verse alors celle saisie.
 */
function remunerationEtPart(colonne: ColonneEtudiee, statut: StatutSociete): { remunerationNette: number; part: number } {
  const { mode, partDistribuee } = colonne.options.repartition
  if (mode === "remuneration") {
    const benefice = (remunerationNette: number) => beneficeAvantDividendes(avecLesReglages(colonne, { remunerationNette }), statut)
    return { remunerationNette: benefice(0) > 0 ? remunerationMaximale(benefice) : 0, part: 0 }
  }
  return { remunerationNette: colonne.options.remunerationNette, part: mode === "personnalisee" ? Math.min(1, Math.max(0, partDistribuee)) : 1 }
}

/** Simule la colonne avec ces dividendes. */
function simulerAvec(colonne: ColonneEtudiee, statut: StatutCompare, dividendes: number | null): SimulationDeLaColonne {
  const session = sessionConvertie(colonne, statut, dividendes)
  return { report: runMetaSimulation(session, colonne.regles, colonne.contexte), session, dividendes }
}

/**
 * Société dont les dividendes suivent la répartition choisie : on verse la part choisie du bénéfice distribuable de
 * l'année (les réserves des années précédentes restent dans la société), et on recommence tant que les dividendes
 * changent, par prudence : ce bénéfice n'en dépend pas aujourd'hui.
 */
function simulerLaSociete(colonne: ColonneEtudiee, statut: StatutSociete): SimulationDeLaColonne {
  const { remunerationNette, part } = remunerationEtPart(colonne, statut)
  const reglee = avecLesReglages(colonne, { remunerationNette })
  let simulation = simulerAvec(reglee, statut, 0)
  for (let tour = 0; tour < 5; tour++) {
    const suivants = Math.max(0, part * beneficeDistribuableDeLAnnee(simulation.report, colonne.source.id))
    if (Math.abs(suivants - (simulation.dividendes ?? 0)) < 1) break
    simulation = simulerAvec(reglee, statut, suivants)
  }
  return simulation
}

function simulerStatut(colonne: ColonneEtudiee, statut: StatutCompare): SimulationDeLaColonne {
  if (!estSocieteIS(statut) || colonne.options.repartition.mode === "grille") return simulerAvec(colonne, statut, null)
  return simulerLaSociete(colonne, statut)
}

/** Simule l'activité dans un statut, avec les réglages de la colonne : la colonne du comparateur et les dividendes versés. */
export function simulerScenario(colonne: ColonneEtudiee, statut: StatutCompare): { scenario: ScenarioStatut; dividendes: number | null } {
  const simulation = simulerStatut(colonne, statut)
  return { scenario: scenarioDeLaColonne(colonne, statut, simulation), dividendes: simulation.dividendes }
}
