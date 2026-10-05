// src/lib/flux-recurrents.ts
// Recopie d'un flux sur d'autres mois de la grille : pour les charges et revenus qui reviennent chaque mois
// (loyer, abonnement, salaire). Les copies sont des flux ordinaires, modifiables mois par mois.

import type { AnneeSimulee, FinancialFlow, MonthlyGridData } from "@/types"

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

/** Ajoute une copie du flux aux mois indiqués qui n'ont pas déjà un flux identique ; même grille si rien n'est ajouté. */
function ajouterAuxMois(grille: MonthlyGridData, flux: FinancialFlow, mois: number[], nouvelId: () => string): { grille: MonthlyGridData; ajouts: number } {
  const cibles = new Set(mois.filter(m => !grille[m]?.flows.some(existant => identique(existant, flux))))
  if (cibles.size === 0) return { grille, ajouts: 0 }
  return {
    grille: grille.map((m, index) => (cibles.has(index) ? { ...m, flows: [...m.flows, { ...flux, id: nouvelId() }] } : m)),
    ajouts: cibles.size
  }
}

/**
 * Recopie le flux sur les mois visés, sauf là où un flux identique existe déjà (pas de doublon si l'on recopie
 * deux fois). Chaque copie reçoit un nouvel identifiant. Renvoie la grille inchangée (même référence) si rien
 * n'a été ajouté, pour ne pas créer d'étape d'historique, et le nombre de mois où le flux a été ajouté.
 */
export function recopierFlux(grille: MonthlyGridData, flux: FinancialFlow, depuis: number, portee: PorteeRecurrence, nouvelId: () => string): { grille: MonthlyGridData; ajouts: number } {
  return ajouterAuxMois(grille, flux, moisCibles(depuis, portee), nouvelId)
}

/** Même série : même acteur, même type et même libellé ; le montant peut varier d'un mois à l'autre (loyer augmenté). */
export const memeSerie = (a: FinancialFlow, b: FinancialFlow) => a.entityId === b.entityId && a.type === b.type && a.label === b.label

/** Changements que l'on peut reporter sur les autres flux d'une série. */
export type ChangementsDeFlux = Partial<Pick<FinancialFlow, "type" | "label" | "amount" | "grossAmount">>

/**
 * Transforme les flux des mois visés qui contiennent la série du flux ; les autres mois gardent leur référence.
 * Renvoie la grille (la même si aucun mois n'est touché) et le nombre de mois touchés.
 */
function transformerLaSerie(grille: MonthlyGridData, flux: FinancialFlow, mois: number[], transformer: (flows: FinancialFlow[]) => FinancialFlow[]): { grille: MonthlyGridData; touches: number } {
  const cibles = new Set(mois)
  let touches = 0
  const resultat = grille.map((m, index) => {
    if (!cibles.has(index) || !m.flows.some(f => memeSerie(f, flux))) return m
    touches++
    return { ...m, flows: transformer(m.flows) }
  })
  return { grille: touches === 0 ? grille : resultat, touches }
}

/** Reporte les changements sur les flux de la série du flux (repérée d'après le flux avant modification). */
const reporter = (flux: FinancialFlow, changements: ChangementsDeFlux) => (flows: FinancialFlow[]) => flows.map(f => (memeSerie(f, flux) ? { ...f, ...changements } : f))
/** Retire les flux de la série du flux. */
const retirer = (flux: FinancialFlow) => (flows: FinancialFlow[]) => flows.filter(f => !memeSerie(f, flux))

/**
 * Applique une modification au flux et, selon la portée, aux flux de la même série dans les autres mois visés
 * (repérés d'après le flux avant modification). Seuls les champs modifiés sont reportés : un nouveau montant
 * à partir de juillet ne touche pas aux mois précédents. Renvoie la nouvelle grille et le nombre d'autres mois
 * modifiés ; pour le seul mois ouvert, la grille garde sa mise à jour habituelle (MonthlyGrid).
 */
export function modifierSerie(grille: MonthlyGridData, flux: FinancialFlow, depuis: number, portee: PorteeRecurrence, changements: ChangementsDeFlux): { grille: MonthlyGridData; touches: number } {
  const avecLeMoisOuvert = grille.map((mois, index) => (index === depuis ? { ...mois, flows: mois.flows.map(f => (f.id === flux.id ? { ...f, ...changements } : f)) } : mois))
  return transformerLaSerie(avecLeMoisOuvert, flux, moisCibles(depuis, portee), reporter(flux, changements))
}

/**
 * Supprime le flux et, selon la portée, les flux de la même série dans les autres mois visés.
 * Renvoie le nombre d'autres mois où la série a été supprimée.
 */
export function supprimerSerie(grille: MonthlyGridData, flux: FinancialFlow, depuis: number, portee: PorteeRecurrence): { grille: MonthlyGridData; touches: number } {
  const sansLeFlux = grille.map((mois, index) => (index === depuis ? { ...mois, flows: mois.flows.filter(f => f.id !== flux.id) } : mois))
  return transformerLaSerie(sansLeFlux, flux, moisCibles(depuis, portee), retirer(flux))
}

// ===================================================================================
// == SUR PLUSIEURS ANNÉES
// ===================================================================================
// Une session peut contenir plusieurs années (ADR 008). La portée choisie vaut alors aussi pour les autres années
// cochées, sur les mêmes mois du calendrier : « ce mois et les suivants » depuis juillet 2026, avec 2025 et 2027
// cochées, vise juillet à décembre de chacune des trois années. C'est la règle la moins surprenante : chaque année
// cochée reçoit ce que l'on voit appliqué à l'année affichée, qu'elle soit avant ou après.

/** Où appliquer une opération : l'année affichée et son mois ouvert, la portée choisie, les autres années cochées. */
export interface CibleDansLesAnnees {
  annee: number
  depuis: number
  portee: PorteeRecurrence
  autresAnnees: number[]
}

/** Nombre de mois touchés dans une année ; pour l'année affichée, sans compter le mois ouvert. */
export interface MoisTouches {
  annee: number
  mois: number
}

type Operation = (grille: MonthlyGridData) => { grille: MonthlyGridData; touches: number }

/** Mois visés dans une autre année cochée : le même mois et, selon la portée, les mêmes mois que dans l'année affichée. */
export function moisDesAutresAnnees(depuis: number, portee: PorteeRecurrence): number[] {
  return [depuis, ...moisCibles(depuis, portee)].sort((a, b) => a - b)
}

/**
 * Applique `surLAffichee` à la grille de l'année affichée et `surUneAutre` à celle de chaque autre année cochée.
 * Les années non touchées gardent leur référence. Renvoie aussi les mois touchés par année, dans l'ordre des
 * années, sans celles où rien n'a changé.
 */
function dansLesAnnees(annees: AnneeSimulee[], cible: CibleDansLesAnnees, surLAffichee: Operation, surUneAutre: Operation): { annees: AnneeSimulee[]; touches: MoisTouches[] } {
  const autres = new Set(cible.autresAnnees.filter(a => a !== cible.annee))
  const touches: MoisTouches[] = []
  const resultat = annees.map(a => {
    const operation = a.annee === cible.annee ? surLAffichee : autres.has(a.annee) ? surUneAutre : null
    if (!operation) return a
    const { grille, touches: mois } = operation(a.monthlyData)
    if (mois > 0) touches.push({ annee: a.annee, mois })
    return grille === a.monthlyData ? a : { ...a, monthlyData: grille }
  })
  return { annees: resultat, touches }
}

/**
 * Ajoute le flux au mois ouvert de l'année affichée et le recopie selon la portée, puis sur les mêmes mois de
 * chaque autre année cochée, sans doublon : pas de copie là où un flux identique existe déjà.
 */
export function ajouterDansLesAnnees(annees: AnneeSimulee[], flux: FinancialFlow, cible: CibleDansLesAnnees, nouvelId: () => string): { annees: AnneeSimulee[]; touches: MoisTouches[] } {
  const { depuis, portee } = cible
  const versAjouts = ({ grille, ajouts }: { grille: MonthlyGridData; ajouts: number }) => ({ grille, touches: ajouts })
  return dansLesAnnees(
    annees,
    cible,
    grille => versAjouts(recopierFlux(grille.map((mois, index) => (index === depuis ? { ...mois, flows: [...mois.flows, flux] } : mois)), flux, depuis, portee, nouvelId)),
    grille => versAjouts(ajouterAuxMois(grille, flux, moisDesAutresAnnees(depuis, portee), nouvelId))
  )
}

/** Modifie le flux et sa série selon la portée dans l'année affichée, puis la série sur les mêmes mois des autres années cochées. */
export function modifierDansLesAnnees(annees: AnneeSimulee[], flux: FinancialFlow, cible: CibleDansLesAnnees, changements: ChangementsDeFlux): { annees: AnneeSimulee[]; touches: MoisTouches[] } {
  const { depuis, portee } = cible
  return dansLesAnnees(
    annees,
    cible,
    grille => modifierSerie(grille, flux, depuis, portee, changements),
    grille => transformerLaSerie(grille, flux, moisDesAutresAnnees(depuis, portee), reporter(flux, changements))
  )
}

/** Supprime le flux et sa série selon la portée dans l'année affichée, puis la série sur les mêmes mois des autres années cochées. */
export function supprimerDansLesAnnees(annees: AnneeSimulee[], flux: FinancialFlow, cible: CibleDansLesAnnees): { annees: AnneeSimulee[]; touches: MoisTouches[] } {
  const { depuis, portee } = cible
  return dansLesAnnees(
    annees,
    cible,
    grille => supprimerSerie(grille, flux, depuis, portee),
    grille => transformerLaSerie(grille, flux, moisDesAutresAnnees(depuis, portee), retirer(flux))
  )
}

/** « a », « a et b », « a, b et c ». */
const enumerer = (parties: string[]) => (parties.length <= 1 ? (parties[0] ?? "") : `${parties.slice(0, -1).join(", ")} et ${parties[parties.length - 1]}`)

/** « 11 mois en 2026 et 12 mois en 2027 », pour la notification d'une opération sur plusieurs années. */
export function resumerMoisTouches(touches: MoisTouches[]): string {
  return enumerer(touches.map(({ annee, mois }) => `${mois} mois en ${annee}`))
}

/** « 2025 et 2027 », « 2024, 2025 et 2027 » : des années, dans l'ordre chronologique. */
export function listerAnnees(annees: number[]): string {
  return enumerer([...annees].sort((a, b) => a - b).map(String))
}
