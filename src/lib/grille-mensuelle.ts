// src/lib/grille-mensuelle.ts
// Ce que la grille de saisie annuelle dessine pour chaque acteur : les barres de chaque mois et du total annuel (un
// segment par type de flux, gains d'un côté, dépenses de l'autre), leurs échelles, et les numéros des types de flux
// que la grille et la légende partagent. Fonctions pures : le composant MonthlyGrid ne fait que les afficher.

import type { Entity, FinancialFlow, MonthlyGridData } from "@/types"
import { DEFAULT_FLOW_COLORS } from "./color-constants"
import { isExpenseFlowType } from "./flow-constants"

type TypeDeFlux = FinancialFlow["type"]

/** Libellés courts des mois, en tête des colonnes de la grille (les noms complets : `MOIS` de export-commun.ts). */
export const MOIS_ABREGES = ["Janv", "Févr", "Mars", "Avril", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"]

/** Couleur d'un type de flux sans couleur connue. */
const COULEUR_INCONNUE = "#cccccc"

/** Marge au-dessus de la plus grande barre : elle ne touche pas le haut de la case. */
const MARGE_DE_L_ECHELLE = 1.1

/** Un segment de barre : la somme des flux d'un type, sa couleur et son numéro de légende. */
export interface SegmentDeFlux {
  amount: number
  color: string
  number: number
}

/** Une case de la grille : ses segments de gains et de dépenses, leurs totaux et le nombre de flux saisis. */
export interface CaseDeLaGrille {
  gains: SegmentDeFlux[]
  expenses: SegmentDeFlux[]
  totalGains: number
  totalExpenses: number
  flowCount: number
}

/** La ligne d'un acteur : les douze mois et le total annuel, chacun avec l'échelle de ses barres. */
export interface LigneDeLaGrille {
  entity: Entity
  monthlyScale: number
  monthlyCellData: CaseDeLaGrille[]
  annualCellData: CaseDeLaGrille
  annualScale: number
}

/** « de mars », mais « d’avril », « d’août », « d’octobre » : l’élision devant une voyelle. */
export function deMois(mois: string): string {
  return /^[aeiouâéèêîôû]/i.test(mois) ? `d’${mois.toLowerCase()}` : `de ${mois.toLowerCase()}`
}

/**
 * Numéros des types de flux présents dans la grille, de 1 à n dans l'ordre alphabétique de leur identifiant : la
 * grille les écrit dans ses barres, la légende à côté de chaque couleur.
 */
export function numerosDesTypesDeFlux(grille: MonthlyGridData): Map<string, number> {
  const types = new Set(grille.flatMap(mois => mois.flows.map(flux => flux.type)))
  return new Map([...types].sort((a, b) => a.localeCompare(b)).map((type, index) => [type, index + 1]))
}

/** Nombre de flux de chaque mois, en ne comptant que ceux des acteurs affichés. */
export function nombreDeFluxParMois(grille: MonthlyGridData, acteurs: Entity[]): number[] {
  const ids = new Set(acteurs.map(acteur => acteur.id))
  return grille.map(mois => mois.flows.filter(flux => ids.has(flux.entityId)).length)
}

/** Somme des montants par type de flux, dans l'ordre où chaque type apparaît. */
function montantsParType(flux: FinancialFlow[]): Map<TypeDeFlux, number> {
  const montants = new Map<TypeDeFlux, number>()
  for (const { type, amount } of flux) montants.set(type, (montants.get(type) ?? 0) + amount)
  return montants
}

/** La case des flux donnés : un segment par type, du côté des gains ou des dépenses. */
function caseDesFlux(flux: FinancialFlow[], couleurs: Record<string, string>, numeros: Map<string, number>): CaseDeLaGrille {
  const contenu: CaseDeLaGrille = { gains: [], expenses: [], totalGains: 0, totalExpenses: 0, flowCount: flux.length }
  montantsParType(flux).forEach((amount, type) => {
    const segment: SegmentDeFlux = { amount, color: couleurs[type] || COULEUR_INCONNUE, number: numeros.get(type) || 0 }
    if (isExpenseFlowType(type)) {
      contenu.expenses.push(segment)
      contenu.totalExpenses += amount
    } else {
      contenu.gains.push(segment)
      contenu.totalGains += amount
    }
  })
  return contenu
}

/**
 * Échelle des mois d'un acteur : le plus grand total de gains ou de dépenses d'un mois, avec la marge. Toutes les
 * cases de sa ligne la partagent, pour que leurs barres se comparent. 1 sans aucun montant.
 */
function echelleDesMois(cases: CaseDeLaGrille[]): number {
  const plusGrand = Math.max(0, ...cases.flatMap(c => [c.totalGains, c.totalExpenses]))
  return plusGrand > 0 ? plusGrand * MARGE_DE_L_ECHELLE : 1
}

/** Échelle du total annuel : le plus grand segment de l'année (au moins 1, jamais de division par zéro), avec la marge. */
function echelleDeLAnnee(annuel: CaseDeLaGrille): number {
  return Math.max(...annuel.gains.map(s => s.amount), ...annuel.expenses.map(s => s.amount), 1) * MARGE_DE_L_ECHELLE
}

/**
 * Les lignes de la grille, une par acteur. Les couleurs choisies par l'utilisateur remplacent celles par défaut ; les
 * numéros sont ceux de `numerosDesTypesDeFlux`.
 */
export function donneesDeLaGrille(acteurs: Entity[], grille: MonthlyGridData, couleursChoisies: Record<string, string> | undefined, numeros: Map<string, number>): LigneDeLaGrille[] {
  const couleurs: Record<string, string> = { ...DEFAULT_FLOW_COLORS, ...couleursChoisies }
  return acteurs.map(entity => {
    const fluxDesMois = grille.map(mois => mois.flows.filter(flux => flux.entityId === entity.id))
    const monthlyCellData = fluxDesMois.map(flux => caseDesFlux(flux, couleurs, numeros))
    const annualCellData = caseDesFlux(fluxDesMois.flat(), couleurs, numeros)
    return { entity, monthlyScale: echelleDesMois(monthlyCellData), monthlyCellData, annualCellData, annualScale: echelleDeLAnnee(annualCellData) }
  })
}
