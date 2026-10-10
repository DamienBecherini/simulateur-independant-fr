// src/lib/session-service.ts
// Sauvegardes nommées de la session : création, mise à jour, écrasement, ordre d'affichage, et le pont vers le
// stockage (`window.api`, déclaré dans src/globals.d.ts). Les décisions sont des fonctions pures ; le panneau des
// paramètres (SettingsSheet) les affiche et demande les confirmations.
import type { SessionState, SaveSlot, ExportableState, SanitizationReport } from "@/types"
import { createId } from "@/lib/id"
import { VERSION_DE_L_APPLICATION } from "@/lib/version"

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
export function exportState(state: Pick<ExportableState, "entities" | "relationships" | "annees">): Promise<void> {
  return window.api.exportState(state)
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
 * `false` si l'écriture a échoué : le pont a déjà notifié l'échec, et les sauvegardes enregistrées sont intactes.
 */
export function saveAllSlots(slots: SaveSlot[], options?: { silencieux?: boolean }): Promise<boolean> {
  return window.api.saveSlots(slots, options)
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

/**
 * Ce que fait « Sauvegarder » :
 * - une sauvegarde est chargée et la session porte toujours son nom : elle est mise à jour, sans question ;
 * - sinon (aucune sauvegarde chargée, ou la session a changé de nom : « sauvegarder sous »), une sauvegarde qui porte
 *   déjà ce nom n'est écrasée qu'après confirmation (`ecraserLaSauvegarde`) ;
 * - sinon une nouvelle sauvegarde est créée ; elle devient la sauvegarde chargée, que « Sauvegarder » mettra à jour.
 * `sauvegardes` est la liste à écrire ; rien n'est écrit ici.
 */
export type EnregistrementDeLaSession =
  | { action: "mettre-a-jour"; sauvegardes: SaveSlot[] }
  | { action: "creer"; sauvegardes: SaveSlot[]; nouvelle: SaveSlot }
  | { action: "confirmer-l-ecrasement"; aEcraser: SaveSlot }

export function enregistrerLaSession(sauvegardes: SaveSlot[], session: SessionState, idChargee: string | null): EnregistrementDeLaSession {
  const chargee = idChargee ? sauvegardes.find(slot => slot.id === idChargee) : undefined
  if (chargee && chargee.name === session.name) return { action: "mettre-a-jour", sauvegardes: avecLaSession(sauvegardes, chargee, session) }
  const homonyme = sauvegardes.find(slot => slot.name === session.name)
  if (homonyme) return { action: "confirmer-l-ecrasement", aEcraser: homonyme }
  const nouvelle = createNewSlotFromSession(session)
  return { action: "creer", sauvegardes: [...sauvegardes, nouvelle], nouvelle }
}

/** Les sauvegardes, celle donnée remplacée par la session (même identifiant, même place dans la liste). */
export function avecLaSession(sauvegardes: SaveSlot[], cible: SaveSlot, session: SessionState): SaveSlot[] {
  const miseAJour = updateSlotWithSession(cible, session)
  return sauvegardes.map(slot => (slot.id === cible.id ? miseAJour : slot))
}

/** Les sauvegardes dans l'ordre d'affichage choisi ; un identifiant de l'ordre sans sauvegarde est ignoré. */
export function sauvegardesDansLOrdre(sauvegardes: SaveSlot[], ordre: string[]): SaveSlot[] {
  const parId = new Map(sauvegardes.map(slot => [slot.id, slot]))
  return ordre.map(id => parId.get(id)).filter((slot): slot is SaveSlot => slot !== undefined)
}
