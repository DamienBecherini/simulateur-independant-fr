// src/ui/components/MonthlyFlowsModal.tsx

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import type { Entity, FinancialFlow } from "@/types"
import { getFlowTypesForEntity, type FlowType } from "@/lib/flow-constants"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { FlowItem, type FlowChanges } from "./FlowItem"
import { NewFlowItem, type NewFlowValues } from "./NewFlowItem"

/**
 * Interface pour les props du composant MonthlyFlowsModal.
 * Cette fenêtre liste les flux d'une entité pour un mois : chaque ligne s'édite sur place
 * et une dernière ligne vide permet d'en ajouter. Elle est montée à l'ouverture et démontée
 * à la fermeture, son état local repart donc de zéro à chaque ouverture.
 */
interface MonthlyFlowsModalProps {
  onClose: () => void
  flows: FinancialFlow[]
  entity: Entity
  monthName: string
  onCreate: (values: NewFlowValues) => void
  onUpdate: (flowId: string, changes: FlowChanges) => void
  onDelete: (flowId: string) => void
  onReorder: (reorderedFlows: FinancialFlow[]) => void
}

export function MonthlyFlowsModal({ onClose, flows, entity, monthName, onCreate, onUpdate, onDelete, onReorder }: MonthlyFlowsModalProps) {
  const flowIds = useMemo(() => flows.map(f => f.id), [flows])
  const allowedTypes = getFlowTypesForEntity(entity)

  // Type prérempli de la ligne d'ajout : le dernier type utilisé dans cette fenêtre, sinon le premier autorisé.
  const [newFlowType, setNewFlowType] = useState<FlowType>(allowedTypes[0])

  const listRef = useRef<HTMLDivElement>(null)
  const newFlowLabelRef = useRef<HTMLInputElement>(null)

  // Quand un flux est ajouté, la liste défile pour le montrer.
  const previousFlowCount = useRef(flows.length)
  useEffect(() => {
    if (flows.length > previousFlowCount.current) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
    }
    previousFlowCount.current = flows.length
  }, [flows.length])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = flowIds.indexOf(active.id as string)
      const newIndex = flowIds.indexOf(over.id as string)
      onReorder(arrayMove(flows, oldIndex, newIndex))
    }
  }

  const handleClose = () => {
    // Retirer le focus valide la saisie en cours avant que la fenêtre ne soit démontée.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    onClose()
  }

  return (
    <Dialog open onOpenChange={open => !open && handleClose()}>
      <DialogContent
        className="sm:max-w-4xl"
        // À l'ouverture, le focus va sur la ligne d'ajout pour saisir sans clic supplémentaire.
        onOpenAutoFocus={event => {
          event.preventDefault()
          newFlowLabelRef.current?.focus()
        }}
        // Échap annule d'abord la saisie en cours du champ ; la fenêtre ne se ferme que s'il n'y en a pas.
        onEscapeKeyDown={event => {
          if (event.target instanceof HTMLElement && event.target.dataset.editing === "true") event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-baseline gap-2">
            <span>Opérations de {monthName}</span>
            <span className="text-base font-normal text-slate-500">/ {entity.name}</span>
          </DialogTitle>
          <DialogDescription>Modifiez les flux directement dans la liste, réorganisez-les par glisser-déposer. La dernière ligne sert à en ajouter un : Entrée sur le montant valide et enchaîne sur le suivant. Pour un salaire, le brut est calculé à 78 % du net si vous ne le saisissez pas ; videz-le pour ne compter aucune cotisation.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {flows.length > 0 && (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div ref={listRef} className="max-h-[50vh] space-y-2 overflow-y-auto">
                <SortableContext items={flowIds} strategy={verticalListSortingStrategy}>
                  {flows.map(flow => (
                    <FlowItem key={flow.id} flow={flow} allowedTypes={allowedTypes} onUpdate={onUpdate} onDelete={onDelete} onTypeUsed={setNewFlowType} />
                  ))}
                </SortableContext>
              </div>
            </DndContext>
          )}

          <NewFlowItem type={newFlowType} allowedTypes={allowedTypes} onTypeChange={setNewFlowType} onCreate={onCreate} labelInputRef={newFlowLabelRef} />
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={handleClose}>
            Terminé
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
