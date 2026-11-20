// src/backend/logic/remuneration-maximale.ts
// La plus haute rémunération qu'une société peut verser à son dirigeant sans déficit. Le calcul ne connaît que la
// fonction qui donne le bénéfice pour une rémunération : le comparateur lui passe la simulation d'une colonne, le moteur
// le calcul de la société elle-même (pour dire où est la limite quand la grille la dépasse).

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
