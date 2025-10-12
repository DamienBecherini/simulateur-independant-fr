// src/ui/App.tsx

import { useState, useEffect } from "react"
import EntitiesManager from "./components/EntitiesManager"
import { ThemeToggle } from "./components/ThemeToggle"
import Footer from "./components/Footer"
import { Settings, Undo2, Redo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsSheet } from "./components/SettingsSheet"
import MonthlyGrid from "./components/MonthlyGrid"
import { useSessionManager } from "./hooks/useSessionManager"
import type { SaveSlot } from "@/types"

function App() {
  const [isSettingsOpen, setSettingsOpen] = useState(false)

  const { currentSession, setCurrentSession, allSaveSlots, setAllSaveSlots, slotOrder, setSlotOrder, importConfirmation, handleImport, proceedWithImport, cancelImport, handleResetSession, canUndo, canRedo, undo, redo } = useSessionManager()

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

  return (
    <div className="container mx-auto p-8 relative min-h-screen flex flex-col">
      <div className="absolute top-4 left-4 flex items-center gap-2" style={{ height: "2rem" }}>
        <Button variant="ghost" size="icon" className="h-10 w-10 [&_svg]:size-6" onClick={() => setSettingsOpen(true)}>
          <Settings className="text-slate-500" />
        </Button>
        <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} className="h-10 w-10 [&_svg]:size-6">
          <Undo2 />
        </Button>
        <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} className="h-10 w-10 [&_svg]:size-6">
          <Redo2 />
        </Button>
      </div>
      <div className="absolute top-4 right-4 flex items-center" style={{ height: "2rem" }}>
        <ThemeToggle />
      </div>

      <header className="text-center mb-10 mt-6">
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
