// src/lib/flux-recurrents.ts
// Recopie d'un flux sur d'autres mois de la grille : pour les charges et revenus qui reviennent chaque mois
// (loyer, abonnement, salaire). Les copies sont des flux ordinaires, modifiables mois par mois.

import type { FinancialFlow, MonthlyGridData } from "@/types"

/** Mois visés : le mois du flux seul, les mois suivants jusqu'en décembre, ou toute l'année. */
export type PorteeRecurrence = "mois" | "suivants" | "annee"

export const LIBELLES_PORTEE: Record<PorteeRecurrence, string> = {
  mois: "Ce mois seulement",
  suivants: "Ce mois et les suivants, jusqu'en décembre",
  annee: "Tous les mois de l'année"
}

/** Indices des mois où recopier un flux du mois `depuis`, hors ce mois-là. */
export function moisCibles(depuis: number, portee: PorteeRecurrence): number[] {
  if (portee === "mois") return []
  return Array.from({ length: 12 }, (_, mois) => mois).filter(mois => mois !== depuis && (portee === "annee" || mois > depuis))
}

/** Même acteur, même type, même libellé et même montant : le flux est déjà présent ce mois-là. */
const identique = (a: FinancialFlow, b: FinancialFlow) => a.entityId === b.entityId && a.type === b.type && a.label === b.label && a.amount === b.amount

/**
 * Recopie le flux sur les mois visés, sauf là où un flux identique existe déjà (pas de doublon si l'on recopie
 * deux fois). Chaque copie reçoit un nouvel identifiant. Renvoie la grille inchangée (même référence) si rien
 * n'a été ajouté, pour ne pas créer d'étape d'historique, et le nombre de mois où le flux a été ajouté.
 */
export function recopierFlux(grille: MonthlyGridData, flux: FinancialFlow, depuis: number, portee: PorteeRecurrence, nouvelId: () => string): { grille: MonthlyGridData; ajouts: number } {
  const cibles = new Set(moisCibles(depuis, portee).filter(mois => !grille[mois]?.flows.some(existant => identique(existant, flux))))
  if (cibles.size === 0) return { grille, ajouts: 0 }
  return {
    grille: grille.map((mois, index) => (cibles.has(index) ? { ...mois, flows: [...mois.flows, { ...flux, id: nouvelId() }] } : mois)),
    ajouts: cibles.size
  }
}
