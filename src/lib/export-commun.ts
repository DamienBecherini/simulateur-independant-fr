// src/lib/export-commun.ts
// Briques partagées par les exports CSV et Markdown : noms de fichiers, nature des acteurs, flux regroupés par acteur.

import type { Entity, FinancialFlow, FoyerFiscalResult, SimulationAnnuelle } from "@/types"
import { flowTypeLabels, libelleDuType, isOutgoingFlowType, type FlowType } from "./flow-constants"
import { libelleDuMois, lireMois } from "@/backend/logic/dispositifs"

/** Mois de création d'une activité en toutes lettres (« septembre 2026 ») ; `null` pour une personne ou sans date. */
export function dateDeCreationLisible(entity: Entity): string | null {
  const mois = entity.type === "person" ? null : lireMois(entity.dateDeCreation)
  return mois ? libelleDuMois(mois) : null
}

export const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

/** Texte réduit à des lettres minuscules sans accent, des chiffres et des tirets, pour un nom de fichier. */
export function slugifier(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "")
}

/**
 * Nom de fichier d'un export : le nom de la simulation, ce que contient le fichier et, si on la donne, l'année des
 * règles fiscales (omise quand le nom de la simulation la contient déjà). Ex. « famille-martin-grille-2026.csv ».
 */
export function nomDeFichier(nomSimulation: string, contenu: string, extension: string, annee?: number): string {
  const base = slugifier(nomSimulation) || "simulation"
  const avecAnnee = annee !== undefined && !base.split("-").includes(String(annee))
  return `${base}-${contenu}${avecAnnee ? `-${annee}` : ""}.${extension}`
}

/** Nature d'un acteur, telle que l'affiche l'application : « Personne », « SASU », « EI au réel »… */
export function natureActeur(entity: Entity): string {
  if (entity.type === "person") return "Personne"
  if (entity.type === "micro-entreprise") return "Micro-entreprise"
  return entity.legalStatus === "EI" ? "EI au réel" : entity.legalStatus
}

/** Les flux d'un même type pour un acteur : montants des douze mois et total de l'année. */
export interface LigneDeFlux {
  type: FlowType
  libelle: string
  /** Sortie d'argent du point de vue de l'acteur (dépense, rémunération ou dividendes versés). */
  sortie: boolean
  mois: number[]
  total: number
}

export interface FluxDUnActeur {
  entity: Entity
  lignes: LigneDeFlux[]
}

const ORDRE_DES_TYPES = Object.keys(flowTypeLabels) as FlowType[]

function lignesDeLActeur(entityId: string, typeActeur: Entity["type"], fluxParMois: FinancialFlow[][]): LigneDeFlux[] {
  return ORDRE_DES_TYPES.flatMap(type => {
    const mois = fluxParMois.map(flows => flows.filter(f => f.entityId === entityId && f.type === type).reduce((somme, f) => somme + f.amount, 0))
    const present = fluxParMois.some(flows => flows.some(f => f.entityId === entityId && f.type === type))
    if (!present) return []
    return [{ type, libelle: libelleDuType(type, typeActeur), sortie: isOutgoingFlowType(type), mois, total: mois.reduce((a, b) => a + b, 0) }]
  })
}

/** Flux de la grille, regroupés par acteur (dans l'ordre des acteurs) puis par type ; les acteurs sans flux sont omis. */
export function fluxParActeur(session: SimulationAnnuelle): FluxDUnActeur[] {
  const fluxParMois = Array.from({ length: 12 }, (_, i) => session.monthlyData.find(m => m.month === i)?.flows ?? [])
  return session.entities.map(entity => ({ entity, lignes: lignesDeLActeur(entity.id, entity.type, fluxParMois) })).filter(acteur => acteur.lignes.length > 0)
}

/** Nom d'un acteur d'après son identifiant, ou l'identifiant lui-même s'il n'existe plus. */
export function nomDeLActeur(session: SimulationAnnuelle, id: string): string {
  return session.entities.find(e => e.id === id)?.name ?? id
}

/** Nom d'un foyer fiscal : ses membres, déclarants puis enfants. */
export function nomDuFoyer(session: SimulationAnnuelle, foyer: FoyerFiscalResult): string {
  return foyer.personIds.map(id => nomDeLActeur(session, id)).join(", ")
}
