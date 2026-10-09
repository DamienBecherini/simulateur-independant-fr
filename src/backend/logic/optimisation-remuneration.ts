// src/backend/logic/optimisation-remuneration.ts

import type { ComparaisonOptions, OptimisationRemuneration, PointRemuneration, DonneesDeLAnnee, StatutSociete } from "../../types.js"
import { activiteComparee, beneficeAvantDividendes, PRECISION_REMUNERATION, remunerationMaximale, simulerScenario, type Activite } from "./comparateur.js"
import type { ReglesFiscales } from "./regles.js"
import type { ContexteDeLAnnee } from "./simulation-engine.js"

/*
 * Arbitrage entre rémunération et dividendes, en SASU ou en EURL : pour chaque rémunération nette, de zéro à
 * ce que la société peut verser, tout le bénéfice restant part en dividendes, puis toute la simulation est relancée.
 * On obtient la courbe du net du foyer, d'où l'on tire la meilleure rémunération, et la meilleure parmi celles qui
 * valident 4 trimestres de retraite : sans salaire, le président de SASU n'en valide aucun.
 *
 * La courbe n'est ni lisse ni monotone (tranches du barème, seuils des cotisations, décote) : on la parcourt sur
 * une grille d'une soixantaine de points, puis à 100 € près autour des meilleurs. Une simulation coûte moins d'une
 * milliseconde : le calcul complet reste sous la seconde.
 *
 * Le comparateur, au meilleur net, appelle cet arbitrage, qui s'appuie lui-même sur le comparateur : les deux modules
 * s'importent l'un l'autre. Rien n'y est lu au chargement, seulement à l'appel, quel que soit l'ordre de chargement.
 */

/** Nombre de points visés sur la grille. */
const POINTS_DE_GRILLE = 60

const arrondiInferieur = (montant: number) => Math.floor(montant / PRECISION_REMUNERATION) * PRECISION_REMUNERATION

function calculerPoint(session: DonneesDeLAnnee, source: Activite, statut: StatutSociete, options: ComparaisonOptions, remunerationNette: number, regles: ReglesFiscales, contexte: ContexteDeLAnnee): PointRemuneration {
  const { scenario, dividendes } = simulerScenario(session, source, statut, { ...options, remunerationNette, repartition: { mode: "dividendes", partDistribuee: 1 } }, regles, contexte)
  return {
    remunerationNette,
    dividendes: Math.round(dividendes ?? 0),
    netApresImpots: Math.round(scenario.netApresImpots),
    cotisationsSociales: Math.round(scenario.cotisationsSociales),
    impotSocietes: Math.round(scenario.impotSocietes),
    impotSurLeRevenu: Math.round(scenario.impotSurLeRevenu),
    prelevementsSociaux: Math.round(scenario.prelevementsSociaux),
    trimestres: scenario.protectionSociale.trimestres
  }
}

/** Le point au meilleur net ; à net égal, celui qui valide le plus de trimestres, puis la plus petite rémunération. */
function meilleurPoint(points: PointRemuneration[]): PointRemuneration | null {
  return points.reduce<PointRemuneration | null>((meilleur, point) => {
    if (!meilleur) return point
    if (point.netApresImpots !== meilleur.netApresImpots) return point.netApresImpots > meilleur.netApresImpots ? point : meilleur
    return point.trimestres > meilleur.trimestres ? point : meilleur
  }, null)
}

export function optimiserRemuneration(session: DonneesDeLAnnee, options: ComparaisonOptions, statut: StatutSociete, regles: ReglesFiscales, contexte: ContexteDeLAnnee = {}): OptimisationRemuneration {
  const vide = (warnings: string[]): OptimisationRemuneration => ({ statut, remunerationMaximale: 0, points: [], meilleur: null, meilleurAvecRetraite: null, warnings })

  const source = activiteComparee(session, options.activityId)
  if (!source) return vide(["Choisissez une activité à comparer."])

  const benefice = (remuneration: number) => beneficeAvantDividendes(session, source, statut, { ...options, remunerationNette: remuneration }, regles, contexte)
  if (benefice(0) <= 0) return vide([`Sans rémunération, l'activité ne dégage aucun bénéfice en ${statut} : il n'y a rien à partager entre rémunération et dividendes.`])

  const maximum = remunerationMaximale(benefice)
  const calcules = new Map<number, PointRemuneration>()
  const point = (remuneration: number) => {
    const montant = Math.min(maximum, Math.max(0, remuneration))
    if (!calcules.has(montant)) calcules.set(montant, calculerPoint(session, source, statut, options, montant, regles, contexte))
    return calcules.get(montant)!
  }
  /** Parcourt à 100 € près les rémunérations entre deux bornes. */
  const affiner = (de: number, a: number) => {
    for (let r = arrondiInferieur(Math.max(0, de)); r <= Math.min(maximum, a); r += PRECISION_REMUNERATION) point(r)
  }

  const pas = Math.max(PRECISION_REMUNERATION, Math.ceil(maximum / POINTS_DE_GRILLE / PRECISION_REMUNERATION) * PRECISION_REMUNERATION)
  for (let r = 0; r < maximum; r += pas) point(r)
  point(maximum)

  // Autour du meilleur point de la grille, puis du premier qui valide 4 trimestres.
  const meilleurDeLaGrille = meilleurPoint([...calcules.values()])!
  affiner(meilleurDeLaGrille.remunerationNette - pas, meilleurDeLaGrille.remunerationNette + pas)
  const premierAvecRetraite = [...calcules.values()].filter(p => p.trimestres >= 4).sort((a, b) => a.remunerationNette - b.remunerationNette)[0]
  if (premierAvecRetraite) affiner(premierAvecRetraite.remunerationNette - pas, premierAvecRetraite.remunerationNette)
  const meilleurAvecRetraiteDeLaGrille = meilleurPoint([...calcules.values()].filter(p => p.trimestres >= 4))
  if (meilleurAvecRetraiteDeLaGrille) affiner(meilleurAvecRetraiteDeLaGrille.remunerationNette - pas, meilleurAvecRetraiteDeLaGrille.remunerationNette + pas)

  const points = [...calcules.values()].sort((a, b) => a.remunerationNette - b.remunerationNette)
  return {
    statut,
    remunerationMaximale: maximum,
    points,
    meilleur: meilleurPoint(points),
    meilleurAvecRetraite: meilleurPoint(points.filter(p => p.trimestres >= 4)),
    warnings: []
  }
}
