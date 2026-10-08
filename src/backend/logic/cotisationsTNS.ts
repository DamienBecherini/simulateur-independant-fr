// src/backend/logic/cotisationsTNS.ts

import type { CotisationTNS, DetailCotisationsTNS } from "../../types.js"
import { euros } from "./format.js"
import { parTranches, progressive } from "./baremes.js"
import { cotisationsDeLaCaisse, type CotisationsDeLaCaisse, type ParametresDeLaCaisse } from "./cotisations-liberales.js"
import type { ReglesTNS, TrancheCotisation } from "./regles.js"

export { parTranches } from "./baremes.js"

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

/** Les cotisations des indépendants qui ne relèvent pas d'une caisse de libéraux réglementés (bloc TNS). */
function cotisationsDesIndependants(assiette: number, regles: ReglesTNS): Omit<CotisationsDeLaCaisse, "detail"> & { detail?: undefined } {
  const pass = regles.plafondSecuriteSociale
  const minimales = regles.cotisationsMinimales
  const avecMinimum = (minimum: number, tranches: TrancheCotisation[]) => parTranches(Math.max(assiette, minimum), tranches, pass)
  const lignes = {
    maladieMaternite: progressive(assiette, regles.maladieMaternite, pass),
    indemnitesJournalieres: avecMinimum(minimales.indemnitesJournalieres, regles.indemnitesJournalieres.tranches),
    retraiteDeBase: avecMinimum(minimales.retraiteDeBase, regles.retraiteDeBase.tranches),
    retraiteComplementaire: parTranches(assiette, regles.retraiteComplementaire.tranches, pass),
    invaliditeDeces: avecMinimum(minimales.invaliditeDeces, regles.invaliditeDeces.tranches)
  }
  const surAssietteReelle = [regles.indemnitesJournalieres, regles.retraiteDeBase, regles.invaliditeDeces].reduce((somme, { tranches }) => somme + parTranches(assiette, tranches, pass), 0)
  return {
    lignes,
    supplementMinimum: lignes.indemnitesJournalieres + lignes.retraiteDeBase + lignes.invaliditeDeces - surAssietteReelle,
    minimumRetraiteApplique: assiette < minimales.retraiteDeBase
  }
}

/**
 * Toutes les cotisations et contributions d'une année, à partir du revenu professionnel avant cotisations. Avec une
 * caisse de libéraux réglementés (voir cotisations-liberales.ts), ses barèmes remplacent ceux des indépendants pour la
 * maladie, les indemnités journalières, la retraite et l'invalidité-décès, et l'ASV et la CURPS s'ajoutent au total ;
 * les allocations familiales, la CSG-CRDS et la formation professionnelle restent celles du bloc TNS.
 */
export function calculerCotisationsTNS(revenuAvantCotisations: number, regles: ReglesTNS, caisse?: ParametresDeLaCaisse): CotisationsTNS {
  const pass = regles.plafondSecuriteSociale
  const assiette = assietteSociale(revenuAvantCotisations, regles)
  const { csgDeductible, csgNonDeductible, crds } = regles.csgCrds
  const propres = caisse ? cotisationsDeLaCaisse(assiette, pass, caisse) : cotisationsDesIndependants(assiette, regles)

  const cotisations: Record<CotisationTNS, number> = {
    ...propres.lignes,
    allocationsFamiliales: progressive(assiette, regles.allocationsFamiliales, pass),
    csgDeductible: assiette * csgDeductible,
    csgNonDeductibleEtCrds: assiette * (csgNonDeductible + crds),
    formationProfessionnelle: pass * regles.formationProfessionnelle.tauxSurPlafond
  }
  const detailDeLaCaisse = propres.detail
  const enPlus = detailDeLaCaisse ? detailDeLaCaisse.asv + detailDeLaCaisse.curps : 0

  return {
    revenuAvantCotisations,
    assiette,
    cotisations,
    total: Object.values(cotisations).reduce((somme, montant) => somme + montant, enPlus),
    partNonDeductible: cotisations.csgNonDeductibleEtCrds,
    supplementMinimum: propres.supplementMinimum,
    minimumRetraiteApplique: propres.minimumRetraiteApplique,
    ...(detailDeLaCaisse ? { caisse: detailDeLaCaisse } : {})
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
export function revenuAvantCotisationsPourUnNet(net: number, regles: ReglesTNS, caisse?: ParametresDeLaCaisse): number {
  const netDe = (revenu: number) => revenu - calculerCotisationsTNS(revenu, regles, caisse).total
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
