// src/lib/preferences.ts
// Préférences de l'utilisateur retenues d'une ouverture à l'autre : l'ordre des sauvegardes, la sauvegarde chargée,
// le zoom et les sections repliables ouvertes ou fermées. Ce sont des états du poste (ou du navigateur), pas des
// données de la simulation : ils ne sont écrits ni dans la session ni dans les fichiers exportés.

import { LONGUEUR_MAXIMALE_ID_SECTION, type SaveSlot, type UserPreferences } from "@/types"

/** Nombre de sections mémorisées au plus : au-delà, les plus anciennes sont oubliées et reprennent leur état par défaut. */
export const NOMBRE_MAXIMAL_DE_SECTIONS = 100

/**
 * Préférences remises en accord avec les sauvegardes réellement présentes : l'ordre perd les sauvegardes disparues et
 * gagne, en tête, celles qui y manquaient ; la sauvegarde chargée est oubliée si elle n'existe plus (supprimée, ou
 * fichier des sauvegardes remplacé), et « Sauvegarder » en crée alors une nouvelle.
 */
export function preferencesSynchronisees(preferences: UserPreferences, sauvegardes: SaveSlot[]): UserPreferences {
  const ids = new Set(sauvegardes.map(s => s.id))
  const ordreValide = preferences.slotOrder.filter(id => ids.has(id))
  const ordonnees = new Set(ordreValide)
  const slotOrder = [...sauvegardes.filter(s => !ordonnees.has(s.id)).map(s => s.id), ...ordreValide]
  const synchronisees = { ...preferences, slotOrder }
  return preferences.loadedSlotId === undefined || ids.has(preferences.loadedSlotId) ? synchronisees : avecSauvegardeChargee(synchronisees, null)
}

/** Préférences avec la sauvegarde chargée ; `null` : aucune (session nouvelle, importée, ou sauvegarde supprimée). */
export function avecSauvegardeChargee(preferences: UserPreferences, id: string | null): UserPreferences {
  if (id !== null) return { ...preferences, loadedSlotId: id }
  const reste = { ...preferences }
  delete reste.loadedSlotId
  return reste
}

/**
 * Préférences avec l'état d'une section repliable. La section passe en dernier : quand la liste dépasse
 * NOMBRE_MAXIMAL_DE_SECTIONS (identifiants qui suivent les acteurs, par exemple), les plus anciennes sont oubliées.
 * Un identifiant trop long n'est pas retenu.
 */
export function avecSectionOuverte(preferences: UserPreferences, id: string, ouverte: boolean): UserPreferences {
  if (id.length > LONGUEUR_MAXIMALE_ID_SECTION) return preferences
  if (preferences.sectionsOuvertes?.[id] === ouverte) return preferences
  const autres = Object.entries(preferences.sectionsOuvertes ?? {}).filter(([cle]) => cle !== id)
  const gardees = autres.slice(Math.max(0, autres.length - NOMBRE_MAXIMAL_DE_SECTIONS + 1))
  return { ...preferences, sectionsOuvertes: Object.fromEntries([...gardees, [id, ouverte]]) }
}
