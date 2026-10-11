// src/backend/logic/sous-la-situation-saisie.ts

import type { RaisonSousLaSituationSaisie, ScenarioStatut, SousLaSituationSaisie } from "../../types.js"
import { euros } from "./format.js"
import { PRECISION_REMUNERATION } from "./simulation-d-un-statut.js"

/*
 * Le meilleur statut du comparateur peut faire moins bien que la situation saisie quand celle-ci n'est pas une colonne
 * retenue : société simulée avec un autre partage que la grille (au meilleur net, avec 4 trimestres de retraite exigés),
 * ou statut actuel écarté du meilleur net (micro hors plafond, régime fermé, société d'exercice libéral). La situation
 * saisie n'est pas désignée pour autant : le verdict dit de combien le meilleur statut fait moins bien, et pourquoi.
 */

/** Ce que le comparateur sait de la situation saisie pour expliquer l'écart. */
export interface ReferenceDeLaSituationSaisie {
  netApresImpots: number
  /** Trimestres de retraite que la situation saisie valide. */
  trimestres: number
  /** Pourquoi la colonne du statut actuel n'est pas retenue comme meilleur statut ; `null` si elle peut l'être. */
  motifNonRetenu: string | null
}

const EXPLICATIONS: Record<RaisonSousLaSituationSaisie, (ecart: number, motif: string | null) => string> = {
  trimestres: ecart => `Valider 4 trimestres de retraite vous coûterait environ ${euros(ecart)} par rapport à votre situation telle que saisie.`,
  statutActuelNonRetenu: (ecart, motif) => `Votre statut actuel n'est pas retenu comme meilleur statut (${motif ?? "voir les notes"}) : le meilleur des autres vous coûterait environ ${euros(ecart)} par rapport à votre situation telle que saisie.`,
  reglages: ecart => `Avec ces réglages du comparateur, aucun statut comparé ne fait mieux que votre situation telle que saisie : le meilleur vous coûterait environ ${euros(ecart)}.`
}

/**
 * Les 4 trimestres expliquent l'écart quand le meilleur statut les exige, en valide plus que la situation saisie, et
 * que sans eux il la rejoindrait, à la précision de l'optimiseur près.
 */
function parLesTrimestres(meilleur: ScenarioStatut, saisie: ReferenceDeLaSituationSaisie, ecart: number): boolean {
  const retenue = meilleur.remunerationOptimale
  const cout = retenue?.coutDesQuatreTrimestres ?? 0
  return retenue?.avecRetraite === true && cout > 0 && meilleur.protectionSociale.trimestres > saisie.trimestres && ecart <= cout + PRECISION_REMUNERATION
}

function raisonDeLEcart(meilleur: ScenarioStatut, saisie: ReferenceDeLaSituationSaisie, ecart: number): RaisonSousLaSituationSaisie {
  if (parLesTrimestres(meilleur, saisie, ecart)) return "trimestres"
  return saisie.motifNonRetenu === null ? "reglages" : "statutActuelNonRetenu"
}

/** L'écart du meilleur statut avec la situation saisie, quand il fait moins bien qu'elle d'au moins un euro, et pourquoi. */
export function sousLaSituationSaisie(meilleur: ScenarioStatut | undefined, saisie: ReferenceDeLaSituationSaisie): SousLaSituationSaisie | undefined {
  if (!meilleur || meilleur.telleQueSaisie) return undefined
  const ecart = Math.round(saisie.netApresImpots - meilleur.netApresImpots)
  if (ecart <= 0) return undefined
  const raison = raisonDeLEcart(meilleur, saisie, ecart)
  return { ecart, raison, explication: EXPLICATIONS[raison](ecart, saisie.motifNonRetenu) }
}
