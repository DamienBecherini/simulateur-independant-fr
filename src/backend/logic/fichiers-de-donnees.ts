// src/backend/logic/fichiers-de-donnees.ts

/*
 * Contenu des fichiers de données de l'application de bureau (session en cours, sauvegardes, export d'une
 * simulation) : écriture avec le numéro de format, lecture avec conversion et nettoyage. Sans Electron ni accès au
 * disque, pour être testé seul ; le process principal (donnees-de-l-application.ts, canaux-des-fichiers.ts) lit et écrit
 * les fichiers.
 */

import { UserPreferencesSchema, type ExportableState, type SanitizationReport, type SaveSlot, type SessionState, type UserPreferences } from "../../types.js"
import { nettoyerLaSession, nettoyerLesSlots, sanitizeSlots, type SlotsNettoyes } from "./data-sanitizer.js"
import { FORMAT_VERSION_ACTUEL, versionDuFormat } from "./migrations.js"
import { SimulationRecueSchema } from "./entrees-ipc.js"

/** Ajoute à un fichier le numéro du format dans lequel il est écrit. */
export function withFormatVersion<T extends object>(data: T): T & { formatVersion: number } {
  return { ...data, formatVersion: FORMAT_VERSION_ACTUEL }
}

/** Ajoute à un fichier la version de l'application qui l'écrit, si elle est donnée ; sinon, il reste tel quel. */
export function avecVersionDeLApplication<T extends object>(data: T, appVersion?: string): T {
  return appVersion === undefined ? data : { ...data, appVersion }
}

/** Texte JSON d'un fichier, avec son numéro de format et, si elle est donnée, la version de l'application qui l'écrit. */
export function contenuDuFichier(data: object, appVersion?: string): string {
  return JSON.stringify(withFormatVersion(avecVersionDeLApplication(data, appVersion)), null, 2)
}

/**
 * Lit le fichier de la session en cours : converti s'il vient d'un format précédent, puis nettoyé.
 * @throws Si le contenu n'est pas du JSON, si la session est refusée en bloc par le schéma (`SessionIrrecuperableError` :
 * le fichier est alors illisible, pas remplacé en silence par une session vierge) ou si ses années sont refusées
 * (`AnneesRefuseesError`).
 */
export function lireLaSession(contenu: string): { safeState: SessionState; report: SanitizationReport; versionOrigine: number } {
  const brut: unknown = JSON.parse(contenu)
  return { ...nettoyerLaSession(brut), versionOrigine: versionDuFormat(brut) }
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
 * Session reçue de l'interface, nettoyée avant écriture comme elle le sera à la lecture : un élément invalide est
 * écarté, le reste est gardé. `null` si elle n'a rien d'une session (ni acteurs, ni relations, ni années) ou si elle
 * serait refusée à la lecture : elle n'est pas écrite, et le fichier précédent reste tel quel.
 */
export function sessionAEcrire(session: unknown): SessionState | null {
  if (!SimulationRecueSchema.safeParse(session).success) return null
  try {
    return nettoyerLaSession(withFormatVersion(session as object)).safeState
  } catch {
    return null
  }
}

/**
 * Lit un fichier de simulation importé (export complet ou sauvegarde exportée) : ce qui se recharge dans la session.
 * Le nom n'est rendu que si le fichier en porte un ; les résultats exportés, recalculés, sont ignorés. La version de
 * l'application qui a écrit le fichier est gardée telle quelle : elle ne change qu'au prochain enregistrement.
 * @throws Si le contenu n'est pas du JSON, s'il n'a rien d'une simulation (`SessionIrrecuperableError` : l'import est
 * refusé plutôt que de remplacer la simulation en cours par une simulation vierge) ou si ses années sont refusées
 * (`AnneesRefuseesError`).
 */
export function lireUneSimulationImportee(contenu: string): { data: ExportableState; report: SanitizationReport } {
  const brut: unknown = JSON.parse(contenu)
  const { safeState, report } = nettoyerLaSession(brut)
  const { entities, relationships, annees, comparateur } = safeState
  const nomDuFichier = typeof brut === "object" && brut !== null && typeof (brut as { name?: unknown }).name === "string"
  const data: ExportableState = { entities, relationships, annees }
  if (nomDuFichier) data.name = safeState.name
  if (comparateur) data.comparateur = comparateur
  if (safeState.appVersion !== undefined) data.appVersion = safeState.appVersion
  return { data, report }
}

/** Préférences par défaut : aucune sauvegarde ordonnée, rien d'autre de choisi. */
export function preferencesParDefaut(): UserPreferences {
  return { slotOrder: [] }
}

/**
 * Préférences validées : un champ invalide est écarté seul (voir `UserPreferencesSchema`) ; ce qui n'est pas un objet
 * donne les préférences par défaut.
 */
export function preferencesValides(brutes: unknown): UserPreferences {
  const resultat = UserPreferencesSchema.safeParse(brutes)
  return resultat.success ? resultat.data : preferencesParDefaut()
}

/** Lit le fichier des préférences. @throws Si le contenu n'est pas du JSON. */
export function lireLesPreferences(contenu: string): UserPreferences {
  return preferencesValides(JSON.parse(contenu))
}
