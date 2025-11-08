// src/ui/hooks/useSessionManager.ts

import { useState, useEffect, useCallback } from "react"
import type { SessionState, SaveSlot, SanitizationReport, UserPreferences } from "@/types"
import * as SessionService from "@/lib/session-service"
import { useDebouncedSave } from "./useDebouncedSave"

function getInitialSessionState(): SessionState {
  return {
    name: "Nouvelle Simulation",
    entities: [],
    relationships: [],
    monthlyData: Array.from({ length: 12 }, (_, i) => ({ month: i, flows: [] }))
  }
}

// Nous allons utiliser un "wrapper" pour notre état afin de suivre l'historique
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

  // Cet état séparé est la CLÉ pour ne pas déclencher la sauvegarde auto sur un undo/redo
  const [sessionForSaving, setSessionForSaving] = useState<SessionState>(getInitialSessionState())

  const [allSaveSlots, setAllSaveSlots] = useState<SaveSlot[]>([])
  const [importConfirmation, setImportConfirmation] = useState<{ session: SessionState; report: SanitizationReport } | null>(null)
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({ slotOrder: [] })

  // Chargement initial
  useEffect(() => {
    Promise.all([window.api.getCurrentSession(), window.api.getSaveSlots(), window.api.getUserPreferences()]).then(([sessionData, slotsData, prefsData]) => {
      setHistory({ past: [], present: sessionData, future: [] })
      setSessionForSaving(sessionData) // On initialise aussi l'état pour la sauvegarde
      setAllSaveSlots(slotsData)
      // On initialise l'état complet des préférences
      setUserPreferences(prefsData || { slotOrder: [], flowTypeColors: {} })
    })
  }, [])

  // La sauvegarde automatique n'écoute QUE `sessionForSaving`
  useDebouncedSave(sessionForSaving, 1000, window.api.saveCurrentSession)
  useDebouncedSave(userPreferences, 1000, window.api.saveUserPreferences)

  // La nouvelle fonction que les composants devront appeler pour mettre à jour l'état
  const setSession = useCallback((newSession: SessionState | ((prevState: SessionState) => SessionState)) => {
    setHistory(currentHistory => {
      const newPresent = typeof newSession === "function" ? newSession(currentHistory.present) : newSession

      // Si le nouvel état est identique au présent, on ne fait rien
      if (newPresent === currentHistory.present) {
        return currentHistory
      }

      // Une nouvelle action efface l'historique "futur" (redo)
      return {
        past: [...currentHistory.past, currentHistory.present],
        present: newPresent,
        future: []
      }
    })
    // On met à jour l'état pour la sauvegarde uniquement lors d'une action de l'utilisateur
    setSessionForSaving(prev => (typeof newSession === "function" ? newSession(prev) : newSession))
  }, [])

  const undo = useCallback(() => {
    setHistory(currentHistory => {
      const { past, present, future } = currentHistory
      if (past.length === 0) return currentHistory // Rien à annuler

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
      if (future.length === 0) return currentHistory // Rien à rétablir

      const next = future[0]
      const newFuture = future.slice(1)

      return {
        past: [...past, present],
        present: next,
        future: newFuture
      }
    })
  }, [])

  const handleImport = async () => {
    const result = await SessionService.importState()
    if (result && result.data) {
      const sessionToLoad: SessionState = { name: "Simulation importée", ...result.data }
      if (result.report && (result.report.entitiesRemoved > 0 || result.report.relationshipsRemoved > 0)) {
        setImportConfirmation({ session: sessionToLoad, report: result.report })
      } else {
        // Remplacer l'état et réinitialiser l'historique
        setHistory({ past: [], present: sessionToLoad, future: [] })
        setSessionForSaving(sessionToLoad)
      }
    }
  }

  const proceedWithImport = () => {
    if (importConfirmation) {
      setHistory({ past: [], present: importConfirmation.session, future: [] })
      setSessionForSaving(importConfirmation.session)
      setImportConfirmation(null)
    }
  }

  const cancelImport = () => setImportConfirmation(null)

  const handleResetSession = () => {
    setHistory({ past: [], present: getInitialSessionState(), future: [] })
    setSessionForSaving(getInitialSessionState())
  }

  const updateSlotOrder = useCallback((newOrder: string[] | ((prev: string[]) => string[])) => {
    setUserPreferences(currentPrefs => ({
      ...currentPrefs,
      slotOrder: typeof newOrder === "function" ? newOrder(currentPrefs.slotOrder) : newOrder
    }))
  }, [])

  // On expose l'état présent, les nouvelles fonctions, et l'état des piles
  return {
    currentSession: history.present,
    setCurrentSession: setSession, // IMPORTANT: on renomme notre nouvelle fonction
    allSaveSlots,
    setAllSaveSlots,
    // Expose l'état des préférences et sa fonction de mise à jour
    userPreferences,
    setUserPreferences,
    slotOrder: userPreferences.slotOrder,
    setSlotOrder: updateSlotOrder,

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
