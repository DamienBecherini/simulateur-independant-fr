// src/backend/logic/cotisationsTNS.ts

import type { CotisationTNS, DetailCotisationsTNS } from "../../types.js"
import { euros } from "./format.js"
import type { BaremeProgressif, ReglesTNS, TrancheCotisation } from "./regles.js"

/*
 * Cotisations et contributions sociales d'un travailleur non salarié (gérant majoritaire d'EURL, entrepreneur
 * individuel au réel), ligne à ligne, selon les règles en vigueur depuis la réforme de l'assiette :
 *   1. le revenu professionnel avant cotisations est diminué d'un abattement forfaitaire (26 %, borné) ;
 *   2. chaque cotisation, et la CSG-CRDS, s'applique à cette assiette unique selon son propre barème ;
 *   3. certaines cotisations sont dues au moins sur une assiette minimale, même sans revenu.
 */

export interface CotisationsTNS extends DetailCotisationsTNS {
  /** Supplément dû aux assiettes minimales, par rapport au calcul sur l'assiette réelle. */
  supplementMinimum: number
  /** L'assiette est sous l'assiette minimale de la retraite de base : c'est elle qui fixe les trimestres validés. */
  minimumRetraiteApplique: boolean
}

/** Nombre de divisions de l'intervalle par deux dans la recherche du revenu avant cotisations. */
const ITERATIONS_DICHOTOMIE = 60

/** Assiette unique : le revenu avant cotisations, moins l'abattement forfaitaire borné ; jamais négative. */
export function assietteSociale(revenuAvantCotisations: number, regles: ReglesTNS): number {
  const { taux, minimumPartDuPlafond, maximumPartDuPlafond } = regles.abattement
  const pass = regles.plafondSecuriteSociale
  const abattement = Math.min(Math.max(revenuAvantCotisations * taux, minimumPartDuPlafond * pass), maximumPartDuPlafond * pass)
  return Math.max(0, revenuAvantCotisations - abattement)
}

/** Cotisation à taux marginaux : chaque tranche ne s'applique qu'à la part de l'assiette comprise entre ses bornes. */
function parTranches(assiette: number, tranches: TrancheCotisation[], pass: number): number {
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
function progressive(assiette: number, bareme: BaremeProgressif, pass: number): number {
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

/** Toutes les cotisations et contributions d'une année, à partir du revenu professionnel avant cotisations. */
export function calculerCotisationsTNS(revenuAvantCotisations: number, regles: ReglesTNS): CotisationsTNS {
  const pass = regles.plafondSecuriteSociale
  const assiette = assietteSociale(revenuAvantCotisations, regles)
  const minimales = regles.cotisationsMinimales
  const { csgDeductible, csgNonDeductible, crds } = regles.csgCrds
  const avecMinimum = (minimum: number, tranches: TrancheCotisation[]) => parTranches(Math.max(assiette, minimum), tranches, pass)

  const cotisations: Record<CotisationTNS, number> = {
    maladieMaternite: progressive(assiette, regles.maladieMaternite, pass),
    indemnitesJournalieres: avecMinimum(minimales.indemnitesJournalieres, regles.indemnitesJournalieres.tranches),
    retraiteDeBase: avecMinimum(minimales.retraiteDeBase, regles.retraiteDeBase.tranches),
    retraiteComplementaire: parTranches(assiette, regles.retraiteComplementaire.tranches, pass),
    invaliditeDeces: avecMinimum(minimales.invaliditeDeces, regles.invaliditeDeces.tranches),
    allocationsFamiliales: progressive(assiette, regles.allocationsFamiliales, pass),
    csgDeductible: assiette * csgDeductible,
    csgNonDeductibleEtCrds: assiette * (csgNonDeductible + crds),
    formationProfessionnelle: pass * regles.formationProfessionnelle.tauxSurPlafond
  }
  const surAssietteReelle = [regles.indemnitesJournalieres, regles.retraiteDeBase, regles.invaliditeDeces].reduce((somme, { tranches }) => somme + parTranches(assiette, tranches, pass), 0)

  return {
    revenuAvantCotisations,
    assiette,
    cotisations,
    total: Object.values(cotisations).reduce((somme, montant) => somme + montant, 0),
    partNonDeductible: cotisations.csgNonDeductibleEtCrds,
    supplementMinimum: cotisations.indemnitesJournalieres + cotisations.retraiteDeBase + cotisations.invaliditeDeces - surAssietteReelle,
    minimumRetraiteApplique: assiette < minimales.retraiteDeBase
  }
}

/**
 * Revenu avant cotisations R tel que R - cotisations(R) = net. C'est la rémunération d'un gérant dont la société
 * paie les cotisations : pour l'Urssaf, leur prise en charge fait partie de sa rémunération.
 *
 * R - cotisations(R) est continue et strictement croissante (les cotisations augmentent toujours moins vite que
 * le revenu), d'où une solution unique, trouvée par dichotomie : elle est encadrée entre `net` (les cotisations
 * sont positives) et `net + écart`, l'écart doublant jusqu'à couvrir les cotisations ; l'intervalle est ensuite
 * divisé par deux à chaque tour, jusqu'à une précision bien inférieure au centime.
 */
export function revenuAvantCotisationsPourUnNet(net: number, regles: ReglesTNS): number {
  const netDe = (revenu: number) => revenu - calculerCotisationsTNS(revenu, regles).total
  let ecart = Math.max(1, Math.abs(net))
  while (netDe(net + ecart) < net) ecart *= 2

  let bas = net
  let haut = net + ecart
  for (let tour = 0; tour < ITERATIONS_DICHOTOMIE; tour++) {
    const milieu = (bas + haut) / 2
    if (netDe(milieu) < net) bas = milieu
    else haut = milieu
  }
  return haut
}

/** Avertissement quand l'assiette minimale de la retraite de base s'applique, avec le supplément qu'elles coûtent. */
export function avertissementCotisationsMinimales(cotisations: CotisationsTNS, qui: string): string[] {
  if (!cotisations.minimumRetraiteApplique) return []
  return [
    `Cotisations minimales ${qui} appliquées : le revenu est trop faible, une partie des cotisations (retraite de base, indemnités journalières, invalidité-décès) est due sur une assiette minimale, soit ${euros(cotisations.supplementMinimum)} de plus. Elles sont dues même sans revenu, et valident 3 trimestres de retraite.`
  ]
}
