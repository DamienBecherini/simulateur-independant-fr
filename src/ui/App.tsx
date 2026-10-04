// src/ui/App.tsx

import { useState, useEffect, useCallback, useMemo } from "react"
import EntitiesManager from "./components/EntitiesManager"
import { ThemeToggle } from "./components/ThemeToggle"
import Footer from "./components/Footer"
import { Settings, Undo2, Redo2, ZoomIn, ZoomOut, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsSheet } from "./components/SettingsSheet"
import MonthlyGrid from "./components/MonthlyGrid"
import { useSessionManager } from "./hooks/useSessionManager"
import type { SaveSlot, SimulationReport } from "@/types"
import { ResultsPanel } from "./components/ResultsPanel"
import { FlowLegend } from "./components/FlowLegend"

function App() {
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [simulationReport, setSimulationReport] = useState<SimulationReport | null>(null)
  const [simulationError, setSimulationError] = useState<string | null>(null)

  // --- MODIFICATION : Récupération des nouveaux états et fonctions du hook ---
  // On récupère tout ce dont on a besoin depuis le "cerveau" de l'application.
  const { currentSession, setCurrentSession, allSaveSlots, setAllSaveSlots, slotOrder, setSlotOrder, userPreferences, setUserPreferences, importConfirmation, handleImport, proceedWithImport, cancelImport, handleResetSession, canUndo, canRedo, undo, redo, loadedSlotId, setLoadedSlotId, handleLoadSlot } = useSessionManager()

  useEffect(() => {
    document.body.style.zoom = `${zoomLevel}`
  }, [zoomLevel])

  // La simulation est recalculée automatiquement, peu après chaque modification de la session.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const report = await window.api.runMetaSimulation(currentSession)
        if (cancelled) return
        setSimulationReport(report)
        setSimulationError(null)
      } catch (e) {
        if (cancelled) return
        setSimulationError(e instanceof Error ? e.message : "La simulation a échoué.")
        setSimulationReport(null)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [currentSession])

  const handleExportAll = useCallback(async () => {
    const exportPayload = {
      entities: currentSession.entities,
      relationships: currentSession.relationships,
      monthlyData: currentSession.monthlyData,
      simulationReport,
      simulationError,
      exportedAt: new Date().toISOString()
    }

    await window.api.exportState(exportPayload)
  }, [currentSession, simulationReport, simulationError])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
      const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey

      if (ctrlOrCmd && event.key.toLowerCase() === "z") {
        event.preventDefault()
        if (event.shiftKey) {
          if (canRedo) redo()
        } else {
          if (canUndo) undo()
        }
      } else if (ctrlOrCmd && event.key.toLowerCase() === "y" && !isMac) {
        event.preventDefault()
        if (canRedo) redo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [undo, redo, canUndo, canRedo])

  // --- SUPPRESSION : La logique de chargement est maintenant entièrement dans le hook useSessionManager ---
  // L'ancienne fonction handleLoadSlot qui était ici est supprimée.

  const handleConfirmImportAndClose = () => {
    proceedWithImport()
    setSettingsOpen(false)
  }

  const handleResetAndClose = () => {
    handleResetSession()
    setSettingsOpen(false)
  }

  // --- MODIFICATION : On utilise la fonction de chargement du hook et on ferme le panneau. ---
  // Cette fonction "wrapper" permet de coupler l'action de chargement avec la fermeture de l'UI.
  const handleLoadAndClose = (slotToLoad: SaveSlot) => {
    handleLoadSlot(slotToLoad)
    setSettingsOpen(false)
  }

  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 2))
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5))

  const flowTypeToNumberMap = useMemo(() => {
    const types = new Set<string>()
    currentSession.monthlyData.forEach(month => {
      month.flows.forEach(flow => types.add(flow.type))
    })
    const sortedTypes = Array.from(types).sort()

    const map = new Map<string, number>()
    sortedTypes.forEach((type, index) => {
      map.set(type, index + 1)
    })
    return map
  }, [currentSession.monthlyData])

  return (
    <div className="container mx-auto p-8 min-h-screen flex flex-col">
      {/* Barre de menu sticky */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-2 backdrop-blur-sm bg-background/80 border-b">
        <div className="container mx-auto flex items-center justify-between px-8 py-2">
          {/* Groupe de boutons de gauche */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-10 w-10 [&_svg]:size-6" onClick={() => setSettingsOpen(true)}>
              <Settings className="text-slate-500" />
            </Button>
            <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} className="h-10 w-10 [&_svg]:size-6 ml-2">
              <Undo2 className="dark:text-slate-300" />
            </Button>
            <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} className="h-10 w-10 [&_svg]:size-6">
              <Redo2 className="dark:text-slate-300" />
            </Button>
          </div>
          {/* Groupe de boutons de droite */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 gap-2 mr-2" onClick={handleExportAll}>
              <Download className="size-4" />
              Exporter
            </Button>
            <Button variant="ghost" size="icon" onClick={zoomOut} className="h-10 w-10 [&_svg]:size-6">
              <ZoomOut className="text-slate-500" />
            </Button>
            <Button variant="ghost" size="icon" onClick={zoomIn} className="h-10 w-10 [&_svg]:size-6 mr-4">
              <ZoomIn className="text-slate-500" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <header className="text-center mb-10 pt-16">
        <h1 className="text-4xl font-bold">{currentSession.name}</h1>
        <p className="text-lg text-slate-500">Votre bac à sable financier, juridique et fiscal</p>
      </header>

      <main className="flex-grow">
        <EntitiesManager session={currentSession} setSession={setCurrentSession} />

        <MonthlyGrid
          entities={currentSession.entities}
          monthlyData={currentSession.monthlyData}
          setMonthlyData={newMonthlyDataOrUpdater => {
            setCurrentSession(prev => {
              const monthlyData = typeof newMonthlyDataOrUpdater === "function" ? newMonthlyDataOrUpdater(prev.monthlyData) : newMonthlyDataOrUpdater
              // Données inchangées : on renvoie la session telle quelle, sans créer d'entrée d'historique.
              return monthlyData === prev.monthlyData ? prev : { ...prev, monthlyData }
            })
          }}
          preferences={userPreferences}
          flowTypeToNumberMap={flowTypeToNumberMap}
        />

        <FlowLegend preferences={userPreferences} onPreferencesChange={setUserPreferences} flowTypeToNumberMap={flowTypeToNumberMap} />

        <ResultsPanel entities={currentSession.entities} report={simulationReport} error={simulationError} />
      </main>

      <Footer />

      {/* --- MODIFICATION : Passage des nouvelles props à SettingsSheet --- */}
      {/* On transmet l'ID du slot chargé et la fonction pour le modifier, afin que
          le panneau de configuration ait tout le contexte nécessaire. */}
      <SettingsSheet
        isOpen={isSettingsOpen}
        onOpenChange={setSettingsOpen}
        allSaveSlots={allSaveSlots}
        setAllSaveSlots={setAllSaveSlots}
        currentSession={currentSession}
        setCurrentSession={setCurrentSession}
        onReset={handleResetAndClose}
        onLoadSlot={handleLoadAndClose} // On passe la nouvelle fonction wrapper
        slotOrder={slotOrder}
        setSlotOrder={setSlotOrder}
        onImport={handleImport}
        importConfirmation={importConfirmation}
        onConfirmImport={handleConfirmImportAndClose}
        onCancelImport={cancelImport}
        // Ajout des props cruciales pour la nouvelle logique
        loadedSlotId={loadedSlotId}
        setLoadedSlotId={setLoadedSlotId}
      />
    </div>
  )
}

export default App
