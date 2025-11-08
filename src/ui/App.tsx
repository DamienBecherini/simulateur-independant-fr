// src/ui/App.tsx

import { useState, useEffect } from "react"
import EntitiesManager from "./components/EntitiesManager"
import { ThemeToggle } from "./components/ThemeToggle"
import Footer from "./components/Footer"
import { Settings, Undo2, Redo2, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsSheet } from "./components/SettingsSheet"
import MonthlyGrid from "./components/MonthlyGrid"
import { useSessionManager } from "./hooks/useSessionManager"
import type { SaveSlot } from "@/types"

function App() {
  const [isSettingsOpen, setSettingsOpen] = useState(false)

  // L'état du niveau de zoom (1 = 100%)
  const [zoomLevel, setZoomLevel] = useState(1)

  const { currentSession, setCurrentSession, allSaveSlots, setAllSaveSlots, slotOrder, setSlotOrder, importConfirmation, handleImport, proceedWithImport, cancelImport, handleResetSession, canUndo, canRedo, undo, redo } = useSessionManager()

  // Effet pour appliquer le zoom au corps du document quand l'état change
  useEffect(() => {
    document.body.style.zoom = `${zoomLevel}`
  }, [zoomLevel])

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

  const handleLoadSlot = (slotToLoad: SaveSlot) => {
    setCurrentSession({
      name: slotToLoad.name,
      entities: slotToLoad.entities,
      relationships: slotToLoad.relationships || [],
      monthlyData: slotToLoad.monthlyData || Array.from({ length: 12 }, (_, i) => ({ month: i, flows: [] }))
    })
    setSettingsOpen(false)
  }

  const handleConfirmImportAndClose = () => {
    proceedWithImport()
    setSettingsOpen(false)
  }

  const handleResetAndClose = () => {
    handleResetSession()
    setSettingsOpen(false)
  }

  // Fonctions pour gérer le zoom
  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 2)) // Plafond à 200%
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5)) // Plancher à 50%

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
        <EntitiesManager
          sessionName={currentSession.name}
          entities={currentSession.entities}
          setEntities={newEntitiesOrUpdater => {
            setCurrentSession(prevSession => ({
              ...prevSession,
              entities: typeof newEntitiesOrUpdater === "function" ? newEntitiesOrUpdater(prevSession.entities) : newEntitiesOrUpdater
            }))
          }}
          relationships={currentSession.relationships}
          setRelationships={newRelationshipsOrUpdater => {
            setCurrentSession(prev => ({
              ...prev,
              relationships: typeof newRelationshipsOrUpdater === "function" ? newRelationshipsOrUpdater(prev.relationships) : newRelationshipsOrUpdater
            }))
          }}
          monthlyData={currentSession.monthlyData}
          setMonthlyData={newMonthlyDataOrUpdater => {
            setCurrentSession(prev => ({
              ...prev,
              monthlyData: typeof newMonthlyDataOrUpdater === "function" ? newMonthlyDataOrUpdater(prev.monthlyData) : newMonthlyDataOrUpdater
            }))
          }}
        />

        <MonthlyGrid
          entities={currentSession.entities}
          monthlyData={currentSession.monthlyData}
          setMonthlyData={newMonthlyDataOrUpdater => {
            setCurrentSession(prev => ({
              ...prev,
              monthlyData: typeof newMonthlyDataOrUpdater === "function" ? newMonthlyDataOrUpdater(prev.monthlyData) : newMonthlyDataOrUpdater
            }))
          }}
        />
      </main>

      <Footer />

      <SettingsSheet isOpen={isSettingsOpen} onOpenChange={setSettingsOpen} allSaveSlots={allSaveSlots} setAllSaveSlots={setAllSaveSlots} currentSession={currentSession} setCurrentSession={setCurrentSession} onReset={handleResetAndClose} onLoadSlot={handleLoadSlot} slotOrder={slotOrder} setSlotOrder={setSlotOrder} onImport={handleImport} importConfirmation={importConfirmation} onConfirmImport={handleConfirmImportAndClose} onCancelImport={cancelImport} />
    </div>
  )
}

export default App
