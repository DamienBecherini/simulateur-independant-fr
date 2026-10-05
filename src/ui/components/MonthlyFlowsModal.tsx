// src/ui/components/MonthlyFlowsModal.tsx

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import type { Entity, FinancialFlow } from "@/types"
import { flowTypeLabels, getFlowTypesForEntity, type FlowType } from "@/lib/flow-constants"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { FlowItem, type FlowChanges } from "./FlowItem"
import { NewFlowItem, type NewFlowValues } from "./NewFlowItem"
import { useTriAccessible } from "../hooks/useTriAccessible"
import { LIBELLES_PORTEE, type PorteeRecurrence } from "@/lib/flux-recurrents"
import { cn } from "@/lib/utils"

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
  /** Crée le flux dans ce mois et, selon la portée choisie, le recopie sur d'autres mois. */
  onCreate: (values: NewFlowValues, portee: PorteeRecurrence) => void
  /** Recopie un flux sur les mois suivants ; absent en décembre, où il n'y a pas de mois suivant. */
  onRecopier?: (flowId: string) => void
  /** Modifie le flux et, selon la portée choisie, sa série dans les autres mois. */
  onUpdate: (flowId: string, changes: FlowChanges, portee: PorteeRecurrence) => void
  /** Supprime le flux et, selon la portée choisie, sa série dans les autres mois. */
  onDelete: (flowId: string, portee: PorteeRecurrence) => void
  onReorder: (reorderedFlows: FinancialFlow[]) => void
}

export function MonthlyFlowsModal({ onClose, flows, entity, monthName, onCreate, onRecopier, onUpdate, onDelete, onReorder }: MonthlyFlowsModalProps) {
  const flowIds = useMemo(() => flows.map(f => f.id), [flows])
  const tri = useTriAccessible(useMemo(() => flows.map(f => ({ id: f.id, nom: f.label || flowTypeLabels[f.type] })), [flows]))
  const allowedTypes = getFlowTypesForEntity(entity)

  // Type prérempli de la ligne d'ajout : le dernier type utilisé dans cette fenêtre, sinon le premier autorisé.
  const [newFlowType, setNewFlowType] = useState<FlowType>(allowedTypes[0])
  // Portée des ajouts, modifications et suppressions : gardée tant que la fenêtre est ouverte.
  const [portee, setPortee] = useState<PorteeRecurrence>("mois")

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
            <span className="text-base font-normal text-slate-600 dark:text-slate-400">/ {entity.name}</span>
          </DialogTitle>
          <DialogDescription>Modifiez les flux directement dans la liste, réorganisez-les par glisser-déposer. La dernière ligne sert à en ajouter un : Entrée sur le montant valide et enchaîne sur le suivant. Pour une charge ou un revenu qui revient chaque mois, choisissez « Appliquer à » en dessous : l'ajout, la modification ou la suppression vaut alors aussi pour les autres mois (même type et même libellé). Le bouton de recopie d'un flux le recopie jusqu'en décembre. Pour un salaire, le brut est calculé à 78 % du net si vous ne le saisissez pas ; videz-le pour ne compter aucune cotisation.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {flows.length > 0 && (
            <DndContext {...tri} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div ref={listRef} className="max-h-[50vh] space-y-2 overflow-y-auto">
                <SortableContext items={flowIds} strategy={verticalListSortingStrategy}>
                  {flows.map(flow => (
                    <FlowItem key={flow.id} flow={flow} allowedTypes={allowedTypes} onUpdate={(flowId, changes) => onUpdate(flowId, changes, portee)} onDelete={flowId => onDelete(flowId, portee)} onRecopier={onRecopier} onTypeUsed={setNewFlowType} typeActeur={entity.type} />
                  ))}
                </SortableContext>
              </div>
            </DndContext>
          )}

          <NewFlowItem type={newFlowType} allowedTypes={allowedTypes} onTypeChange={setNewFlowType} onCreate={values => onCreate(values, portee)} labelInputRef={newFlowLabelRef} typeActeur={entity.type} />
          <label className="flex flex-wrap items-center gap-2 px-1 text-sm text-slate-700 dark:text-slate-300">
            Appliquer à :
            {/* Hors « ce mois seulement », la liste est mise en évidence : modifier ou supprimer touchera aussi d'autres mois. */}
            <select className={cn("h-9 rounded-md border border-input bg-background px-2 text-sm pointer-coarse:h-11", portee !== "mois" && "border-amber-500 bg-amber-50 font-medium ring-2 ring-amber-300 dark:bg-amber-950 dark:ring-amber-700")} value={portee} onChange={e => setPortee(e.target.value as PorteeRecurrence)}>
              {(Object.keys(LIBELLES_PORTEE) as PorteeRecurrence[]).map(cle => (
                <option key={cle} value={cle}>
                  {LIBELLES_PORTEE[cle]}
                </option>
              ))}
            </select>
            {portee !== "mois" ? <span className="text-amber-900 dark:text-amber-100">Les ajouts, modifications et suppressions s'appliquent aussi aux autres mois choisis.</span> : null}
          </label>
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
