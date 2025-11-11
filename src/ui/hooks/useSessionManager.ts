// src/ui/hooks/useSessionManager.ts

import { useState, useEffect, useCallback } from "react"
import type { SessionState, SaveSlot, SanitizationReport, UserPreferences } from "@/types"
import * as SessionService from "@/lib/session-service"
import { useDebouncedSave } from "./useDebouncedSave"

// Fonction utilitaire pour créer une session vierge.
function getInitialSessionState(): SessionState {
  return {
    name: "Nouvelle Simulation",
    entities: [],
    relationships: [],
    monthlyData: Array.from({ length: 12 }, (_, i) => ({ month: i, flows: [] }))
  }
}

// Interface pour la structure de l'historique (Undo/Redo).
interface HistoryState {
  past: SessionState[]
  present: SessionState
  future: SessionState[]
}

export function useSessionManager() {
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: getInitialSessionState(),
    future: []
  })

  const [sessionForSaving, setSessionForSaving] = useState<SessionState>(getInitialSessionState())
  const [allSaveSlots, setAllSaveSlots] = useState<SaveSlot[]>([])
  const [importConfirmation, setImportConfirmation] = useState<{ session: SessionState; report: SanitizationReport } | null>(null)
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({ slotOrder: [] })
  const [loadedSlotId, setLoadedSlotId] = useState<string | null>(null)

  // Effet principal qui se déclenche une seule fois au démarrage de l'application.
  useEffect(() => {
    // On charge toutes les données nécessaires en parallèle depuis le backend.
    Promise.all([window.api.getCurrentSession(), window.api.getSaveSlots(), window.api.getUserPreferences()]).then(([sessionData, slotsData, prefsData]) => {
      // --- NOUVELLE LOGIQUE D'AUTO-RÉPARATION ---
      // Ce bloc garantit que la liste d'affichage (`slotOrder`) est toujours synchronisée avec les données réelles des sauvegardes (`slotsData`).
      const validPrefs = prefsData || { slotOrder: [], flowTypeColors: {} }
      const slotIdsFromFile = new Set(slotsData.map(s => s.id))
      let order = validPrefs.slotOrder || []

      // 1. On retire de `slotOrder` les IDs qui n'existent plus dans les sauvegardes (slots "fantômes" dans la liste d'ordre).
      const cleanOrder = order.filter(id => slotIdsFromFile.has(id))

      // 2. On trouve les slots qui existent dans le fichier de sauvegarde mais qui manquent dans la liste d'ordre (slots "orphelins").
      const orderedIds = new Set(cleanOrder)
      const orphanSlots = slotsData.filter(slot => !orderedIds.has(slot.id))

      // 3. On crée le nouvel ordre final en ajoutant les slots orphelins au début de la liste nettoyée.
      // Cela garantit que toutes les sauvegardes sont visibles, même en cas de corruption du fichier de préférences.
      const finalOrder = [...orphanSlots.map(s => s.id), ...cleanOrder]

      const finalPreferences: UserPreferences = {
        ...validPrefs,
        slotOrder: finalOrder
      }

      // 4. Si on a dû corriger l'ordre, on le sauvegarde immédiatement sur le disque pour corriger la désynchronisation pour de bon.
      if (JSON.stringify(finalOrder) !== JSON.stringify(order)) {
        console.warn("Incohérence détectée entre les slots et l'ordre de tri. Synchronisation automatique effectuée.")
        window.api.saveUserPreferences(finalPreferences)
      }
      // --- FIN DE LA LOGIQUE D'AUTO-RÉPARATION ---

      // On initialise les états React avec les données chargées et fraîchement synchronisées.
      setHistory({ past: [], present: sessionData, future: [] })
      setSessionForSaving(sessionData)
      setAllSaveSlots(slotsData)
      setUserPreferences(finalPreferences) // On utilise les préférences potentiellement corrigées.
    })
  }, []) // Le tableau de dépendances vide [] assure que cet effet ne s'exécute qu'une fois.

  // Hooks pour la sauvegarde automatique décalée (debounced).
  useDebouncedSave(sessionForSaving, 1000, window.api.saveCurrentSession)
  useDebouncedSave(userPreferences, 1000, window.api.saveUserPreferences)

  // Fonction pour mettre à jour l'état de la session tout en gérant l'historique.
  const setSession = useCallback((newSession: SessionState | ((prevState: SessionState) => SessionState)) => {
    setHistory(currentHistory => {
      const newPresent = typeof newSession === "function" ? newSession(currentHistory.present) : newSession
      if (newPresent === currentHistory.present) {
        return currentHistory
      }
      return {
        past: [...currentHistory.past, currentHistory.present],
        present: newPresent,
        future: []
      }
    })
    setSessionForSaving(prev => (typeof newSession === "function" ? newSession(prev) : newSession))
  }, [])

  // Fonctions pour annuler (Undo) et rétablir (Redo).
  const undo = useCallback(() => {
    setHistory(currentHistory => {
      const { past, present, future } = currentHistory
      if (past.length === 0) return currentHistory
      const previous = past[past.length - 1]
      const newPast = past.slice(0, past.length - 1)
      return {
        past: newPast,
        present: previous,
        future: [present, ...future]
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory(currentHistory => {
      const { past, present, future } = currentHistory
      if (future.length === 0) return currentHistory
      const next = future[0]
      const newFuture = future.slice(1)
      return {
        past: [...past, present],
        present: next,
        future: newFuture
      }
    })
  }, [])

  // Fonction centralisée pour charger une sauvegarde manuelle.
  const handleLoadSlot = useCallback(
    (slotToLoad: SaveSlot) => {
      const sessionFromSlot: SessionState = {
        name: slotToLoad.name,
        entities: slotToLoad.entities,
        relationships: slotToLoad.relationships,
        monthlyData: slotToLoad.monthlyData
      }
      setHistory({ past: [], present: sessionFromSlot, future: [] })
      setSessionForSaving(sessionFromSlot)
      setLoadedSlotId(slotToLoad.id)
    },
    [setHistory, setSessionForSaving, setLoadedSlotId]
  )

  // Fonctions pour gérer le flux d'importation de fichier.
  const handleImport = async () => {
    const result = await SessionService.importState()
    if (result && result.data) {
      const sessionToLoad: SessionState = { name: "Simulation importée", ...result.data }
      if (result.report && (result.report.entitiesRemoved > 0 || result.report.relationshipsRemoved > 0)) {
        setImportConfirmation({ session: sessionToLoad, report: result.report })
      } else {
        setHistory({ past: [], present: sessionToLoad, future: [] })
        setSessionForSaving(sessionToLoad)
        setLoadedSlotId(null)
      }
    }
  }

  const proceedWithImport = () => {
    if (importConfirmation) {
      setHistory({ past: [], present: importConfirmation.session, future: [] })
      setSessionForSaving(importConfirmation.session)
      setImportConfirmation(null)
      setLoadedSlotId(null)
    }
  }

  const cancelImport = () => setImportConfirmation(null)

  // Fonction pour réinitialiser la session de travail à un état vierge.
  const handleResetSession = () => {
    setHistory({ past: [], present: getInitialSessionState(), future: [] })
    setSessionForSaving(getInitialSessionState())
    setLoadedSlotId(null)
  }

  // Fonction pour mettre à jour l'ordre des sauvegardes dans les préférences.
  const updateSlotOrder = useCallback((newOrder: string[] | ((prev: string[]) => string[])) => {
    setUserPreferences(currentPrefs => ({
      ...currentPrefs,
      slotOrder: typeof newOrder === "function" ? newOrder(currentPrefs.slotOrder) : newOrder
    }))
  }, [])

  // On exporte tous les états et fonctions nécessaires pour les composants de l'interface.
  return {
    currentSession: history.present,
    setCurrentSession: setSession,
    allSaveSlots,
    setAllSaveSlots,
    userPreferences,
    setUserPreferences,
    slotOrder: userPreferences.slotOrder,
    setSlotOrder: updateSlotOrder,
    loadedSlotId,
    setLoadedSlotId,
    handleLoadSlot,
    importConfirmation,
    handleImport,
    proceedWithImport,
    cancelImport,
    handleResetSession,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo,
    redo
  }
}
