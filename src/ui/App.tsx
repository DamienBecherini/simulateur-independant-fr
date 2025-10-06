// src/ui/App.tsx

import { useState } from "react"
import EntitiesManager from "./components/EntitiesManager"
import { ThemeToggle } from "./components/ThemeToggle"
import Footer from "./components/Footer"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsSheet } from "./components/SettingsSheet"
import MonthlyGrid from "./components/MonthlyGrid"
import { useSessionManager } from "./hooks/useSessionManager" // <-- 1. On importe le hook

function App() {
  // Le seul état local de App.tsx est maintenant celui qui gère l'ouverture de l'interface
  const [isSettingsOpen, setSettingsOpen] = useState(false)

  // 2. On appelle notre hook customisé qui centralise toute la logique de session
  const { currentSession, setCurrentSession, allSaveSlots, setAllSaveSlots, slotOrder, setSlotOrder, importConfirmation, handleImport, proceedWithImport, cancelImport, handleResetSession } = useSessionManager()

  // Cette fonction reste ici car elle a besoin de `setCurrentSession` (du hook)
  // et `setSettingsOpen` (de l'état local de App.tsx)
  const handleLoadSlot = (slotToLoad: SaveSlot) => {
    setCurrentSession({
      name: slotToLoad.name,
      entities: slotToLoad.entities,
      relationships: slotToLoad.relationships || [],
      monthlyData: slotToLoad.monthlyData || Array.from({ length: 12 }, (_, i) => ({ month: i, flows: [] }))
    })
    setSettingsOpen(false)
  }

  // On crée des gestionnaires qui combinent la logique du hook avec la fermeture de la modale
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
      <div className="absolute top-4 left-4 flex items-center" style={{ height: "2rem" }}>
        <Button variant="ghost" size="icon" className="h-10 w-10 [&_svg]:size-6" onClick={() => setSettingsOpen(true)}>
          <Settings className="text-slate-500" />
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
        {/* 3. On passe l'état et les fonctions de mise à jour aux composants enfants */}
        <EntitiesManager
          entities={currentSession.entities}
          setEntities={newEntitiesOrUpdater => {
            if (typeof newEntitiesOrUpdater === "function") {
              setCurrentSession(prevSession => ({ ...prevSession, entities: newEntitiesOrUpdater(prevSession.entities) }))
            } else {
              setCurrentSession(prevSession => ({ ...prevSession, entities: newEntitiesOrUpdater }))
            }
          }}
          relationships={currentSession.relationships}
          setRelationships={newRelationshipsOrUpdater => {
            if (typeof newRelationshipsOrUpdater === "function") {
              setCurrentSession(prev => ({ ...prev, relationships: newRelationshipsOrUpdater(prev.relationships) }))
            } else {
              setCurrentSession(prev => ({ ...prev, relationships: newRelationshipsOrUpdater }))
            }
          }}
        />

        <MonthlyGrid
          entities={currentSession.entities}
          monthlyData={currentSession.monthlyData}
          setMonthlyData={newMonthlyData => {
            setCurrentSession(prev => ({ ...prev, monthlyData: newMonthlyData }))
          }}
        />
      </main>

      <Footer />

      {/* 4. La SettingsSheet reçoit tout ce dont elle a besoin via les props */}
      <SettingsSheet isOpen={isSettingsOpen} onOpenChange={setSettingsOpen} allSaveSlots={allSaveSlots} setAllSaveSlots={setAllSaveSlots} currentSession={currentSession} setCurrentSession={setCurrentSession} onReset={handleResetAndClose} onLoadSlot={handleLoadSlot} slotOrder={slotOrder} setSlotOrder={setSlotOrder} onImport={handleImport} importConfirmation={importConfirmation} onConfirmImport={handleConfirmImportAndClose} onCancelImport={cancelImport} />
    </div>
  )
}

export default App
