// src/globals.d.ts
import type { SessionState, SaveSlot, UserPreferences, ExportableState, SanitizationReport, NotificationPayload, SimulationReport, ComparaisonOptions, ComparaisonResult, OptimisationRemuneration, StatutSociete, FormatFichierTexte } from "./types.js"

// On importe les types depuis notre nouveau module `types.ts` pour les utiliser ici.
export type EventPayloadMapping = {
  getCurrentSession: () => Promise<SessionState>
  saveCurrentSession: (session: SessionState) => Promise<void>
  /** Enregistre la session immédiatement, de façon synchrone : réservé à la fermeture de la fenêtre. */
  saveCurrentSessionSync: (session: SessionState) => void
  runMetaSimulation: (session: SessionState) => Promise<SimulationReport>
  compareStatuts: (session: SessionState, options: ComparaisonOptions) => Promise<ComparaisonResult>
  optimiserRemuneration: (session: SessionState, options: ComparaisonOptions, statut: StatutSociete) => Promise<OptimisationRemuneration>
  getSaveSlots: () => Promise<SaveSlot[]>
  /** Enregistre toutes les sauvegardes ; `silencieux` évite la notification « Sauvegarde réussie ! » (après un import, qui a son propre bilan). */
  saveSlots: (slots: SaveSlot[], options?: { silencieux?: boolean }) => Promise<void>
  exportState: (state: ExportableState) => Promise<void>
  importState: () => Promise<{ data?: ExportableState; report?: SanitizationReport; error?: string }>
  /** Fait enregistrer un fichier texte à l'utilisateur ; `true` s'il a été enregistré, `false` s'il a annulé. */
  saveTextFile: (options: { defaultName: string; content: string; format: FormatFichierTexte }) => Promise<boolean>
  /** Fait choisir un fichier texte à l'utilisateur et renvoie son contenu ; `null` s'il a annulé. */
  openTextFile: (options: { title: string; format: FormatFichierTexte }) => Promise<string | null>
  /** Enregistre la page en PDF (Electron) ou ouvre l'impression du navigateur (démo web) ; `true` si c'est fait. */
  printToPdf: (defaultName: string) => Promise<boolean>
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
