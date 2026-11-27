// src/backend/logic/testing/revenus-exacts.ts
// Pour les tests : le chiffre d'affaires ou la rémunération nette qui donnent exactement un revenu imposable choisi,
// cotisations déduites. Les cas calculés à la main partent de revenus fiscaux ronds (60 000 € de bénéfice imposable) ;
// le moteur, lui, part de ce qui est saisi.

import { calculerEI } from "../calculsEI.js"
import { calculerCotisationsTNS, revenuAvantCotisationsPourUnNet } from "../cotisationsTNS.js"
import type { ReglesApplicables } from "../regles.js"

/** L'entrée qui donne `cible` à une fonction croissante, à moins d'un millionième d'euro près (dichotomie). */
function antecedent(fonction: (x: number) => number, cible: number): number {
  let bas = 0
  let haut = 4 * cible
  for (let tour = 0; tour < 80; tour++) {
    const milieu = (bas + haut) / 2
    if (fonction(milieu) < cible) bas = milieu
    else haut = milieu
  }
  return haut
}

/** Le chiffre d'affaires, sans charges, qui donne à une entreprise individuelle ce bénéfice imposable, cotisations déduites. */
export function chiffreDAffairesPour(beneficeImposable: number, regles: ReglesApplicables): number {
  return antecedent(ca => calculerEI({ chiffreAffaires: ca, chargesDeductibles: 0 }, regles).revenuImposable, beneficeImposable)
}

/** La rémunération nette qui donne à un gérant d'EURL cette rémunération imposable : CSG non déductible et CRDS comprises. */
export function remunerationNettePour(remunerationImposable: number, regles: ReglesApplicables): number {
  return antecedent(net => net + calculerCotisationsTNS(revenuAvantCotisationsPourUnNet(net, regles), regles).partNonDeductible, remunerationImposable)
}
