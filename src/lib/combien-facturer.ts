// src/lib/combien-facturer.ts
// « Combien facturer ? », le calcul à l'envers du comparateur (src/backend/logic/chiffre-d-affaires-pour-un-net.ts) :
// la lecture du net visé saisi, et ce que l'écran dit de chaque statut.

import { CHIFFRE_D_AFFAIRES_MAXIMAL } from "@/backend/logic/options-du-comparateur"
import { euros } from "@/backend/logic/format"
import type { ChiffreDAffairesDUnStatut, ChiffreDAffairesPourUnNet, RaisonHorsDePortee } from "@/types"

/** Ce que dit un statut dont aucun chiffre d'affaires ne donne le net visé, à la place d'un montant. */
const RAISONS_HORS_DE_PORTEE: Record<RaisonHorsDePortee, string> = {
  plafondMicro: "hors de portée : plafond dépassé",
  regimeMicroFerme: "hors de portée : régime micro fermé",
  partageSelonLaGrille: "hors de portée : rémunération et dividendes fixés par la grille",
  auDelaDeLaBorne: `hors de portée : plus de ${euros(CHIFFRE_D_AFFAIRES_MAXIMAL)} de chiffre d'affaires`
}

/** Pourquoi le statut n'a pas de chiffre d'affaires ; `null` s'il en a un. */
export function raisonHorsDePortee(colonne: ChiffreDAffairesDUnStatut): string | null {
  return colonne.horsDePortee ? RAISONS_HORS_DE_PORTEE[colonne.horsDePortee] : null
}

/** Le net visé saisi, à l'euro ; `null` tant qu'il est vide, nul, négatif ou au-delà de la borne du calcul. */
export function lireLeNetVise(saisie: string): number | null {
  const texte = saisie.trim()
  if (texte === "") return null
  const net = Math.round(Number(texte))
  return Number.isFinite(net) && net > 0 && net <= CHIFFRE_D_AFFAIRES_MAXIMAL ? net : null
}

/** Le chiffre d'affaires mensuel, arrondi à l'euro. */
export const parMois = (chiffreDAffaires: number) => Math.round(chiffreDAffaires / 12)

/** Chiffre d'affaires nécessaire moins celui saisi ; `null` hors de portée, ou sans chiffre d'affaires saisi. */
export function ecartAvecLeChiffreDAffairesSaisi(colonne: ChiffreDAffairesDUnStatut, saisi: number): number | null {
  return colonne.chiffreDAffaires === null || saisi <= 0 ? null : colonne.chiffreDAffaires - saisi
}

/**
 * La réponse en une phrase, lue par les lecteurs d'écran quand le calcul arrive : le statut qui demande le moins de
 * chiffre d'affaires, ou le net déjà atteint, ou aucun statut.
 */
export function phraseDuCalculALEnvers({ netVise, colonnes }: ChiffreDAffairesPourUnNet): string {
  const atteints = colonnes.filter((c): c is ChiffreDAffairesDUnStatut & { chiffreDAffaires: number } => c.chiffreDAffaires !== null)
  if (atteints.length === 0) return `Aucun statut n'atteint ${euros(netVise)} nets par an.`
  const moins = atteints.reduce((a, b) => (b.chiffreDAffaires < a.chiffreDAffaires ? b : a))
  if (moins.chiffreDAffaires === 0) return `Le foyer atteint déjà ${euros(netVise)} nets par an sans chiffre d'affaires de cette activité.`
  return `Pour ${euros(netVise)} nets par an, il faut au moins ${euros(moins.chiffreDAffaires)} de chiffre d'affaires par an (${euros(parMois(moins.chiffreDAffaires))} par mois), en ${moins.libelle}.`
}
