/**
 * @file SettingsSheet.tsx
 * @description Composant de présentation ("dumb component") pour le panneau latéral des paramètres.
 *
 * Ce composant est responsable de l'affichage de l'interface de gestion de la session et des sauvegardes.
 * Il ne contient aucune logique métier complexe. Il reçoit toutes ses données et les fonctions
 * à exécuter via ses props, ce qui le rend entièrement contrôlé par son composant parent (`App.tsx`).
 *
 * Il gère un état interne minimal, uniquement pour la navigation entre les vues ("principal" et "charger").
 * Il reçoit maintenant le contexte du slot chargé pour prendre des décisions de sauvegarde intelligentes.
 */

import { useState, Dispatch, SetStateAction, useMemo, useEffect } from "react"
import type { SessionState, SaveSlot, SanitizationReport } from "@/types"
import { texteAnneesEcartees } from "@/backend/logic/data-sanitizer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Save, Upload, Download, Trash2, ChevronLeft, RefreshCcw } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import * as SessionService from "@/lib/session-service"
import { cn } from "@/lib/utils"
import { POIGNEE_DE_TRI, useTriAccessible } from "../hooks/useTriAccessible"
import { SauvegardesGroupees } from "./SauvegardesGroupees"
import { BoutonDesMontages } from "./MontagesTypes"
import type { MontageType } from "@/lib/montages/montages"
import { ThemeToggle } from "./ThemeToggle"

/**
 * Props pour le composant SettingsSheet.
 */
interface SettingsSheetProps {
  // Gestion de l'ouverture/fermeture du panneau
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void

  // Données de session et de sauvegardes
  allSaveSlots: SaveSlot[]
  setAllSaveSlots: Dispatch<SetStateAction<SaveSlot[]>>
  currentSession: SessionState
  setCurrentSession: Dispatch<SetStateAction<SessionState>>
  slotOrder: string[]
  setSlotOrder: Dispatch<SetStateAction<string[]>>

  // Fonctions de rappel pour les actions principales
  onReset: () => void
  onLoadSlot: (slot: SaveSlot) => void
  onImport: () => Promise<void>
  /** Remplace la session par un montage type (la confirmation a déjà eu lieu si elle était nécessaire). */
  onLoadMontage: (montage: MontageType) => void

  // Props pour le flux de confirmation d'import
  importConfirmation: { session: SessionState; report: SanitizationReport } | null
  onConfirmImport: () => void
  onCancelImport: () => void

  loadedSlotId: string | null
  setLoadedSlotId: Dispatch<SetStateAction<string | null>>
}

/**
 * Sous-composant pour afficher un élément de sauvegarde dans la liste.
 * Gère sa propre logique de tri via `useSortable`.
 */
function SaveSlotItem({ slot, onDelete, onExport, onLoad }: { slot: SaveSlot; onDelete: () => void; onExport: () => void; onLoad: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: slot.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="p-4 border rounded-md flex flex-col gap-3 bg-background touch-none">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2 flex-grow min-w-0">
          <div {...attributes} {...listeners} aria-label={`Déplacer la sauvegarde « ${slot.name} »`} className={cn(POIGNEE_DE_TRI, "-ml-2 p-2")}>
            <svg width="15" viewBox="0 0 15 15" fill="none" className="flex-shrink-0" aria-hidden="true">
              <path d="M5.5 4.625C5.01421 4.625 4.625 5.01421 4.625 5.5C4.625 5.98579 5.01421 6.375 5.5 6.375C5.98579 6.375 6.375 5.98579 6.375 5.5C6.375 5.01421 5.98579 4.625 5.5 4.625ZM9.5 4.625C9.01421 4.625 8.625 5.01421 8.625 5.5C8.625 5.98579 9.01421 6.375 9.5 6.375C9.98579 6.375 10.375 5.98579 10.375 5.5C10.375 5.01421 9.98579 4.625 9.5 4.625ZM6.375 9.5C6.375 9.01421 5.98579 8.625 5.5 8.625C5.01421 8.625 4.625 9.01421 4.625 9.5C4.625 9.98579 5.01421 10.375 5.5 10.375C5.98579 10.375 6.375 9.98579 6.375 9.5ZM9.5 8.625C9.01421 8.625 8.625 9.01421 8.625 9.5C8.625 9.98579 9.01421 10.375 9.5 10.375C9.98579 10.375 10.375 9.98579 10.375 9.5C10.375 9.01421 9.98579 8.625 9.5 8.625Z" fill="currentColor"></path>
            </svg>
          </div>
          <button type="button" className="flex-grow min-w-0 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onLoad} aria-label={`Charger la sauvegarde « ${slot.name} »`}>
            <p className="font-bold truncate" title={slot.name}>
              {slot.name}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Modifié le: {new Date(slot.lastModified).toLocaleString("fr-FR")}</p>
          </button>
        </div>
        <Button variant="ghost" size="icon" onClick={onDelete} className="flex-shrink-0" aria-label={`Supprimer la sauvegarde « ${slot.name} »`}>
          <Trash2 className="h-4 w-4 text-destructive dark:text-red-400" />
        </Button>
      </div>
      <Button onClick={onExport} variant="outline" size="sm" className="self-start min-w-[200px] justify-start">
        <Download className="mr-2 h-4 w-4" /> Exporter cette sauvegarde...
      </Button>
    </div>
  )
}

/** Version de l'application qui a écrit le fichier importé, s'il l'indique. */
function VersionDuFichier({ appVersion }: { appVersion: string | undefined }) {
  if (appVersion === undefined) return null
  return <p className="mt-3 text-sm">Fichier écrit par la version {appVersion} du simulateur.</p>
}

// --- MODIFICATION : Réception des nouvelles props ---
export function SettingsSheet({ isOpen, onOpenChange, allSaveSlots, setAllSaveSlots, currentSession, setCurrentSession, onReset, onLoadSlot, slotOrder, setSlotOrder, onImport, onLoadMontage, importConfirmation, onConfirmImport, onCancelImport, loadedSlotId, setLoadedSlotId }: SettingsSheetProps) {
  const [view, setView] = useState<"main" | "load">("main")
  const [isOverwriteAlertOpen, setOverwriteAlertOpen] = useState(false)
  const [slotToOverwrite, setSlotToOverwrite] = useState<SaveSlot | null>(null)

  useEffect(() => {
    if (isOpen) {
      setView("main")
    }
  }, [isOpen])

  // --- LOGIQUE DE SAUVEGARDE ENTIÈREMENT RÉÉCRITE ---
  const handleSave = () => {
    // On récupère le slot qui est actuellement chargé en mémoire (s'il y en a un)
    const loadedSlot = loadedSlotId ? allSaveSlots.find(s => s.id === loadedSlotId) : null

    // CAS 1: MISE À JOUR (comportement "Save")
    // Si un slot est "chargé" ET que son nom n'a PAS changé.
    if (loadedSlot && loadedSlot.name === currentSession.name) {
      // C'est une simple mise à jour, on écrase directement sans poser de question.
      const updatedSlot = SessionService.updateSlotWithSession(loadedSlot, currentSession)
      const updatedSlots = allSaveSlots.map(s => (s.id === loadedSlot.id ? updatedSlot : s))
      setAllSaveSlots(updatedSlots)
      SessionService.saveAllSlots(updatedSlots)
      onOpenChange(false) // On ferme le panneau, la sauvegarde est réussie.
      return // On arrête l'exécution de la fonction ici.
    }

    // CAS 2: CRÉATION ou "SAUVEGARDER SOUS..." (comportement "Save As")
    // Ce cas se produit si aucun slot n'était chargé OU si l'utilisateur a modifié le nom de la session.
    const existingSlotByName = allSaveSlots.find(slot => slot.name === currentSession.name)

    if (existingSlotByName) {
      // Un conflit de nom existe, on demande à l'utilisateur s'il veut écraser.
      setSlotToOverwrite(existingSlotByName)
      setOverwriteAlertOpen(true)
    } else {
      // Pas de conflit, on peut créer une nouvelle sauvegarde en toute sécurité.
      const newSlot = SessionService.createNewSlotFromSession(currentSession)
      const updatedSlots = [...allSaveSlots, newSlot]
      setAllSaveSlots(updatedSlots)
      setSlotOrder(prevOrder => [newSlot.id, ...prevOrder]) // On ajoute le nouvel slot en haut de la liste
      SessionService.saveAllSlots(updatedSlots)
      // ACTION CRUCIALE: Le nouveau slot devient le "slot chargé" pour les prochaines sauvegardes.
      setLoadedSlotId(newSlot.id)
      onOpenChange(false)
    }
  }

  // --- LOGIQUE D'ÉCRASEMENT MISE À JOUR ---
  const performOverwrite = () => {
    if (!slotToOverwrite) return
    const updatedSlot = SessionService.updateSlotWithSession(slotToOverwrite, currentSession)
    const updatedSlots = allSaveSlots.map(slot => (slot.id === slotToOverwrite.id ? updatedSlot : slot))
    setAllSaveSlots(updatedSlots)
    SessionService.saveAllSlots(updatedSlots)

    // ACTION CRUCIALE: Le slot qui vient d'être écrasé devient le nouveau "slot chargé".
    // Cela garantit que la prochaine sauvegarde (sans changer de nom) mettra à jour ce même slot.
    setLoadedSlotId(updatedSlot.id)

    setOverwriteAlertOpen(false)
    setSlotToOverwrite(null)
    onOpenChange(false)
  }

  const handleDeleteSlot = (idToDelete: string) => {
    const updatedSlots = allSaveSlots.filter(slot => slot.id !== idToDelete)
    setAllSaveSlots(updatedSlots)
    SessionService.saveAllSlots(updatedSlots)
    setSlotOrder(prev => prev.filter(id => id !== idToDelete))
  }

  const handleExportSlot = (slotToExport: SaveSlot) => {
    SessionService.exportState(slotToExport)
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

  const tri = useTriAccessible(useMemo(() => allSaveSlots.map(slot => ({ id: slot.id, nom: slot.name })), [allSaveSlots]))

  const sortedSlots = useMemo(() => {
    const slotMap = new Map(allSaveSlots.map(s => [s.id, s]))
    return slotOrder.map(id => slotMap.get(id)).filter((slot): slot is SaveSlot => slot !== undefined)
  }, [allSaveSlots, slotOrder])

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent className="p-0 flex flex-col" side="left">
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
                <BoutonDesMontages variant="secondary" className="w-full" onCharger={onLoadMontage} confirmationNecessaire={SessionService.modificationsNonEnregistrees(currentSession, allSaveSlots, loadedSlotId)} nomDeLaSession={currentSession.name} />
                <Button onClick={onReset} variant="destructive" className="w-full">
                  <RefreshCcw className="mr-2 h-4 w-4" /> Nouvelle Simulation / Réinitialiser
                </Button>
                {/* Aussi dans la barre d'outils, sauf sur un écran très étroit où elle n'a pas la place. */}
                <div className="flex items-center justify-between gap-4 border-t pt-4">
                  <Label htmlFor="theme-parametres">Thème clair ou sombre</Label>
                  <ThemeToggle id="theme-parametres" />
                </div>
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
              <DndContext {...tri} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="flex-grow overflow-y-auto p-6 space-y-3">
                  <SortableContext items={slotOrder} strategy={verticalListSortingStrategy}>
                    {sortedSlots.length > 0 ? sortedSlots.map(slot => <SaveSlotItem key={slot.id} slot={slot} onLoad={() => onLoadSlot(slot)} onDelete={() => handleDeleteSlot(slot.id)} onExport={() => handleExportSlot(slot)} />) : <p className="text-center text-slate-600 dark:text-slate-400 pt-8">Aucune sauvegarde trouvée.</p>}
                  </SortableContext>
                </div>
              </DndContext>
              <SheetFooter className="border-t p-6 bg-slate-50 dark:bg-slate-900">
                <Button onClick={onImport} variant="secondary" className="w-full">
                  <Upload className="mr-2 h-4 w-4" /> Importer une simulation...
                </Button>
                <SauvegardesGroupees allSaveSlots={allSaveSlots} slotOrder={slotOrder} setAllSaveSlots={setAllSaveSlots} setSlotOrder={setSlotOrder} />
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
            <Button variant="outline" onClick={() => setOverwriteAlertOpen(false)}>
              Annuler
            </Button>
            <Button onClick={performOverwrite}>Écraser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!importConfirmation} onOpenChange={onCancelImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fichier importé avec des ajustements</DialogTitle>
            <DialogDescription asChild>
              <div>
                {importConfirmation && importConfirmation.report.entitiesRemoved + importConfirmation.report.relationshipsRemoved + importConfirmation.report.flowsRemoved + importConfirmation.report.reglagesRemoved > 0 && (
                  <>
                    <p>Des données corrompues ou obsolètes ont été retirées pour que la simulation reste utilisable.</p>
                    <div className="mt-3 font-mono text-sm bg-slate-100 dark:bg-slate-800 p-3 rounded-md">
                      <p>Entités invalides supprimées : {importConfirmation.report.entitiesRemoved}</p>
                      <p>Relations invalides ou orphelines supprimées : {importConfirmation.report.relationshipsRemoved}</p>
                      <p>Flux invalides ou orphelins supprimés : {importConfirmation.report.flowsRemoved}</p>
                      {importConfirmation.report.reglagesRemoved > 0 ? <p>Réglages du comparateur invalides écartés : {importConfirmation.report.reglagesRemoved}</p> : null}
                    </div>
                  </>
                )}
                {importConfirmation && importConfirmation.report.anneesEcartees.length > 0 && (
                  <p className="mt-3">{texteAnneesEcartees(importConfirmation.report.anneesEcartees)}. Seule la première occurrence de chaque année est gardée.</p>
                )}
                {importConfirmation && importConfirmation.report.migrationNotes.length > 0 && (
                  <>
                    <p className="mt-3">Le fichier a été converti au nouveau format du simulateur. Points à vérifier :</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {importConfirmation.report.migrationNotes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </>
                )}
                <VersionDuFichier appVersion={importConfirmation?.session.appVersion} />
                <p className="mt-4">Voulez-vous remplacer la simulation en cours par ce fichier ?</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onCancelImport}>
              Annuler
            </Button>
            <Button onClick={onConfirmImport}>Oui, continuer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
