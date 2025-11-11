// src/globals.d.ts
import type { SessionState, SaveSlot, UserPreferences, ExportableState, SanitizationReport, NotificationPayload, SimulationOutput } from "./types.js"

// On importe les types depuis notre nouveau module `types.ts` pour les utiliser ici.
export type EventPayloadMapping = {
  getCurrentSession: () => Promise<SessionState>
  saveCurrentSession: (session: SessionState) => Promise<void>
  getSaveSlots: () => Promise<SaveSlot[]>
  saveSlots: (slots: SaveSlot[]) => Promise<void>
  exportState: (state: ExportableState) => Promise<void>
  importState: () => Promise<{ data?: ExportableState; report?: SanitizationReport; error?: string }>
  getUserPreferences: () => Promise<UserPreferences>
  saveUserPreferences: (prefs: UserPreferences) => Promise<void>
  // --- NOUVELLE LIGNE POUR LA SIMULATION ---
  runSimulation: (session: SessionState) => Promise<SimulationOutput>
  onShowNotification: (callback: (payload: NotificationPayload) => void) => () => void
}

// Ce fichier étend les types globaux, notamment l'objet `window` pour le preload.
declare global {
  interface Window {
    api: EventPayloadMapping
  }
}
