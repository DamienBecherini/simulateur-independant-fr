// src/lib/session-service.ts
import type { SessionState, SaveSlot, ExportableState, SanitizationReport } from "@/types"
import type { EventPayloadMapping } from "@/globals"
import { createId } from "@/lib/id"
import { VERSION_DE_L_APPLICATION } from "@/lib/version"

// TypeScript augmentation for window.api
declare global {
  interface Window {
    api: EventPayloadMapping
  }
}

/**
 * Crée un nouvel objet SaveSlot à partir de la session actuelle, marqué de la version de l'application qui l'enregistre.
 */
export function createNewSlotFromSession(session: SessionState): SaveSlot {
  return { ...contenuDeLaSession(session), appVersion: VERSION_DE_L_APPLICATION, id: createId("slot"), lastModified: Date.now() }
}

/**
 * Met à jour un slot existant avec les données de la session actuelle, marqué de la version de l'application qui l'enregistre.
 */
export function updateSlotWithSession(slotToUpdate: SaveSlot, session: SessionState): SaveSlot {
  return { ...contenuDeLaSession(session), appVersion: VERSION_DE_L_APPLICATION, id: slotToUpdate.id, lastModified: Date.now() }
}

/**
 * Ce qu'une sauvegarde garde d'une session : tout son contenu, réglages du comparateur compris (voir l'ADR 009).
 * Une sauvegarde chargée redevient une session sans son identifiant ni sa date.
 */
export function contenuDeLaSession({ appVersion, name, entities, relationships, annees, comparateur }: SessionState): SessionState {
  return { ...(appVersion === undefined ? {} : { appVersion }), name, entities, relationships, annees, ...(comparateur ? { comparateur } : {}) }
}

/**
 * Exporte l'état d'un slot ou d'une session vers un fichier JSON.
 */
export function exportState(state: Pick<ExportableState, "entities" | "relationships" | "annees">): void {
  void window.api.exportState(state)
}

/**
 * Importe un état depuis un fichier JSON.
 * Fait le pont avec l'API Electron et transmet le résultat complet,
 * incluant l'état nettoyé et le rapport de nettoyage.
 */
export async function importState(): Promise<{ data: ExportableState; report: SanitizationReport } | null> {
  const result = await window.api.importState()
  if (result && result.data && result.report) {
    // On retourne l'objet complet { data, report } que le backend nous a donné.
    return {
      data: result.data,
      report: result.report
    }
  }
  return null
}

/**
 * Sauvegarde la liste complète des slots sur le disque ; `silencieux` évite la notification de réussite.
 */
export function saveAllSlots(slots: SaveSlot[], options?: { silencieux?: boolean }): void {
  void window.api.saveSlots(slots, options)
}

/** Le contenu d'une session qui compte pour savoir si elle est enregistrée : sans la version de l'application. */
const contenuComparable = (session: SessionState) => JSON.stringify({ ...contenuDeLaSession(session), appVersion: undefined })

/**
 * La session en cours serait perdue si on la remplaçait : elle a des acteurs, et ne correspond pas à la sauvegarde
 * chargée (ou aucune n'est chargée). Une session sans acteur n'a rien à perdre : ses flux sont forcément vides.
 */
export function modificationsNonEnregistrees(session: SessionState, sauvegardes: SaveSlot[], sauvegardeChargeeId: string | null): boolean {
  if (session.entities.length === 0) return false
  const chargee = sauvegardes.find(slot => slot.id === sauvegardeChargeeId)
  return chargee === undefined || contenuComparable(contenuDeLaSession(chargee)) !== contenuComparable(session)
}
