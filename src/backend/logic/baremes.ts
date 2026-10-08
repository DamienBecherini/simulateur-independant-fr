// src/backend/logic/baremes.ts

import type { BaremeProgressif, TrancheCotisation } from "./regles.js"

/** Cotisation à taux marginaux : chaque tranche ne s'applique qu'à la part de l'assiette comprise entre ses bornes. */
export function parTranches(assiette: number, tranches: TrancheCotisation[], pass: number): number {
  let cotisation = 0
  let bas = 0
  for (const { jusquA, taux } of tranches) {
    const haut = jusquA === null ? Infinity : jusquA * pass
    cotisation += Math.max(0, Math.min(assiette, haut) - bas) * taux
    bas = haut
  }
  return cotisation
}

/**
 * Cotisation à taux progressif (maladie-maternité, allocations familiales) : sous le dernier point du barème,
 * un seul taux, interpolé linéairement entre les deux points qui encadrent l'assiette, s'applique à toute
 * l'assiette ; au-delà, le taux du dernier point jusqu'à son seuil, et `tauxAuDela` sur le surplus.
 */
export function progressive(assiette: number, bareme: BaremeProgressif, pass: number): number {
  const { points, tauxAuDela } = bareme
  const dernier = points[points.length - 1]
  const seuilDernier = dernier.partDuPlafond * pass
  if (assiette >= seuilDernier) return seuilDernier * dernier.taux + (assiette - seuilDernier) * tauxAuDela

  const part = assiette / pass
  const suivant = points.findIndex(point => part <= point.partDuPlafond)
  if (suivant === 0) return assiette * points[0].taux
  const [a, b] = [points[suivant - 1], points[suivant]]
  return assiette * (a.taux + ((b.taux - a.taux) * (part - a.partDuPlafond)) / (b.partDuPlafond - a.partDuPlafond))
}
