// src/ui/components/MonthlyFlowsModal.tsx

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { PlusCircle } from "lucide-react"
import type { Entity, FinancialFlow } from "@/types"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { FlowItem } from "./FlowItem"

interface MonthlyFlowsModalProps {
  isOpen: boolean
  onClose: () => void
  flows: FinancialFlow[]
  entity: Entity | undefined
  monthName: string
  onAdd: () => void
  onEdit: (flow: FinancialFlow) => void
  onDelete: (flowId: string) => void
  onReorder: (reorderedFlows: FinancialFlow[]) => void
}

export function MonthlyFlowsModal({ isOpen, onClose, flows, entity, monthName, onAdd, onEdit, onDelete, onReorder }: MonthlyFlowsModalProps) {
  const [isAlertOpen, setAlertOpen] = useState(false)
  const [flowToDelete, setFlowToDelete] = useState<string | null>(null)

  const flowIds = useMemo(() => flows.map(f => f.id), [flows])

  const handleDeleteClick = (flowId: string) => {
    setFlowToDelete(flowId)
    setAlertOpen(true)
  }

  const confirmDelete = () => {
    if (flowToDelete) {
      onDelete(flowToDelete)
    }
    setAlertOpen(false)
    setFlowToDelete(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = flowIds.indexOf(active.id as string)
      const newIndex = flowIds.indexOf(over.id as string)
      onReorder(arrayMove(flows, oldIndex, newIndex))
    }
  }

  if (!isOpen || !entity) {
    return null
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-baseline gap-2">
              <span>Opérations de {monthName}</span>
              <span className="text-base font-normal text-slate-500">/ {entity.name}</span>
            </DialogTitle>
            <DialogDescription>Gérez, modifiez ou réorganisez les flux financiers pour ce mois.</DialogDescription>
          </DialogHeader>

          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="py-4 max-h-[60vh] overflow-y-auto pr-4 space-y-2">
              {flows.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Aucun flux pour ce mois.</p>
              ) : (
                <SortableContext items={flowIds} strategy={verticalListSortingStrategy}>
                  {flows.map(flow => (
                    <FlowItem key={flow.id} flow={flow} onEdit={onEdit} onDelete={handleDeleteClick} />
                  ))}
                </SortableContext>
              )}
            </div>
          </DndContext>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
            <Button onClick={onAdd}>
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un flux
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isAlertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible et supprimera définitivement ce flux financier.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
