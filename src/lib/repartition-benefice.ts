// src/lib/repartition-benefice.ts
// Calculs de la barre de partage du bénéfice d'une société : postes arrondis dont la somme tombe juste, aperçu
// pendant qu'on fait glisser une poignée (avant que le moteur ne recalcule), pas des poignées au clavier, et ce qui
// rend la barre réglable.

import type { ComparaisonOptions, OptimisationRemuneration, PartageDuBenefice, StatutSociete } from "@/types"

export type PosteDuPartage = "remunerationNette" | "cotisationsRemuneration" | "impotSocietes" | "dividendesNets" | "cotisationsSurDividendes" | "resultatConserve"

/** Les postes, dans l'ordre de la barre : ce qui part au dirigeant, ce qui est prélevé, ce qui reste. */
export const POSTES: PosteDuPartage[] = ["remunerationNette", "cotisationsRemuneration", "impotSocietes", "dividendesNets", "cotisationsSurDividendes", "resultatConserve"]

export const libellesPostes: Record<PosteDuPartage, string> = {
  remunerationNette: "Rémunération nette",
  cotisationsRemuneration: "Cotisations sur la rémunération",
  impotSocietes: "Impôt sur les sociétés",
  dividendesNets: "Dividendes",
  cotisationsSurDividendes: "Cotisations sur les dividendes",
  resultatConserve: "Ajouté aux réserves"
}

/** Pas des poignées : 100 € de rémunération, 5 % de part distribuée. */
export const PAS_REMUNERATION = 100
export const PAS_PART = 0.05

/**
 * Postes arrondis à l'euro, dont la somme reste égale au bénéfice arrondi (méthode du plus fort reste) :
 * la légende tombe juste, à l'euro près.
 */
export function postesArrondis(partage: PartageDuBenefice): Record<PosteDuPartage, number> {
  const planchers = POSTES.map(poste => Math.floor(partage[poste]))
  let ecart = Math.round(POSTES.reduce((somme, poste) => somme + partage[poste], 0)) - planchers.reduce((a, b) => a + b, 0)
  const parReste = POSTES.map((poste, i) => ({ i, reste: partage[poste] - planchers[i] })).sort((a, b) => b.reste - a.reste)
  for (const { i } of parReste) {
    if (ecart <= 0) break
    planchers[i] += 1
    ecart -= 1
  }
  return Object.fromEntries(POSTES.map((poste, i) => [poste, planchers[i]])) as Record<PosteDuPartage, number>
}

/** Coût de la rémunération pour la société : le net et ses cotisations. */
export const coutRemuneration = (partage: PartageDuBenefice) => partage.remunerationNette + partage.cotisationsRemuneration

/** Dividendes versés (cotisations sur dividendes comprises). */
export const dividendesVerses = (partage: PartageDuBenefice) => partage.dividendesNets + partage.cotisationsSurDividendes

/** Part du bénéfice distribuable (après IS) versée en dividendes. */
export function partDistribueeDe(partage: PartageDuBenefice): number {
  const distribuable = dividendesVerses(partage) + partage.resultatConserve
  return distribuable > 0 ? dividendesVerses(partage) / distribuable : 0
}

type Point = [number, number]

/** Interpolation linéaire par morceaux entre des points triés, prolongée par le dernier segment au-delà. */
function interpoler(points: Point[], x: number): number {
  if (points.length === 1) return points[0][1]
  let i = 1
  while (i < points.length - 1 && x > points[i][0]) i++
  const [[x0, y0], [x1, y1]] = [points[i - 1], points[i]]
  return x1 === x0 ? y1 : y0 + ((x - x0) * (y1 - y0)) / (x1 - x0)
}

/**
 * Points connus du coût d'une rémunération : la rémunération simulée (coût exact) et la rémunération maximale,
 * qui coûte à peu près tout le bénéfice ; à zéro, le coût est nul, sauf s'il est connu.
 */
function pointsDeCout(partage: PartageDuBenefice, remunerationMaximale: number): Point[] {
  const actuel: Point = [partage.remunerationNette, coutRemuneration(partage)]
  const points: Point[] = actuel[0] > 0 ? [[0, 0], actuel] : [actuel]
  if (remunerationMaximale > actuel[0]) points.push([remunerationMaximale, Math.max(actuel[1], partage.beneficeAvantRemuneration)])
  return points
}

/** Coût estimé d'une rémunération nette. */
export function coutEstime(partage: PartageDuBenefice, remunerationMaximale: number, remuneration: number): number {
  if (remuneration === partage.remunerationNette) return coutRemuneration(partage)
  return Math.max(0, interpoler(pointsDeCout(partage, remunerationMaximale), remuneration))
}

/** Rémunération nette dont le coût estimé est celui donné : la réciproque de coutEstime. */
export function remunerationPourUnCout(partage: PartageDuBenefice, remunerationMaximale: number, cout: number): number {
  const points = pointsDeCout(partage, remunerationMaximale).map(([r, c]): Point => [c, r])
  return Math.max(0, interpoler(points, cout))
}

/**
 * Partage estimé pour une autre rémunération ou une autre part distribuée, le temps que le moteur recalcule :
 * l'IS suit le bénéfice restant, les cotisations sur dividendes suivent les dividendes. La somme des postes reste
 * celle du bénéfice ; pour la rémunération et la part simulées, c'est le partage exact.
 */
export function apercuDuPartage(partage: PartageDuBenefice, remunerationMaximale: number, remuneration: number, part: number): PartageDuBenefice {
  const benefice = partage.beneficeAvantRemuneration
  const cout = coutEstime(partage, remunerationMaximale, remuneration)
  const resteSimule = benefice - coutRemuneration(partage)
  const reste = benefice - cout
  const impotSocietes = resteSimule > 0 ? partage.impotSocietes * (Math.max(0, reste) / resteSimule) : 0
  const verses = part * Math.max(0, reste - impotSocietes)
  const versesSimules = dividendesVerses(partage)
  const cotisationsSurDividendes = versesSimules > 0 ? partage.cotisationsSurDividendes * (verses / versesSimules) : 0
  return {
    beneficeAvantRemuneration: benefice,
    remunerationNette: remuneration,
    cotisationsRemuneration: cout - remuneration,
    impotSocietes,
    dividendesNets: verses - cotisationsSurDividendes,
    cotisationsSurDividendes,
    resultatConserve: reste - impotSocietes - verses
  }
}

/** Valeur arrondie au pas et ramenée entre les bornes. */
export function auPas(valeur: number, pas: number, min: number, max: number): number {
  // Arrondi à 6 décimales : 7 × 0,05 doit donner 0,35, pas 0,35000000000000003.
  return Math.min(max, Math.max(min, Number((Math.round(valeur / pas) * pas).toFixed(6))))
}

/** Nouvelle valeur d'un curseur après une touche (flèches, pages, début, fin), ou `null` pour une autre touche. */
export function valeurAuClavier(touche: string, valeur: number, bornes: { min: number; max: number; pas: number; grandPas: number }): number | null {
  const { min, max, pas, grandPas } = bornes
  const deplacements: Record<string, number> = { ArrowRight: pas, ArrowUp: pas, ArrowLeft: -pas, ArrowDown: -pas, PageUp: grandPas, PageDown: -grandPas }
  if (touche === "Home") return min
  if (touche === "End") return max
  if (!(touche in deplacements)) return null
  return auPas(valeur + deplacements[touche], pas, min, max)
}

/**
 * Ce qui rend la barre réglable : une répartition personnalisée et l'arbitrage rémunération / dividendes du statut
 * affiché (celui d'un autre statut est périmé). `optimisationReglable` donne aussi les répartitions toutes faites ;
 * sans elle, pas de poignées (`remunerationMaximale` vaut `null`).
 */
export function reglageDeLaBarre(options: ComparaisonOptions, optimisation: OptimisationRemuneration | null, statut: StatutSociete) {
  const personnalisee = options.repartition.mode === "personnalisee"
  const optimisationReglable = personnalisee && optimisation?.statut === statut ? optimisation : null
  return { personnalisee, optimisationReglable, remunerationMaximale: optimisationReglable?.remunerationMaximale ?? null }
}
