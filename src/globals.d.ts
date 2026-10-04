// src/globals.d.ts
import type { SessionState, SaveSlot, UserPreferences, ExportableState, SanitizationReport, NotificationPayload, SimulationReport, ComparaisonOptions, ComparaisonResult } from "./types.js"

// On importe les types depuis notre nouveau module `types.ts` pour les utiliser ici.
export type EventPayloadMapping = {
  getCurrentSession: () => Promise<SessionState>
  saveCurrentSession: (session: SessionState) => Promise<void>
  /** Enregistre la session immédiatement, de façon synchrone : réservé à la fermeture de la fenêtre. */
  saveCurrentSessionSync: (session: SessionState) => void
  runMetaSimulation: (session: SessionState) => Promise<SimulationReport>
  compareStatuts: (session: SessionState, options: ComparaisonOptions) => Promise<ComparaisonResult>
  getSaveSlots: () => Promise<SaveSlot[]>
  saveSlots: (slots: SaveSlot[]) => Promise<void>
  exportState: (state: ExportableState) => Promise<void>
  importState: () => Promise<{ data?: ExportableState; report?: SanitizationReport; error?: string }>
  getUserPreferences: () => Promise<UserPreferences>
  saveUserPreferences: (prefs: UserPreferences) => Promise<void>
  onShowNotification: (callback: (payload: NotificationPayload) => void) => () => void
}

// Ce fichier étend les types globaux, notamment l'objet `window` pour le preload.
declare global {
  interface Window {
    api: EventPayloadMapping
  }
}
