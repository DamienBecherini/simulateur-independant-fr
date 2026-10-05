// src/backend/logic/cotisationsSalarie.ts

import type { CotisationSalarie, DetailCotisationsSalarie } from "../../types.js"
import { parTranches } from "./cotisationsTNS.js"
import type { CotisationRegimeGeneral, ReglesRegimeGeneral } from "./regles.js"

/*
 * Cotisations et contributions sociales du régime général, ligne à ligne, sur une rémunération brute annuelle :
 *   - président de SASU, assimilé salarié : parts salariale et patronale, mais ni assurance chômage, ni AGS, ni
 *     contribution au dialogue social, et pas de réduction générale (il n'a pas de contrat de travail) ;
 *   - salarié : toutes les cotisations, et la réduction générale dégressive unique des cotisations patronales.
 * Chaque cotisation s'applique par tranches du plafond de la sécurité sociale ; la CSG et la CRDS portent sur
 * 98,25 % du brut jusqu'à 4 plafonds. Comme pour les indépendants, les montants ne sont pas arrondis au centime.
 */

export type StatutSalarie = DetailCotisationsSalarie["statut"]
type Montants = DetailCotisationsSalarie["cotisations"][CotisationSalarie]

/** Nombre de divisions de l'intervalle par deux dans la recherche du brut. */
const ITERATIONS_DICHOTOMIE = 60

const AUCUNE: Montants = { salariale: 0, patronale: 0 }

function ligne(brut: number, cotisation: CotisationRegimeGeneral, statut: StatutSalarie, pass: number): Montants {
  if (cotisation.salariesSeulement && statut === "president") return AUCUNE
  // La contribution d'équilibre technique n'est due qu'au-delà du plafond, mais alors sur tout le brut.
  if (cotisation.auDelaDuPlafondSeulement && brut <= pass) return AUCUNE
  return { salariale: parTranches(brut, cotisation.salariale, pass), patronale: parTranches(brut, cotisation.patronale, pass) }
}

/**
 * Réduction générale dégressive unique : coefficient C = Tmin + Tdelta x (k x (3 x SMIC / brut - 1))^P, arrondi à
 * 4 décimales et plafonné à Tmin + Tdelta, appliqué au brut. k vaut 1/2 pour un plafond de 3 SMIC : il ramène la
 * parenthèse à 1 au niveau du SMIC, où la réduction est maximale ; elle s'éteint à 3 SMIC.
 */
export function reductionGenerale(brut: number, regles: ReglesRegimeGeneral["reductionGenerale"]): number {
  const { smicAnnuel, tMin, tDelta, puissance, plafondEnSmic } = regles
  // Plafond arrondi au centime : 3 x 21 876,40 vaut 65 629,200000000001 en virgule flottante, et un brut d'exactement
  // 3 SMIC garderait sinon la réduction minimale.
  const plafond = Math.round(plafondEnSmic * smicAnnuel * 100) / 100
  if (brut <= 0 || brut >= plafond) return 0
  const degressivite = (plafond / brut - 1) / (plafondEnSmic - 1)
  const coefficient = Math.min(tMin + tDelta, tMin + tDelta * degressivite ** puissance)
  return (brut * Math.round(coefficient * 10000)) / 10000
}

/** Bulletin de paie annuel : toutes les cotisations d'une rémunération brute, et ce qu'elle coûte à l'employeur. */
export function calculerCotisationsSalarie(brut: number, statut: StatutSalarie, regles: ReglesRegimeGeneral): DetailCotisationsSalarie {
  const pass = regles.plafondSecuriteSociale
  const { csgDeductible, csgNonDeductible, crds } = regles.csgCrds
  const assietteCsg = parTranches(brut, regles.csgCrds.assiette, pass)

  const cotisations = {
    ...(Object.fromEntries(Object.entries(regles.cotisations).map(([nom, cotisation]) => [nom, ligne(brut, cotisation, statut, pass)])) as Record<keyof ReglesRegimeGeneral["cotisations"], Montants>),
    csgDeductible: { salariale: assietteCsg * csgDeductible, patronale: 0 },
    csgNonDeductibleEtCrds: { salariale: assietteCsg * (csgNonDeductible + crds), patronale: 0 }
  }
  const montants = Object.values(cotisations)
  const totalSalarial = montants.reduce((somme, { salariale }) => somme + salariale, 0)
  const totalPatronal = montants.reduce((somme, { patronale }) => somme + patronale, 0)
  const reduction = statut === "salarie" ? Math.min(totalPatronal, reductionGenerale(brut, regles.reductionGenerale)) : 0

  return {
    statut,
    brut,
    net: brut - totalSalarial,
    cotisations,
    totalSalarial,
    totalPatronal,
    reductionGenerale: reduction,
    coutEmployeur: brut + totalPatronal - reduction,
    partNonDeductible: cotisations.csgNonDeductibleEtCrds.salariale
  }
}

/**
 * Brut B tel que B - cotisations salariales(B) = net, trouvé par dichotomie comme le revenu du gérant d'EURL :
 * le net croît avec le brut (aucun taux marginal n'atteint 100 %), sauf au plafond, où la contribution d'équilibre
 * technique, due alors sur tout le brut, le fait baisser d'un coup (0,14 % du plafond, 67 € en 2026). Un net de
 * cet intervalle a deux bruts possibles, de part et d'autre du plafond : la dichotomie retient l'un des deux. B est encadré entre `net`
 * et `net + écart`, l'écart doublant jusqu'à couvrir les cotisations, puis l'intervalle est divisé par deux à
 * chaque tour. Une rémunération nulle ou négative n'a ni brut ni cotisations.
 */
export function brutPourUnNet(net: number, statut: StatutSalarie, regles: ReglesRegimeGeneral): number {
  if (net <= 0) return 0
  const netDe = (brut: number) => calculerCotisationsSalarie(brut, statut, regles).net
  let ecart = net
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
