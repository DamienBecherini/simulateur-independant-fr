// src/ui/hooks/useSessionManager.ts

import { useState, useEffect } from "react"
import type { SessionState, SaveSlot, SanitizationReport } from "@/types"
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

export function useSessionManager() {
  const [currentSession, setCurrentSession] = useState<SessionState>(getInitialSessionState())
  const [allSaveSlots, setAllSaveSlots] = useState<SaveSlot[]>([])
  const [slotOrder, setSlotOrder] = useState<string[]>([])

  // L'ÉTAT DE CONFIRMATION EST MAINTENANT GÉRÉ ICI
  const [importConfirmation, setImportConfirmation] = useState<{ session: SessionState; report: SanitizationReport } | null>(null)

  // Chargement initial des données
  useEffect(() => {
    Promise.all([window.api.getCurrentSession(), window.api.getSaveSlots(), window.api.getUserPreferences()]).then(([sessionData, slotsData, prefsData]) => {
      setCurrentSession(sessionData)
      setAllSaveSlots(slotsData)
      setSlotOrder(prefsData.slotOrder)
    })
  }, [])

  // Sauvegarde automatique
  useDebouncedSave(currentSession, 1000, window.api.saveCurrentSession)
  useDebouncedSave({ slotOrder }, 1000, window.api.saveUserPreferences)

  // --- TOUTE LA LOGIQUE EST MAINTENANT CENTRALISÉE ICI ---

  const handleImport = async () => {
    const result = await SessionService.importState()
    if (result && result.data) {
      const sessionToLoad: SessionState = {
        name: "Simulation importée",
        ...result.data
      }

      if (result.report && (result.report.entitiesRemoved > 0 || result.report.relationshipsRemoved > 0)) {
        setImportConfirmation({ session: sessionToLoad, report: result.report })
      } else {
        setCurrentSession(sessionToLoad)
      }
    }
  }

  const proceedWithImport = () => {
    if (importConfirmation) {
      setCurrentSession(importConfirmation.session)
      setImportConfirmation(null)
    }
  }

  const cancelImport = () => {
    setImportConfirmation(null)
  }

  const handleResetSession = () => {
    setCurrentSession(getInitialSessionState())
  }

  // ... (on pourrait aussi déplacer handleSave, handleDeleteSlot, etc. ici pour une centralisation totale)

  // On retourne tout ce dont l'UI a besoin
  return {
    currentSession,
    setCurrentSession,
    allSaveSlots,
    setAllSaveSlots,
    slotOrder,
    setSlotOrder,
    importConfirmation,
    handleImport,
    proceedWithImport,
    cancelImport,
    handleResetSession
  }
}
