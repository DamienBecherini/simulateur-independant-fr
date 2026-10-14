// src/backend/logic/cotisationsSalarie.ts

import type { CotisationPortage, CotisationPortageAuBareme, CotisationSalarie, DetailCotisationsSalarie } from "../../types.js"
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

/** Chaque cotisation d'un barème, calculée sur le brut. */
function lignes<Nom extends string>(brut: number, bareme: Record<Nom, CotisationRegimeGeneral>, statut: StatutSalarie, pass: number): Record<Nom, Montants> {
  return Object.fromEntries(Object.entries<CotisationRegimeGeneral>(bareme).map(([nom, cotisation]) => [nom, ligne(brut, cotisation, statut, pass)])) as Record<Nom, Montants>
}

/**
 * Ce que le bulletin d'un salarié porté change à celui d'un salarié (voir l'ADR 016 et `parametresDuBulletinDuPorte`,
 * simulation-portage.ts) : les règles du régime général où les lignes et la réduction générale qui dépendent de
 * l'effectif de la société de portage sont déjà remplacées, les cotisations propres au salarié porté, et si la réduction
 * générale lui est reversée.
 */
export interface BulletinDuPorte {
  regimeGeneral: ReglesRegimeGeneral
  cotisationsDuPortage: Record<CotisationPortageAuBareme, CotisationRegimeGeneral>
  /** Taux du forfait social sur la prévoyance patronale : 0 sous 11 salariés. */
  forfaitSocialSurLaPrevoyance: number
  reductionGeneraleReversee: boolean
}

/** Bulletin de paie annuel : toutes les cotisations d'une rémunération brute, et ce qu'elle coûte à l'employeur. */
export function calculerCotisationsSalarie(brut: number, statut: Exclude<StatutSalarie, "porte">, regles: ReglesRegimeGeneral): DetailCotisationsSalarie {
  return bulletinDePaie(brut, statut, regles, statut === "salarie")
}

/**
 * Bulletin de paie annuel d'un salarié porté : celui d'un salarié, avec les lignes de l'effectif de la société de
 * portage, ses cotisations propres (cadre, effort de construction, versement mobilité, formation conventionnelle), et la
 * réduction générale seulement si la société la reverse : sinon, elle la garde, et le coût pris sur l'enveloppe du
 * salarié porté est celui d'avant la réduction.
 */
export function calculerBulletinDuPorte(brut: number, porte: BulletinDuPorte): DetailCotisationsSalarie {
  return bulletinDePaie(brut, "porte", porte.regimeGeneral, porte.reductionGeneraleReversee, porte)
}

/**
 * Les cotisations propres au salarié porté : celles de leur barème, puis les prélèvements sur la prévoyance patronale.
 * La CSG et la CRDS y portent sur toute la contribution, sans la réduction pour frais professionnels (code de la sécurité
 * sociale, art. L136-1-1 et L136-2) ; le forfait social, là où il est dû (art. L137-15 et L137-16).
 */
function cotisationsPropresAuPorte(brut: number, porte: BulletinDuPorte, pass: number): Record<CotisationPortage, Montants> {
  const { csgDeductible, csgNonDeductible, crds } = porte.regimeGeneral.csgCrds
  const auBareme = lignes(brut, porte.cotisationsDuPortage, "porte", pass)
  const prevoyance = auBareme.prevoyanceCadres.patronale
  return {
    ...auBareme,
    csgCrdsPrevoyance: { salariale: prevoyance * (csgDeductible + csgNonDeductible + crds), patronale: 0 },
    forfaitSocialPrevoyance: { salariale: 0, patronale: prevoyance * porte.forfaitSocialSurLaPrevoyance }
  }
}

/** CSG non déductible et CRDS sur la prévoyance patronale du salarié porté : elles rejoignent son salaire imposable. */
function partNonDeductibleSurLaPrevoyance(cotisationsDuPortage: Record<CotisationPortage, Montants> | undefined, regles: ReglesRegimeGeneral): number {
  if (!cotisationsDuPortage) return 0
  const { csgNonDeductible, crds } = regles.csgCrds
  return cotisationsDuPortage.prevoyanceCadres.patronale * (csgNonDeductible + crds)
}

function bulletinDePaie(brut: number, statut: StatutSalarie, regles: ReglesRegimeGeneral, avecReduction: boolean, porte?: BulletinDuPorte): DetailCotisationsSalarie {
  const pass = regles.plafondSecuriteSociale
  const { csgDeductible, csgNonDeductible, crds } = regles.csgCrds
  const assietteCsg = parTranches(brut, regles.csgCrds.assiette, pass)

  const cotisations = {
    ...lignes(brut, regles.cotisations, statut, pass),
    csgDeductible: { salariale: assietteCsg * csgDeductible, patronale: 0 },
    csgNonDeductibleEtCrds: { salariale: assietteCsg * (csgNonDeductible + crds), patronale: 0 }
  }
  const cotisationsDuPortage = porte ? cotisationsPropresAuPorte(brut, porte, pass) : undefined
  const montants = [...Object.values(cotisations), ...Object.values(cotisationsDuPortage ?? {})]
  const totalSalarial = montants.reduce((somme, { salariale }) => somme + salariale, 0)
  const totalPatronal = montants.reduce((somme, { patronale }) => somme + patronale, 0)
  const reduction = avecReduction ? Math.min(totalPatronal, reductionGenerale(brut, regles.reductionGenerale)) : 0

  return {
    statut,
    brut,
    net: brut - totalSalarial,
    cotisations,
    totalSalarial,
    totalPatronal,
    reductionGenerale: reduction,
    coutEmployeur: brut + totalPatronal - reduction,
    partNonDeductible: cotisations.csgNonDeductibleEtCrds.salariale + partNonDeductibleSurLaPrevoyance(cotisationsDuPortage, regles),
    ...(cotisationsDuPortage ? { cotisationsDuPortage } : {})
  }
}

/**
 * Brut B tel que B - cotisations salariales(B) = net, trouvé par dichotomie comme le revenu du gérant d'EURL :
 * le net croît avec le brut (aucun taux marginal n'atteint 100 %), sauf au plafond, où la contribution d'équilibre
 * technique, due alors sur tout le brut, le fait baisser d'un coup (0,14 % du plafond, 67 € en 2026). Un net de
 * cet intervalle a deux bruts possibles, de part et d'autre du plafond : on retient le plus petit, moins cher pour
 * la société. Si le brut du plafond suffit à atteindre le net, B est encadré entre `net` et le plafond, où le net
 * croît avec le brut ; sinon entre `net` et `net + écart`, l'écart doublant jusqu'à couvrir les cotisations.
 * L'intervalle est ensuite divisé par deux à chaque tour. Une rémunération nulle ou négative n'a ni brut ni cotisations.
 */
export function brutPourUnNet(net: number, statut: Exclude<StatutSalarie, "porte">, regles: ReglesRegimeGeneral): number {
  if (net <= 0) return 0
  const netDe = (brut: number) => calculerCotisationsSalarie(brut, statut, regles).net
  const plafond = regles.plafondSecuriteSociale
  let haut = plafond
  if (netDe(plafond) < net) {
    let ecart = net
    while (netDe(net + ecart) < net) ecart *= 2
    haut = net + ecart
  }

  let bas = net
  for (let tour = 0; tour < ITERATIONS_DICHOTOMIE; tour++) {
    const milieu = (bas + haut) / 2
    if (netDe(milieu) < net) bas = milieu
    else haut = milieu
  }
  return haut
}
