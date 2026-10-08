// src/globals.d.ts
import type { SessionState, SaveSlot, UserPreferences, ExportableState, SanitizationReport, NotificationPayload, SimulationPluriannuelle, ComparaisonOptions, ComparaisonResult, OptimisationRemuneration, StatutSociete, FormatFichierTexte, StrategiesDeDistribution } from "./types.js"
import type { PropositionRecue } from "./backend/mcp/proposition-en-attente.js"
import type { InfosDuServeurMcp } from "./lib/configuration-mcp.js"

// On importe les types depuis notre nouveau module `types.ts` pour les utiliser ici.
export type EventPayloadMapping = {
  getCurrentSession: () => Promise<SessionState>
  saveCurrentSession: (session: SessionState) => Promise<void>
  /** Enregistre la session immédiatement, de façon synchrone : réservé à la fermeture de la fenêtre. */
  saveCurrentSessionSync: (session: SessionState) => void
  /** Simule chaque année de la session. */
  simulerLesAnnees: (session: SessionState) => Promise<SimulationPluriannuelle>
  /** Le comparateur et l'optimiseur portent sur une année de la session. */
  compareStatuts: (session: SessionState, options: ComparaisonOptions, annee: number) => Promise<ComparaisonResult>
  optimiserRemuneration: (session: SessionState, options: ComparaisonOptions, statut: StatutSociete, annee: number) => Promise<OptimisationRemuneration>
  /** « Sur toutes les années » : stratégies de distribution d'une activité en SASU et en EURL, avec les réglages enregistrés du comparateur. */
  comparerStrategies: (session: SessionState, activityId: string) => Promise<StrategiesDeDistribution>
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
  /**
   * Ouvre hors de l'application (navigateur, messagerie) le formulaire de ticket du dépôt GitHub ou un e-mail à
   * l'adresse des retours, et rien d'autre (voir src/lib/adresses-des-retours.ts) ; `false` si l'adresse est refusée.
   */
  ouvrirAdresseExterne: (adresse: string) => Promise<boolean>
  getUserPreferences: () => Promise<UserPreferences>
  saveUserPreferences: (prefs: UserPreferences) => Promise<void>
  onShowNotification: (callback: (payload: NotificationPayload) => void) => () => void
  /** Chemins du serveur MCP local de cette installation, pour la configuration d'un client d'IA ; `null` dans la démo web. */
  infosDuServeurMcp: () => Promise<InfosDuServeurMcp | null>
  /** Les propositions d'un client d'IA en attente dans la boîte aux propositions (voir l'ADR 011) ; aucune dans la démo web. */
  propositionsEnAttente: () => Promise<PropositionRecue[]>
  /** Retire une proposition appliquée ou refusée de la boîte aux propositions ; `false` si elle n'y est plus. */
  retirerProposition: (id: string) => Promise<boolean>
  /** Appelé avec la liste des propositions en attente chaque fois qu'elle change ; rend la fonction de désabonnement. */
  onPropositionsEnAttente: (callback: (propositions: PropositionRecue[]) => void) => () => void
}

// Ce fichier étend les types globaux, notamment l'objet `window` pour le preload.
declare global {
  interface Window {
    api: EventPayloadMapping
  }
}
