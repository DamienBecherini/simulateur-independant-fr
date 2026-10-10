// src/lib/salary-utils.ts

import { brutPourUnNet, calculerCotisationsSalarie } from "@/backend/logic/cotisationsSalarie"
import type { ReglesFiscales } from "@/backend/logic/regles"

const roundToCents = (amount: number) => Math.round(amount * 100) / 100

export function netFromGross(gross: number, ratio: number): number {
  return roundToCents(gross * ratio)
}

export function grossFromNet(net: number, ratio: number): number {
  return roundToCents(net / ratio)
}

/*
 * Brut et net d'un salaire mensuel saisi sans pourcentage : calculés avec les cotisations salariales du régime général
 * de l'année (cotisationsSalarie.ts), comme le moteur le fait pour un salarié d'une activité de la simulation.
 * Approximation : le salaire du mois est supposé le même les douze mois de l'année (les tranches des cotisations et de
 * la CSG sont annuelles, en part du plafond de la sécurité sociale), et la personne est un salarié non cadre du secteur
 * privé, sans mutuelle, prévoyance ni épargne salariale d'entreprise. Un bulletin de paie réel peut donc s'en écarter
 * de quelques pour cent ; l'utilisateur saisit alors son brut ou son pourcentage.
 */

/** Brut mensuel d'un salarié pour un net mensuel (avant impôt sur le revenu), avec les cotisations de l'année. */
export function brutCalcule(netMensuel: number, regles: ReglesFiscales): number {
  return roundToCents(brutPourUnNet(netMensuel * 12, "salarie", regles.regimeGeneral) / 12)
}

/** Net mensuel d'un salarié (avant impôt sur le revenu) pour un brut mensuel, avec les cotisations de l'année. */
export function netCalcule(brutMensuel: number, regles: ReglesFiscales): number {
  if (brutMensuel <= 0) return 0
  return roundToCents(calculerCotisationsSalarie(brutMensuel * 12, "salarie", regles.regimeGeneral).net / 12)
}

/** Ratio net / brut d'un salaire, ou `null` si le brut n'est pas renseigné. */
export function netRatio(net: number, gross: number | undefined): number | null {
  if (gross === undefined || gross <= 0) return null
  return net / gross
}

/**
 * Analyse un pourcentage saisi par l'utilisateur (« 78 », « 78,5 », « 78 % »).
 * @returns Le ratio (0,78), ou `null` si la saisie est vide ou hors de l'intervalle ]0 % ; 100 %].
 */
export function parsePercent(input: string): number | null {
  const normalized = input.replace(/[\s%]/g, "").replace(",", ".")
  if (!/^(\d+\.?\d*|\.\d+)$/.test(normalized)) return null
  const ratio = Number(normalized) / 100
  return ratio > 0 && ratio <= 1 ? ratio : null
}

/** Formate un ratio pour un champ de saisie : « 78 » ou « 78,5 ». */
export function formatPercent(ratio: number): string {
  return (ratio * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })
}
