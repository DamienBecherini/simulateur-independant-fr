// src/backend/logic/annees.ts

/*
 * Les années d'une session (voir l'ADR 008) : une session contient plusieurs années consécutives, chacune avec sa
 * grille mensuelle ; les acteurs et les relations sont communs à toutes les années.
 *
 * Ces fonctions pures servent au moteur (une année à la fois) comme à l'interface (sélecteur d'année, ajout et
 * suppression). Elles ne modifient jamais la session reçue : elles en renvoient une nouvelle, ou la même référence
 * quand rien ne change (pour ne pas créer d'étape d'annulation).
 */

import { grilleVide, type AnneeSimulee, type DonneesDeLAnnee, type Entity, type MonthlyGridData, type Relationship, type SimulationAnnuelle } from "../../types.js"

/** Le strict nécessaire d'une session pour travailler sur ses années. */
export interface SessionAnnuelle {
  name: string
  entities: Entity[]
  relationships: Relationship[]
  annees: AnneeSimulee[]
}

/** Numéros des années de la session, dans leur ordre (chronologique après nettoyage). */
export function anneesDeLaSession(session: Pick<SessionAnnuelle, "annees">): number[] {
  return session.annees.map(a => a.annee)
}

/** L'année demandée si la session la contient, sinon la plus récente. */
export function anneeExistante(session: Pick<SessionAnnuelle, "annees">, annee: number | null | undefined): number {
  const annees = anneesDeLaSession(session)
  return annee !== null && annee !== undefined && annees.includes(annee) ? annee : annees[annees.length - 1]
}

/** Ce que le moteur calcule pour une année : acteurs et relations de la session, grille de l'année. */
export function donneesDeLAnnee(session: SessionAnnuelle, annee: number): DonneesDeLAnnee {
  const { monthlyData } = session.annees.find(a => a.annee === annee) ?? { monthlyData: grilleVide() }
  return { entities: session.entities, relationships: session.relationships, monthlyData }
}

/** Une année de la session vue comme une simulation d'un an ; la plus récente si l'année demandée n'y est pas. */
export function vueDeLAnnee(session: SessionAnnuelle, annee: number | null | undefined): SimulationAnnuelle {
  const existante = anneeExistante(session, annee)
  return { name: session.name, annee: existante, ...donneesDeLAnnee(session, existante) }
}

/** Remplace la grille d'une année ; renvoie la session telle quelle si la grille n'a pas changé ou si l'année est absente. */
export function remplacerGrille<S extends SessionAnnuelle>(session: S, annee: number, monthlyData: MonthlyGridData): S {
  const actuelle = session.annees.find(a => a.annee === annee)
  if (!actuelle || actuelle.monthlyData === monthlyData) return session
  return { ...session, annees: session.annees.map(a => (a.annee === annee ? { ...a, monthlyData } : a)) }
}

/** Applique la même transformation à la grille de chaque année (suppression d'un acteur, flux devenus orphelins). */
export function transformerLesGrilles<S extends Pick<SessionAnnuelle, "annees">>(session: S, transformer: (grille: MonthlyGridData) => MonthlyGridData): S {
  return { ...session, annees: session.annees.map(a => ({ ...a, monthlyData: transformer(a.monthlyData) })) }
}

/** Nombre total de flux, toutes années confondues. */
export function nombreDeFlux(annees: AnneeSimulee[]): number {
  return annees.reduce((total, a) => total + a.monthlyData.reduce((cumul, mois) => cumul + mois.flows.length, 0), 0)
}

/**
 * Nombre maximal d'années d'une session. Les règles ne sont connues que jusqu'à la dernière année publiée : deux ou
 * trois ans plus loin, les chiffres ne sont plus qu'une projection (barèmes, plafonds et taux figés). Dix années
 * couvrent largement un projet de création ou de transmission, et gardent l'interface lisible.
 */
export const NOMBRE_MAX_ANNEES = 10

/** Une année de plus est possible tant que la session n'a pas atteint le nombre maximal d'années. */
export function peutAjouterAnnee(session: Pick<SessionAnnuelle, "annees">): boolean {
  return session.annees.length < NOMBRE_MAX_ANNEES
}

/** Où ajouter une année : avant la plus ancienne ou après la plus récente, pour que les années restent consécutives. */
export type PositionNouvelleAnnee = "avant" | "apres"

/** Numéro de l'année qu'on ajouterait à cette position. */
export function anneeAAjouter(session: Pick<SessionAnnuelle, "annees">, position: PositionNouvelleAnnee): number {
  const annees = anneesDeLaSession(session)
  return position === "avant" ? annees[0] - 1 : annees[annees.length - 1] + 1
}

/**
 * Ajoute une année avant la plus ancienne ou après la plus récente. Sa grille est vide, ou une copie de celle de
 * l'année voisine (la plus ancienne ou la plus récente) : chaque flux copié reçoit un nouvel identifiant.
 * Renvoie la session telle quelle si elle a déjà le nombre maximal d'années.
 */
export function ajouterAnnee<S extends SessionAnnuelle>(session: S, position: PositionNouvelleAnnee, copier: boolean, nouvelId: () => string): S {
  if (!peutAjouterAnnee(session)) return session
  const annee = anneeAAjouter(session, position)
  const voisine = position === "avant" ? session.annees[0] : session.annees[session.annees.length - 1]
  const monthlyData = copier ? voisine.monthlyData.map(mois => ({ ...mois, flows: mois.flows.map(flux => ({ ...flux, id: nouvelId() })) })) : grilleVide()
  const nouvelle: AnneeSimulee = { annee, monthlyData }
  return { ...session, annees: position === "avant" ? [nouvelle, ...session.annees] : [...session.annees, nouvelle] }
}

/** Seules la plus ancienne et la plus récente se suppriment, et jamais la dernière qui reste : les années restent consécutives. */
export function peutSupprimerAnnee(session: Pick<SessionAnnuelle, "annees">, annee: number): boolean {
  const annees = anneesDeLaSession(session)
  return annees.length > 1 && (annee === annees[0] || annee === annees[annees.length - 1])
}

/** Supprime une année ; renvoie la session telle quelle si cette année ne peut pas être supprimée. */
export function supprimerAnnee<S extends SessionAnnuelle>(session: S, annee: number): S {
  if (!peutSupprimerAnnee(session, annee)) return session
  return { ...session, annees: session.annees.filter(a => a.annee !== annee) }
}

/**
 * Trie les années dans l'ordre chronologique et écarte les doublons (la première occurrence est gardée).
 * Renvoie aussi les années écartées, pour compter leurs flux dans le rapport de nettoyage.
 */
export function ordonnerLesAnnees(annees: AnneeSimulee[]): { annees: AnneeSimulee[]; ecartees: AnneeSimulee[] } {
  const vues = new Set<number>()
  const gardees: AnneeSimulee[] = []
  const ecartees: AnneeSimulee[] = []
  for (const a of annees) {
    if (vues.has(a.annee)) {
      ecartees.push(a)
      continue
    }
    vues.add(a.annee)
    gardees.push(a)
  }
  return { annees: gardees.sort((a, b) => a.annee - b.annee), ecartees }
}

/** Années absentes entre la plus ancienne et la plus récente ; la liste reçue est triée et sans doublon. */
export function anneesManquantes(annees: number[]): number[] {
  if (annees.length < 2) return []
  const presentes = new Set(annees)
  const premiere = annees[0]
  return Array.from({ length: annees[annees.length - 1] - premiere + 1 }, (_, i) => premiere + i).filter(a => !presentes.has(a))
}

/** « 2027 », « 2027 et 2028 », « 2027, 2028 et 2030 ». */
function enumererAnnees(annees: number[]): string {
  return annees.length <= 1 ? annees.join("") : `${annees.slice(0, -1).join(", ")} et ${annees[annees.length - 1]}`
}

/** Au-delà, on ne liste plus les années manquantes une à une : on dit combien il en manque. */
const MANQUANTES_LISTEES_AU_PLUS = 5

/**
 * Pourquoi une liste d'années (triée, sans doublon) ne peut pas former une session ; `null` si elle le peut.
 * Une session compte au plus `NOMBRE_MAX_ANNEES` années, et elles se suivent : l'interface n'en ajoute et n'en
 * supprime qu'aux extrémités, seul un fichier modifié à la main peut avoir un trou (voir l'ADR 008).
 */
export function erreurDesAnnees(annees: number[]): string | null {
  if (annees.length === 0) return null
  const premiere = annees[0]
  const derniere = annees[annees.length - 1]
  if (annees.length > NOMBRE_MAX_ANNEES) {
    return `Cette simulation contient ${annees.length} années, de ${premiere} à ${derniere} ; le simulateur en accepte au plus ${NOMBRE_MAX_ANNEES}. Au-delà de deux ou trois ans après les dernières règles connues, les chiffres ne sont plus qu'une projection.`
  }
  const manquantes = anneesManquantes(annees)
  if (manquantes.length === 0) return null
  const quoi = manquantes.length <= MANQUANTES_LISTEES_AU_PLUS ? enumererAnnees(manquantes) : `${manquantes.length} années`
  return `Les années de cette simulation ne se suivent pas : il manque ${quoi} entre ${premiere} et ${derniere}. Ajoutez les années manquantes au fichier, ou retirez les années isolées.`
}
