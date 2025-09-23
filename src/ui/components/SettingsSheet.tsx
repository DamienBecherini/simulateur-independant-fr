// src/ui/components/SettingsSheet.tsx

import { useState, Dispatch, SetStateAction, useMemo, useEffect } from "react"
// TypeScript augmentation for window.api
declare global {
  interface Window {
    api: EventPayloadMapping
  }
}
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Save, Upload, Download, Trash2, ChevronLeft, RefreshCcw } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

// ... (Interface SettingsSheetProps et composant SaveSlotItem ne changent pas)
interface SettingsSheetProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  allSaveSlots: SaveSlot[]
  setAllSaveSlots: Dispatch<SetStateAction<SaveSlot[]>>
  currentSession: SessionState
  setCurrentSession: Dispatch<SetStateAction<SessionState>>
  onReset: () => void
  onLoadSlot: (slot: SaveSlot) => void
  slotOrder: string[]
  setSlotOrder: Dispatch<SetStateAction<string[]>>
}

function SaveSlotItem({ slot, onDelete, onExport, onLoad }: { slot: SaveSlot; onDelete: () => void; onExport: () => void; onLoad: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: slot.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  // ... (Le JSX de SaveSlotItem ne change pas)
  return (
    <div ref={setNodeRef} style={style} className="p-4 border rounded-md flex flex-col gap-3 bg-background touch-none">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 flex-grow min-w-0">
          <div {...attributes} {...listeners} className="cursor-grab p-2 -ml-2">
            <svg width="15" viewBox="0 0 15 15" fill="none" className="text-slate-400 flex-shrink-0">
              <path d="M5.5 4.625C5.01421 4.625 4.625 5.01421 4.625 5.5C4.625 5.98579 5.01421 6.375 5.5 6.375C5.98579 6.375 6.375 5.98579 6.375 5.5C6.375 5.01421 5.98579 4.625 5.5 4.625ZM9.5 4.625C9.01421 4.625 8.625 5.01421 8.625 5.5C8.625 5.98579 9.01421 6.375 9.5 6.375C9.98579 6.375 10.375 5.98579 10.375 5.5C10.375 5.01421 9.98579 4.625 9.5 4.625ZM6.375 9.5C6.375 9.01421 5.98579 8.625 5.5 8.625C5.01421 8.625 4.625 9.01421 4.625 9.5C4.625 9.98579 5.01421 10.375 5.5 10.375C5.98579 10.375 6.375 9.98579 6.375 9.5ZM9.5 8.625C9.01421 8.625 8.625 9.01421 8.625 9.5C8.625 9.98579 9.01421 10.375 9.5 10.375C9.98579 10.375 10.375 9.98579 10.375 9.5C10.375 9.01421 9.98579 8.625 9.5 8.625Z" fill="currentColor"></path>
            </svg>
          </div>
          <div className="flex-grow cursor-pointer min-w-0" onClick={onLoad}>
            <p className="font-bold truncate" title={slot.name}>
              {slot.name}
            </p>
            <p className="text-sm text-slate-500">Modifié le: {new Date(slot.lastModified).toLocaleString("fr-FR")}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onDelete} className="flex-shrink-0">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <Button onClick={onExport} variant="outline" size="sm" className="self-start min-w-[200px] justify-start">
        <Download className="mr-2 h-4 w-4" /> Exporter cette sauvegarde...
      </Button>
    </div>
  )
}

export function SettingsSheet({ isOpen, onOpenChange, allSaveSlots, setAllSaveSlots, currentSession, setCurrentSession, onReset, onLoadSlot, slotOrder, setSlotOrder }: SettingsSheetProps) {
  const [view, setView] = useState<"main" | "load">("main")
  const [isOverwriteAlertOpen, setOverwriteAlertOpen] = useState(false)
  const [slotToOverwrite, setSlotToOverwrite] = useState<SaveSlot | null>(null)

  useEffect(() => {
    if (isOpen) {
      setView("main")
    }
  }, [isOpen])

  const handleSave = () => {
    const existingSlot = allSaveSlots.find(slot => slot.name === currentSession.name)
    if (existingSlot) {
      setSlotToOverwrite(existingSlot)
      setOverwriteAlertOpen(true)
    } else {
      createNewSlot()
    }
  }

  const createNewSlot = () => {
    const newSlot: SaveSlot = {
      id: `slot-${Date.now()}`,
      name: currentSession.name,
      entities: currentSession.entities,
      relationships: currentSession.relationships, // <-- CORRECTION 1 : Ajout de la propriété manquante
      monthlyData: currentSession.monthlyData,
      lastModified: Date.now()
    }
    const updatedSlots = [...allSaveSlots, newSlot]
    setAllSaveSlots(updatedSlots)
    setSlotOrder(prevOrder => [newSlot.id, ...prevOrder])
    window.api.saveSlots(updatedSlots)
    onOpenChange(false)
  }

  const performOverwrite = () => {
    if (!slotToOverwrite) return
    const updatedSlots = allSaveSlots.map(slot =>
      slot.id === slotToOverwrite.id
        ? {
            ...slot,
            name: currentSession.name,
            entities: currentSession.entities,
            relationships: currentSession.relationships, // <-- CORRECTION 2 : Ajout de la propriété manquante
            monthlyData: currentSession.monthlyData,
            lastModified: Date.now()
          }
        : slot
    )
    setAllSaveSlots(updatedSlots)
    window.api.saveSlots(updatedSlots)
    setOverwriteAlertOpen(false)
    setSlotToOverwrite(null)
    onOpenChange(false)
  }

  const handleDeleteSlot = (idToDelete: string) => {
    const updatedSlots = allSaveSlots.filter(slot => slot.id !== idToDelete)
    setAllSaveSlots(updatedSlots)
    window.api.saveSlots(updatedSlots)
    setSlotOrder(prev => prev.filter(id => id !== idToDelete))
  }

  const handleExportSlot = (slotToExport: SaveSlot) => {
    // CORRECTION 3 : L'objet exporté doit correspondre au type ExportableState
    window.api.exportState({
      entities: slotToExport.entities,
      relationships: slotToExport.relationships,
      monthlyData: slotToExport.monthlyData
    })
  }

  const handleImport = async () => {
    const result = await window.api.importState()
    if (result.data) {
      // CORRECTION 4 : L'objet de session doit correspondre au type SessionState
      setCurrentSession({
        name: "Simulation importée",
        entities: result.data.entities,
        relationships: result.data.relationships,
        monthlyData: result.data.monthlyData
      })
      onOpenChange(false)
      setView("main")
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setSlotOrder(items => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const sortedSlots = useMemo(() => {
    const slotMap = new Map(allSaveSlots.map(s => [s.id, s]))
    return slotOrder.map(id => slotMap.get(id)).filter((slot): slot is SaveSlot => slot !== undefined)
  }, [allSaveSlots, slotOrder])

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="p-0 flex flex-col" side="left">
          {/* ... Le JSX du return ne change pas ... */}
          {view === "main" && (
            <>
              <SheetHeader className="p-6 pb-4">
                <SheetTitle>Configuration</SheetTitle>
                <SheetDescription>Enregistrez la simulation actuelle ou chargez-en une autre.</SheetDescription>
              </SheetHeader>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="config-name">Nom de la simulation</Label>
                  <Input id="config-name" value={currentSession.name} onChange={e => setCurrentSession(prev => ({ ...prev, name: e.target.value }))} />
                </div>
                <Button onClick={handleSave} className="w-full" size="lg">
                  <Save className="mr-2 h-4 w-4" /> Sauvegarder
                </Button>
                <Button onClick={() => setView("load")} variant="secondary" className="w-full">
                  Charger une sauvegarde...
                </Button>
                <Button onClick={onReset} variant="destructive" className="w-full">
                  <RefreshCcw className="mr-2 h-4 w-4" /> Nouvelle Simulation / Réinitialiser
                </Button>
              </div>
            </>
          )}
          {view === "load" && (
            <>
              <SheetHeader className="p-6 pb-4 border-b flex-shrink-0">
                <Button variant="ghost" onClick={() => setView("main")} className="absolute top-4 left-4 p-2 h-auto">
                  <ChevronLeft className="mr-2 h-4 w-4" /> Retour
                </Button>
                <SheetTitle className="text-center">Charger une sauvegarde</SheetTitle>
              </SheetHeader>
              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="flex-grow overflow-y-auto p-6 space-y-3">
                  <SortableContext items={slotOrder} strategy={verticalListSortingStrategy}>
                    {sortedSlots.length > 0 ? sortedSlots.map(slot => <SaveSlotItem key={slot.id} slot={slot} onLoad={() => onLoadSlot(slot)} onDelete={() => handleDeleteSlot(slot.id)} onExport={() => handleExportSlot(slot)} />) : <p className="text-center text-slate-500 pt-8">Aucune sauvegarde trouvée.</p>}
                  </SortableContext>
                </div>
              </DndContext>
              <SheetFooter className="border-t p-6 bg-slate-50 dark:bg-slate-900">
                <Button onClick={handleImport} variant="secondary" className="w-full">
                  <Upload className="mr-2 h-4 w-4" /> Importer une simulation...
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={isOverwriteAlertOpen} onOpenChange={setOverwriteAlertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Écraser la sauvegarde existante ?</DialogTitle>
            <DialogDescription>Une sauvegarde nommée "{slotToOverwrite?.name}" existe déjà. Voulez-vous la remplacer par la version actuelle ?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button onClick={performOverwrite}>Écraser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
