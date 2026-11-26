// src/lib/grille-mensuelle.ts
// Ce que la grille de saisie annuelle dessine pour chaque acteur : les barres de chaque mois et du total annuel (un
// segment par type de flux, gains d'un côté, dépenses de l'autre), leurs échelles, et les numéros des types de flux
// que la grille et la légende partagent. Fonctions pures : le composant MonthlyGrid ne fait que les afficher.
// La rémunération et les dividendes versés par une société sont une dépense sur sa ligne, et un gain sur la ligne de
// qui les reçoit (hachuré : ils se saisissent sur la ligne de la société).

import type { Entity, FinancialFlow, MonthlyGridData } from "@/types"
import { deNom as deNomDuMoteur } from "@/backend/logic/format"
import { personnesQui, type Activite, type Relations } from "@/backend/logic/regles-de-structure"
import { DEFAULT_FLOW_COLORS } from "./color-constants"
import { isOutgoingFlowType } from "./flow-constants"

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
  /** Versé par une société (rémunération, dividendes) : ce qu'elle a saisi, pas un flux de cet acteur. Les sociétés, par leur nom. */
  recuDe?: string[]
}

/** Ce que les sociétés versent aux personnes. */
type TypeVerse = Extract<TypeDeFlux, "director_remuneration" | "dividends_payment">

/** Une rémunération de dirigeant, ou une part de dividendes, reçue d'une société. */
export interface VersementRecu {
  type: TypeVerse
  amount: number
  societeId: string
  societe: string
}

/** Une case de la grille : ses segments de gains (reçus compris) et de dépenses, leurs totaux et le nombre de flux saisis. */
interface CaseDeLaGrille {
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
  return deNom(mois.toLowerCase())
}

/** « de Studio », mais « d’Atelier » : l'élision du moteur (`format.ts`), avec l'apostrophe typographique de la grille. */
export function deNom(nom: string): string {
  return deNomDuMoteur(nom, "’")
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

/**
 * Ce que chaque personne reçoit des sociétés dans ces flux, par la règle du calcul (routage-des-flux.ts) : la
 * rémunération va au premier dirigeant, les dividendes se partagent à parts égales entre les associés. Une société
 * sans dirigeant ou sans associé relié ne verse à personne (le calcul le signale).
 */
export function versementsRecus(flux: FinancialFlow[], acteurs: Entity[], relations: Relations = []): Map<string, VersementRecu[]> {
  const recus = new Map<string, VersementRecu[]>()
  const session = { entities: acteurs, relationships: relations }
  for (const { type, amount, entityId } of flux) {
    if (type !== "director_remuneration" && type !== "dividends_payment") continue
    const societe = acteurs.find((acteur): acteur is Activite => acteur.id === entityId && acteur.type !== "person")
    if (!societe) continue
    const dirigeant = personnesQui(session, societe, "dirige").slice(0, 1)
    const beneficiaires = type === "director_remuneration" ? dirigeant : personnesQui(session, societe, "associe")
    for (const personne of beneficiaires) {
      const versement: VersementRecu = { type, amount: amount / beneficiaires.length, societeId: societe.id, societe: societe.name }
      recus.set(personne, [...(recus.get(personne) ?? []), versement])
    }
  }
  return recus
}

/**
 * Le fond d'une barre : plein, ou hachuré pour un versement reçu d'une société (rémunération, dividendes), qui se
 * saisit sur la ligne de la société, où il est une dépense. Le contour garde la hauteur lisible entre les hachures.
 */
export function fondDuSegment(segment: SegmentDeFlux): { backgroundColor: string; backgroundImage?: string; boxShadow?: string } {
  if (!segment.recuDe) return { backgroundColor: segment.color }
  return { backgroundColor: "transparent", backgroundImage: `repeating-linear-gradient(135deg, ${segment.color} 0 3px, transparent 3px 6px)`, boxShadow: `inset 0 0 0 1.5px ${segment.color}` }
}

/** Les versements reçus, un par société et par type (plusieurs flux d'une même société s'additionnent). */
export function regrouperLesRecus(recus: VersementRecu[]): VersementRecu[] {
  const groupes = new Map<string, VersementRecu>()
  for (const recu of recus) {
    const cle = `${recu.societeId}|${recu.type}`
    const groupe = groupes.get(cle)
    groupes.set(cle, groupe ? { ...groupe, amount: groupe.amount + recu.amount } : recu)
  }
  return [...groupes.values()]
}

/** Les segments des versements reçus : un par type, avec les sociétés qui l'ont versé. */
function segmentsRecus(recus: VersementRecu[], couleurs: Record<string, string>, numeros: Map<string, number>): SegmentDeFlux[] {
  const parType = new Map<TypeVerse, SegmentDeFlux>()
  for (const { type, amount, societe } of recus) {
    const segment = parType.get(type) ?? { amount: 0, color: couleurs[type] || COULEUR_INCONNUE, number: numeros.get(type) || 0, recuDe: [] }
    segment.amount += amount
    if (!segment.recuDe?.includes(societe)) segment.recuDe?.push(societe)
    parType.set(type, segment)
  }
  return [...parType.values()]
}

/** La case des flux donnés : un segment par type, du côté des gains ou des dépenses (rémunération et dividendes versés compris), puis les versements reçus. */
function caseDesFlux(flux: FinancialFlow[], couleurs: Record<string, string>, numeros: Map<string, number>, recus: VersementRecu[] = []): CaseDeLaGrille {
  const contenu: CaseDeLaGrille = { gains: [], expenses: [], totalGains: 0, totalExpenses: 0, flowCount: flux.length }
  montantsParType(flux).forEach((amount, type) => {
    const segment: SegmentDeFlux = { amount, color: couleurs[type] || COULEUR_INCONNUE, number: numeros.get(type) || 0 }
    if (isOutgoingFlowType(type)) {
      contenu.expenses.push(segment)
      contenu.totalExpenses += amount
    } else {
      contenu.gains.push(segment)
      contenu.totalGains += amount
    }
  })
  for (const segment of segmentsRecus(recus, couleurs, numeros)) {
    contenu.gains.push(segment)
    contenu.totalGains += segment.amount
  }
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
 * numéros sont ceux de `numerosDesTypesDeFlux`. Les relations désignent qui reçoit la rémunération et les dividendes.
 */
export function donneesDeLaGrille(acteurs: Entity[], grille: MonthlyGridData, couleursChoisies: Record<string, string> | undefined, numeros: Map<string, number>, relations: Relations = []): LigneDeLaGrille[] {
  const couleurs: Record<string, string> = { ...DEFAULT_FLOW_COLORS, ...couleursChoisies }
  const recusDesMois = grille.map(mois => versementsRecus(mois.flows, acteurs, relations))
  return acteurs.map(entity => {
    const fluxDesMois = grille.map(mois => mois.flows.filter(flux => flux.entityId === entity.id))
    const recus = recusDesMois.map(recusDuMois => recusDuMois.get(entity.id) ?? [])
    const monthlyCellData = fluxDesMois.map((flux, mois) => caseDesFlux(flux, couleurs, numeros, recus[mois]))
    const annualCellData = caseDesFlux(fluxDesMois.flat(), couleurs, numeros, recus.flat())
    return { entity, monthlyScale: echelleDesMois(monthlyCellData), monthlyCellData, annualCellData, annualScale: echelleDeLAnnee(annualCellData) }
  })
}
