// src/backend/logic/fichiers-de-donnees.ts

/*
 * Contenu des fichiers de données de l'application de bureau (session en cours, sauvegardes, export d'une
 * simulation) : écriture avec le numéro de format, lecture avec conversion et nettoyage. Sans Electron ni accès au
 * disque, pour être testé seul ; le process principal (main.ts) lit et écrit les fichiers.
 */

import type { ExportableState, SanitizationReport, SaveSlot, SessionState } from "../../types.js"
import { nettoyerLesSlots, sanitizeSlots, sanitizeStateAndFillDefaults, type SlotsNettoyes } from "./data-sanitizer.js"
import { FORMAT_VERSION_ACTUEL, versionDuFormat } from "./migrations.js"

/** Ajoute à un fichier le numéro du format dans lequel il est écrit. */
export function withFormatVersion<T extends object>(data: T): T & { formatVersion: number } {
  return { ...data, formatVersion: FORMAT_VERSION_ACTUEL }
}

/** Texte JSON d'un fichier, avec son numéro de format. */
export function contenuDuFichier(data: object): string {
  return JSON.stringify(withFormatVersion(data), null, 2)
}

/**
 * Lit le fichier de la session en cours : converti s'il vient d'un format précédent, puis nettoyé.
 * @throws Si le contenu n'est pas du JSON, ou si ses années sont refusées (`AnneesRefuseesError`).
 */
export function lireLaSession(contenu: string): { safeState: SessionState; report: SanitizationReport; versionOrigine: number } {
  const brut: unknown = JSON.parse(contenu)
  return { ...sanitizeStateAndFillDefaults(brut), versionOrigine: versionDuFormat(brut) }
}

/** Texte JSON du fichier des sauvegardes : chacune porte son numéro de format. */
export function contenuDesSauvegardes(slots: SaveSlot[]): string {
  return JSON.stringify(slots.map(withFormatVersion), null, 2)
}

/** Lit le fichier des sauvegardes : chacune est nettoyée seule. @throws Si le contenu n'est pas du JSON. */
export function lireLesSauvegardes(contenu: string): SlotsNettoyes & { brutes: unknown[] } {
  const brut: unknown = JSON.parse(contenu)
  return { ...nettoyerLesSlots(brut), brutes: Array.isArray(brut) ? brut : [] }
}

/**
 * Sauvegardes reçues de l'interface, validées avant écriture comme à la lecture : une sauvegarde invalide est écartée.
 * Elles sont au format actuel : on le leur indique, sinon elles seraient prises pour le format 1 et converties.
 */
export function sauvegardesAEcrire(slots: SaveSlot[]): SaveSlot[] {
  return sanitizeSlots(slots.map(withFormatVersion))
}

/**
 * Lit un fichier de simulation importé (export complet ou sauvegarde exportée) : ce qui se recharge dans la session.
 * Le nom n'est rendu que si le fichier en porte un ; les résultats exportés, recalculés, sont ignorés.
 * @throws Si le contenu n'est pas du JSON, ou si ses années sont refusées (`AnneesRefuseesError`).
 */
export function lireUneSimulationImportee(contenu: string): { data: ExportableState; report: SanitizationReport } {
  const brut: unknown = JSON.parse(contenu)
  const { safeState, report } = sanitizeStateAndFillDefaults(brut)
  const { entities, relationships, annees, comparateur } = safeState
  const nomDuFichier = typeof brut === "object" && brut !== null && typeof (brut as { name?: unknown }).name === "string"
  const data: ExportableState = { entities, relationships, annees }
  if (nomDuFichier) data.name = safeState.name
  if (comparateur) data.comparateur = comparateur
  return { data, report }
}
