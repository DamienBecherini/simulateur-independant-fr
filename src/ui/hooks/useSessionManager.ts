// src/ui/hooks/useSessionManager.ts

import { useState, useEffect, useCallback, useRef, type Dispatch, type SetStateAction } from "react"
import { ANNEE_PAR_DEFAUT, grilleVide, type Comparateur, type SessionState, type SaveSlot, type SanitizationReport, type UserPreferences } from "@/types"
import * as SessionService from "@/lib/session-service"
import { avecSauvegardeChargee, preferencesSynchronisees } from "@/lib/preferences"
import { rapportAvecCorrections } from "@/backend/logic/data-sanitizer"
import { useDebouncedSave } from "./useDebouncedSave"

// Session vierge : une seule année, la dernière dont les règles sont connues.
function getInitialSessionState(): SessionState {
  return {
    name: "Nouvelle Simulation",
    entities: [],
    relationships: [],
    annees: [{ annee: ANNEE_PAR_DEFAUT, monthlyData: grilleVide() }]
  }
}

/**
 * Une session de l'historique, avec les réglages du comparateur de la session affichée : ils restent hors de
 * l'historique d'annulation (voir l'ADR 009), annuler une modification de la simulation ne les change pas.
 */
function avecLeComparateurDe(session: SessionState, source: SessionState): SessionState {
  const reste = { ...session }
  delete reste.comparateur
  return source.comparateur ? { ...reste, comparateur: source.comparateur } : reste
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
  const [allSaveSlots, setAllSaveSlots] = useState<SaveSlot[]>([])
  const [importConfirmation, setImportConfirmation] = useState<{ session: SessionState; report: SanitizationReport } | null>(null)
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({ slotOrder: [] })
  // La sauvegarde chargée est retenue dans les préférences : « Sauvegarder » la met à jour même après un redémarrage.
  const loadedSlotId = userPreferences.loadedSlotId ?? null
  const setLoadedSlotId: Dispatch<SetStateAction<string | null>> = useCallback(valeur => {
    setUserPreferences(prefs => avecSauvegardeChargee(prefs, typeof valeur === "function" ? valeur(prefs.loadedSlotId ?? null) : valeur))
  }, [])

  const [isLoaded, setLoaded] = useState(false)

  // Effet principal qui se déclenche une seule fois au démarrage de l'application.
  useEffect(() => {
    // On charge toutes les données nécessaires en parallèle depuis le backend.
    Promise.all([window.api.getCurrentSession(), window.api.getSaveSlots(), window.api.getUserPreferences()]).then(([sessionData, slotsData, prefsData]) => {
      // Les préférences sont remises en accord avec les sauvegardes réellement présentes (ordre d'affichage, sauvegarde
      // chargée), et enregistrées tout de suite si elles ont dû être corrigées.
      const finalPreferences = preferencesSynchronisees({ ...prefsData, slotOrder: prefsData.slotOrder ?? [] }, slotsData)
      if (JSON.stringify(finalPreferences) !== JSON.stringify(prefsData)) {
        console.warn("Incohérence détectée entre les sauvegardes et les préférences. Synchronisation automatique effectuée.")
        void window.api.saveUserPreferences(finalPreferences)
      }

      // On initialise les états React avec les données chargées et fraîchement synchronisées.
      setHistory({ past: [], present: sessionData, future: [] })
      setLoaded(true)
      setAllSaveSlots(slotsData)
      setUserPreferences(finalPreferences) // On utilise les préférences potentiellement corrigées.
    }).catch(error => console.error("Chargement de la session, des sauvegardes ou des préférences impossible :", error))
  }, []) // Le tableau de dépendances vide [] assure que cet effet ne s'exécute qu'une fois.

  // Hooks pour la sauvegarde automatique décalée (debounced).
  useDebouncedSave(history.present, 1000, window.api.saveCurrentSession)

  // À la fermeture de la fenêtre, la session est enregistrée tout de suite, sans attendre la sauvegarde différée.
  // On attend le premier chargement : sinon une session vide remplacerait celle sur le disque.
  const latestSession = useRef<SessionState | null>(null)
  useEffect(() => {
    latestSession.current = isLoaded ? history.present : null
  }, [history.present, isLoaded])
  useEffect(() => {
    const saveNow = () => {
      if (latestSession.current) window.api.saveCurrentSessionSync(latestSession.current)
    }
    window.addEventListener("beforeunload", saveNow)
    return () => window.removeEventListener("beforeunload", saveNow)
  }, [])
  useDebouncedSave(userPreferences, 1000, window.api.saveUserPreferences)

  // Les préférences aussi sont enregistrées à la fermeture, sans attendre : une sauvegarde chargée ou un zoom choisi
  // juste avant de fermer seraient sinon oubliés. Comme pour la session, pas avant le premier chargement.
  const latestPreferences = useRef<UserPreferences | null>(null)
  useEffect(() => {
    latestPreferences.current = isLoaded ? userPreferences : null
  }, [userPreferences, isLoaded])
  useEffect(() => {
    const saveNow = () => {
      if (latestPreferences.current) void window.api.saveUserPreferences(latestPreferences.current)
    }
    window.addEventListener("beforeunload", saveNow)
    return () => window.removeEventListener("beforeunload", saveNow)
  }, [])

  // Une sauvegarde chargée qui disparaît (supprimée de la liste) est oubliée : « Sauvegarder » en créera une nouvelle.
  useEffect(() => {
    if (isLoaded && loadedSlotId !== null && !allSaveSlots.some(slot => slot.id === loadedSlotId)) setLoadedSlotId(null)
  }, [isLoaded, loadedSlotId, allSaveSlots, setLoadedSlotId])

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
  }, [])

  // Réglages du comparateur : enregistrés avec la session, mais sans étape d'annulation (voir l'ADR 009). Un champ
  // de frais modifié chiffre par chiffre ferait sinon autant d'étapes, et ces choix ne changent pas la simulation.
  const setComparateur = useCallback((modifier: (comparateur: Comparateur | undefined) => Comparateur) => {
    setHistory(currentHistory => ({ ...currentHistory, present: { ...currentHistory.present, comparateur: modifier(currentHistory.present.comparateur) } }))
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
        present: avecLeComparateurDe(previous, present),
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
        present: avecLeComparateurDe(next, present),
        future: newFuture
      }
    })
  }, [])

  // Fonction centralisée pour charger une sauvegarde manuelle.
  const handleLoadSlot = useCallback(
    (slotToLoad: SaveSlot) => {
      const sessionFromSlot = SessionService.contenuDeLaSession(slotToLoad)
      setHistory({ past: [], present: sessionFromSlot, future: [] })
      setLoadedSlotId(slotToLoad.id)
    },
    [setHistory, setLoadedSlotId]
  )

  // Fonctions pour gérer le flux d'importation de fichier.
  const handleImport = async () => {
    const result = await SessionService.importState()
    if (result && result.data) {
      // Le nom du fichier est gardé (sauvegarde exportée) ; un export qui n'en porte pas reçoit « Simulation importée ».
      // La version de l'application qui a écrit le fichier est gardée telle quelle, jusqu'au prochain enregistrement.
      const { appVersion, name, entities, relationships, annees, comparateur } = result.data
      const sessionToLoad = SessionService.contenuDeLaSession({ appVersion, name: name ?? "Simulation importée", entities, relationships, annees, comparateur })
      // Dès que le fichier a été corrigé ou converti, l'utilisateur confirme avant de remplacer sa session.
      if (rapportAvecCorrections(result.report)) {
        setImportConfirmation({ session: sessionToLoad, report: result.report })
      } else {
        setHistory({ past: [], present: sessionToLoad, future: [] })
        setLoadedSlotId(null)
      }
    }
  }

  const proceedWithImport = () => {
    if (importConfirmation) {
      setHistory({ past: [], present: importConfirmation.session, future: [] })
      setImportConfirmation(null)
      setLoadedSlotId(null)
    }
  }

  const cancelImport = () => setImportConfirmation(null)

  // Fonction pour réinitialiser la session de travail à un état vierge.
  const handleResetSession = () => {
    setHistory({ past: [], present: getInitialSessionState(), future: [] })
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
    setComparateur,
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
