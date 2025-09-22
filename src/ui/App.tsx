// src/ui/App.tsx

import { useState, useEffect } from "react"
import EntitiesManager from "./components/EntitiesManager"
import { ThemeToggle } from "./components/ThemeToggle"
import Footer from "./components/Footer"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsSheet } from "./components/SettingsSheet"
import { useDebouncedSave } from "./hooks/useDebouncedSave"

function App() {
  const [currentSession, setCurrentSession] = useState<SessionState>({ name: "Nouvelle Simulation", entities: [] })
  const [allSaveSlots, setAllSaveSlots] = useState<SaveSlot[]>([])
  // --- NOUVEL ÉTAT POUR GÉRER L'ORDRE ---
  const [slotOrder, setSlotOrder] = useState<string[]>([])

  const [isSettingsOpen, setSettingsOpen] = useState(false)

  // --- DEUX SAUVEGARDES AUTOMATIQUES DISTINCTES ---
  // Sauvegarde la session de travail quand elle change
  useDebouncedSave(currentSession, 1000, window.api.saveCurrentSession)
  // Sauvegarde les préférences (juste l'ordre pour l'instant) quand elles changent
  useDebouncedSave({ slotOrder }, 1000, window.api.saveUserPreferences)

  // --- CHARGEMENT INITIAL (maintenant 3 requêtes) ---
  useEffect(() => {
    Promise.all([window.api.getCurrentSession(), window.api.getSaveSlots(), window.api.getUserPreferences()]).then(([sessionData, slotsData, prefsData]) => {
      setCurrentSession(sessionData)
      setAllSaveSlots(slotsData)
      setSlotOrder(prefsData.slotOrder)

      // Logique de chargement au démarrage (inchangée)
      if (slotsData.length > 0 && sessionData.entities.length === 0) {
        // Optionnel : si la session est vide mais qu'il y a des slots, on pourrait charger le premier.
        // Pour l'instant, on laisse la session telle quelle.
      }
    })
  }, [])

  const handleResetSession = () => {
    setCurrentSession({ name: "Nouvelle Simulation", entities: [] })
    setSettingsOpen(false)
  }

  const handleLoadSlot = (slotToLoad: SaveSlot) => {
    setCurrentSession({
      name: slotToLoad.name,
      entities: slotToLoad.entities
    })
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
        <EntitiesManager
          entities={currentSession.entities}
          setEntities={newEntitiesOrUpdater => {
            if (typeof newEntitiesOrUpdater === "function") {
              setCurrentSession(prevSession => ({ ...prevSession, entities: newEntitiesOrUpdater(prevSession.entities) }))
            } else {
              setCurrentSession(prevSession => ({ ...prevSession, entities: newEntitiesOrUpdater }))
            }
          }}
        />
      </main>

      <Footer />

      <SettingsSheet
        isOpen={isSettingsOpen}
        onOpenChange={setSettingsOpen}
        allSaveSlots={allSaveSlots}
        setAllSaveSlots={setAllSaveSlots}
        currentSession={currentSession}
        setCurrentSession={setCurrentSession}
        onReset={handleResetSession}
        onLoadSlot={handleLoadSlot}
        // --- On passe le nouvel état et sa fonction de mise à jour ---
        slotOrder={slotOrder}
        setSlotOrder={setSlotOrder}
      />
    </div>
  )
}

export default App
