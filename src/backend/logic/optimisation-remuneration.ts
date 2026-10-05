// src/backend/logic/optimisation-remuneration.ts

import type { ComparaisonOptions, OptimisationRemuneration, PointRemuneration, DonneesDeLAnnee, StatutSociete } from "../../types.js"
import { activiteComparee, beneficeAvantDividendes, simulerScenario, type Activite } from "./comparateur.js"
import { reglesEnVigueur, type ReglesFiscales } from "./regles.js"
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
 */

/** Précision des rémunérations proposées. */
const PRECISION = 100
/** Nombre de points visés sur la grille. */
const POINTS_DE_GRILLE = 60

const arrondiInferieur = (montant: number) => Math.floor(montant / PRECISION) * PRECISION

function calculerPoint(session: DonneesDeLAnnee, source: Activite, statut: StatutSociete, options: ComparaisonOptions, remunerationNette: number, regles: ReglesFiscales, contexte: ContexteDeLAnnee): PointRemuneration {
  const { scenario, dividendes } = simulerScenario(session, source, statut, { ...options, remunerationNette, distribuerToutLeBenefice: true }, regles, contexte)
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

/**
 * Rémunération nette la plus haute qui laisse un bénéfice positif ou nul, à 100 € près. Le bénéfice baisse quand
 * la rémunération monte : on double la borne haute jusqu'à le rendre négatif, puis on procède par dichotomie.
 */
function remunerationMaximale(benefice: (remuneration: number) => number): number {
  let haut = Math.max(PRECISION, benefice(0))
  for (let i = 0; i < 20 && benefice(haut) >= 0; i++) haut *= 2
  let bas = 0
  while (haut - bas > PRECISION / 10) {
    const milieu = (bas + haut) / 2
    if (benefice(milieu) >= 0) bas = milieu
    else haut = milieu
  }
  return arrondiInferieur(bas)
}

/** Le point au meilleur net ; à net égal, celui qui valide le plus de trimestres, puis la plus petite rémunération. */
function meilleurPoint(points: PointRemuneration[]): PointRemuneration | null {
  return points.reduce<PointRemuneration | null>((meilleur, point) => {
    if (!meilleur) return point
    if (point.netApresImpots !== meilleur.netApresImpots) return point.netApresImpots > meilleur.netApresImpots ? point : meilleur
    return point.trimestres > meilleur.trimestres ? point : meilleur
  }, null)
}

export function optimiserRemuneration(session: DonneesDeLAnnee, options: ComparaisonOptions, statut: StatutSociete, regles: ReglesFiscales = reglesEnVigueur, contexte: ContexteDeLAnnee = {}): OptimisationRemuneration {
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
    for (let r = arrondiInferieur(Math.max(0, de)); r <= Math.min(maximum, a); r += PRECISION) point(r)
  }

  const pas = Math.max(PRECISION, Math.ceil(maximum / POINTS_DE_GRILLE / PRECISION) * PRECISION)
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
