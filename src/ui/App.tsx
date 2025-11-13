// src/ui/App.tsx

import { useState, useEffect, useMemo, useRef } from "react"
import EntitiesManager from "./components/EntitiesManager"
import { ThemeToggle } from "./components/ThemeToggle"
import Footer from "./components/Footer"
import { Settings, Undo2, Redo2, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsSheet } from "./components/SettingsSheet"
import MonthlyGrid from "./components/MonthlyGrid"
import { useSessionManager } from "./hooks/useSessionManager"
import type { SaveSlot, Entity, Relationship } from "@/types"
import { FlowLegend } from "./components/FlowLegend"
import { Results } from "./components/Results.tsx"
import EditEntityModal from "./components/EditEntityModal.tsx"
import { sanitizeFlowsAfterRelationshipChange } from "@/lib/business-logic.ts"
import { cn } from "@/lib/utils.ts"

function App() {
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)

  const [isNavHidden, setIsNavHidden] = useState(false)
  const lastScrollY = useRef(0)

  const { currentSession, setCurrentSession, allSaveSlots, setAllSaveSlots, slotOrder, setSlotOrder, userPreferences, setUserPreferences, importConfirmation, handleImport, proceedWithImport, cancelImport, handleResetSession, canUndo, canRedo, undo, redo, loadedSlotId, setLoadedSlotId, handleLoadSlot } = useSessionManager()

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollThreshold = 10

      if (currentScrollY <= scrollThreshold) {
        setIsNavHidden(false)
        lastScrollY.current = currentScrollY
        return
      }

      if (currentScrollY > lastScrollY.current) {
        setIsNavHidden(true)
      } else {
        setIsNavHidden(false)
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

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

  const handleConfirmImportAndClose = () => {
    proceedWithImport()
    setSettingsOpen(false)
  }

  const handleResetAndClose = () => {
    handleResetSession()
    setSettingsOpen(false)
  }

  const handleLoadAndClose = (slotToLoad: SaveSlot) => {
    handleLoadSlot(slotToLoad)
    setSettingsOpen(false)
  }

  const handleUpdateEntity = (updatedEntity: Entity, updatedRelationships: Relationship[]) => {
    setCurrentSession(prevSession => {
      const updatedEntities = prevSession.entities.map(entity => (entity.id === updatedEntity.id ? updatedEntity : entity))
      const tempState = { ...prevSession, entities: updatedEntities, relationships: updatedRelationships }
      const sanitizedMonthlyData = sanitizeFlowsAfterRelationshipChange(tempState)
      return { ...tempState, monthlyData: sanitizedMonthlyData }
    })
    setEditingEntity(null)
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
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-2 backdrop-blur-sm bg-background/80 border-b",
          // ====================================================================
          // === DÉBUT DE LA MODIFICATION ===
          // ====================================================================
          // La transition s'applique maintenant à TOUTES les propriétés animables (transform et box-shadow)
          "transition-all duration-300 ease-in-out",
          // On utilise un objet pour appliquer les classes de manière conditionnelle
          {
            // Styles pour l'état VISIBLE (!isNavHidden)
            "shadow-lg dark:shadow-[0_4px_14px_0_rgba(253,230,138,0.12)]": !isNavHidden,
            // Styles pour l'état CACHÉ (isNavHidden)
            "shadow-md dark:shadow-[0_2px_8px_0_rgba(253,230,138,0.5)] slide-up": isNavHidden
          }
          // ====================================================================
          // === FIN DE LA MODIFICATION ===
          // ====================================================================
        )}
      >
        <div className="container mx-auto flex items-center justify-between px-8 py-2">
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
        <EntitiesManager onEditEntity={setEditingEntity} session={currentSession} setCurrentSession={setCurrentSession} />

        <MonthlyGrid
          entities={currentSession.entities}
          monthlyData={currentSession.monthlyData}
          setMonthlyData={newMonthlyDataOrUpdater => {
            setCurrentSession(prev => ({
              ...prev,
              monthlyData: typeof newMonthlyDataOrUpdater === "function" ? newMonthlyDataOrUpdater(prev.monthlyData) : newMonthlyDataOrUpdater
            }))
          }}
          preferences={userPreferences}
          flowTypeToNumberMap={flowTypeToNumberMap}
          onEditEntity={setEditingEntity}
        />

        <FlowLegend preferences={userPreferences} onPreferencesChange={setUserPreferences} flowTypeToNumberMap={flowTypeToNumberMap} />

        <Results currentSession={currentSession} />
      </main>

      <Footer />

      <SettingsSheet isOpen={isSettingsOpen} onOpenChange={setSettingsOpen} allSaveSlots={allSaveSlots} setAllSaveSlots={setAllSaveSlots} currentSession={currentSession} setCurrentSession={setCurrentSession} onReset={handleResetAndClose} onLoadSlot={handleLoadAndClose} slotOrder={slotOrder} setSlotOrder={setSlotOrder} onImport={handleImport} importConfirmation={importConfirmation} onConfirmImport={handleConfirmImportAndClose} onCancelImport={cancelImport} loadedSlotId={loadedSlotId} setLoadedSlotId={setLoadedSlotId} />

      <EditEntityModal isOpen={!!editingEntity} entity={editingEntity} onClose={() => setEditingEntity(null)} onSave={handleUpdateEntity} allEntities={currentSession.entities} relationships={currentSession.relationships} />
    </div>
  )
}

export default App
