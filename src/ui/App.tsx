// src/ui/App.tsx

import { useState, useEffect } from "react"
import EntitiesManager from "./components/EntitiesManager"
import { ThemeToggle } from "./components/ThemeToggle"
import Footer from "./components/Footer"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsSheet } from "./components/SettingsSheet"
import { useDebouncedSave } from "./hooks/useDebouncedSave"

import MonthlyGrid from "./components/MonthlyGrid"

function getInitialSessionState(): SessionState {
  return {
    name: "Nouvelle Simulation",
    entities: [],
    relationships: [], // Cette ligne existe déjà, c'est parfait
    monthlyData: Array.from({ length: 12 }, (_, i) => ({ month: i, flows: [] }))
  }
}

function App() {
  const [currentSession, setCurrentSession] = useState<SessionState>(getInitialSessionState())
  // ... (les autres useState ne changent pas)
  const [allSaveSlots, setAllSaveSlots] = useState<SaveSlot[]>([])
  const [slotOrder, setSlotOrder] = useState<string[]>([])
  const [isSettingsOpen, setSettingsOpen] = useState(false)

  useDebouncedSave(currentSession, 1000, window.api.saveCurrentSession)
  useDebouncedSave({ slotOrder }, 1000, window.api.saveUserPreferences)

  useEffect(() => {
    // ... (cette fonction ne change pas)
    Promise.all([window.api.getCurrentSession(), window.api.getSaveSlots(), window.api.getUserPreferences()]).then(([sessionData, slotsData, prefsData]) => {
      setCurrentSession(prev => ({ ...prev, ...sessionData }))
      setAllSaveSlots(slotsData)
      setSlotOrder(prefsData.slotOrder)
    })
  }, [])

  const handleResetSession = () => {
    // ... (cette fonction ne change pas)
    setCurrentSession(getInitialSessionState())
    setSettingsOpen(false)
  }

  const handleLoadSlot = (slotToLoad: SaveSlot) => {
    // ... (cette fonction ne change pas)
    setCurrentSession({
      name: slotToLoad.name,
      entities: slotToLoad.entities,
      relationships: slotToLoad.relationships || [],
      monthlyData: slotToLoad.monthlyData || getInitialSessionState().monthlyData
    })
    setSettingsOpen(false)
  }

  return (
    <div className="container mx-auto p-8 relative min-h-screen flex flex-col">
      {/* ... (la partie <div className="absolute ..."> ne change pas) */}
      <div className="absolute top-4 left-4 flex items-center" style={{ height: "2rem" }}>
        <Button variant="ghost" size="icon" className="h-10 w-10 [&_svg]:size-6" onClick={() => setSettingsOpen(true)}>
          <Settings className="text-slate-500" />
        </Button>
      </div>
      <div className="absolute top-4 right-4 flex items-center" style={{ height: "2rem" }}>
        <ThemeToggle />
      </div>

      <header className="text-center mb-10 mt-6">
        {/* ... (le header ne change pas) */}
        <h1 className="text-4xl font-bold">{currentSession.name}</h1>
        <p className="text-lg text-slate-500">Votre bac à sable financier, juridique et fiscal</p>
      </header>

      <main className="flex-grow">
        {/* MISE À JOUR DE L'APPEL AU COMPOSANT */}
        <EntitiesManager
          entities={currentSession.entities}
          setEntities={newEntitiesOrUpdater => {
            if (typeof newEntitiesOrUpdater === "function") {
              setCurrentSession(prevSession => ({ ...prevSession, entities: newEntitiesOrUpdater(prevSession.entities) }))
            } else {
              setCurrentSession(prevSession => ({ ...prevSession, entities: newEntitiesOrUpdater }))
            }
          }}
          // On ajoute les nouvelles props ici
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

      {/* ... (la SettingsSheet ne change pas) */}
      <SettingsSheet isOpen={isSettingsOpen} onOpenChange={setSettingsOpen} allSaveSlots={allSaveSlots} setAllSaveSlots={setAllSaveSlots} currentSession={currentSession} setCurrentSession={setCurrentSession} onReset={handleResetSession} onLoadSlot={handleLoadSlot} slotOrder={slotOrder} setSlotOrder={setSlotOrder} />
    </div>
  )
}

export default App
