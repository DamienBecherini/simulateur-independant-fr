// src/backend/logic/net-compare.ts
// Ce sur quoi les colonnes du comparateur se comparent : le net du foyer, moins la perte que l'année laisse dans la
// société comparée.
//
// Une société déficitaire ne verse rien à son dirigeant, ou moins : son net du foyer paraît meilleur que celui de
// l'entreprise individuelle qui porte la même perte, alors que le trou est le même. Il reste dans la société, où
// l'associé devra le combler. Le compter dans la comparaison met les statuts sur le même pied (décision du
// propriétaire, 20 novembre 2026).
//
// Seule la perte compte. Un bénéfice gardé dans la société n'est pas ajouté au net : il n'est pas encore dans la
// poche du foyer, et ce qu'il vaut dépend de ce qu'on en fera (le distribuer coûtera l'impôt des dividendes). Il est
// écrit sous le net, sans entrer dans le classement (décision du propriétaire, 20 novembre 2026). Les dividendes pris
// sur les réserves des années précédentes ne sont pas une perte non plus.

import type { PartageDuBenefice } from "../../types.js"

/** Perte de l'année d'une société à l'IS, en euros positifs : ce que charges, rémunération et cotisations dépassent du chiffre d'affaires. 0 sans perte. */
export function perteDeLaSociete(partage: PartageDuBenefice | undefined): number {
  if (!partage) return 0
  return Math.max(0, -(partage.beneficeAvantRemuneration - partage.remunerationNette - partage.cotisationsRemuneration))
}

/**
 * En dessous, un bénéfice gardé n'est pas écrit sous le net : dotation à la réserve légale, reste d'une rémunération
 * calculée à 100 € près. Le détail du tableau le donne toujours à l'euro.
 */
export const BENEFICE_GARDE_NOTABLE = 1000

/** Ce que l'activité garde de l'année, quand cela vaut d'être dit sous le net ; `undefined` sinon (perte comprise). */
export function beneficeGarde(resultatConserve: number): number | undefined {
  return resultatConserve >= BENEFICE_GARDE_NOTABLE ? resultatConserve : undefined
}

/** Le net du foyer, moins la perte restée dans la société comparée : c'est lui qui désigne le meilleur statut et mesure les écarts. */
export function netCompare(colonne: { netApresImpots: number; perteConservee?: number }): number {
  return colonne.netApresImpots - (colonne.perteConservee ?? 0)
}
