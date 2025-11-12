// src/ui/components/EntitiesManager.tsx

import { createPerson, createCompany, createMicroEntreprise } from "@/lib/entity-factory"
import type { Entity, SessionState, Company, MicroEntreprise } from "@/types"
import { Button } from "@/components/ui/button"
import { useState, useMemo, Dispatch, SetStateAction } from "react"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
// MODIFIÉ : On repasse à une stratégie verticale qui fonctionne mieux avec le wrapping
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { EntityItem } from "./EntityItem"
import { SelectEntityTypeModal, BusinessEntityType } from "./SelectEntityTypeModal"

interface EntitiesManagerProps {
  session: SessionState
  setCurrentSession: Dispatch<SetStateAction<SessionState>>
  onEditEntity: (entity: Entity) => void
}

function EntitiesManager({ session, setCurrentSession, onEditEntity }: EntitiesManagerProps) {
  const [isSelectModalOpen, setSelectModalOpen] = useState(false)
  const entityIds = useMemo(() => session.entities.map(e => e.id), [session.entities])

  const setEntities = (updater: SetStateAction<Entity[]>) => {
    setCurrentSession(prev => ({
      ...prev,
      entities: typeof updater === "function" ? updater(prev.entities) : updater
    }))
  }

  const setRelationships = (updater: SetStateAction<SessionState["relationships"]>) => {
    setCurrentSession(prev => ({
      ...prev,
      relationships: typeof updater === "function" ? updater(prev.relationships) : updater
    }))
  }

  const addPerson = () => {
    const newPerson = createPerson()
    setEntities(prevEntities => [...prevEntities, newPerson])
  }

  const handleAddBusiness = (type: BusinessEntityType) => {
    let newEntity: Company | MicroEntreprise
    switch (type) {
      case "MicroEntreprise":
        newEntity = createMicroEntreprise()
        break
      case "SASU":
        newEntity = createCompany("SASU")
        break
      case "EURL":
        newEntity = createCompany("EURL")
        break
    }
    setEntities(prevEntities => [...prevEntities, newEntity])
  }

  const deleteEntity = (idToDelete: string) => {
    setEntities(prev => prev.filter(e => e.id !== idToDelete))
    setRelationships(prev => prev.filter(rel => rel.fromId !== idToDelete && rel.toId !== idToDelete))
  }

  const toggleLock = (idToToggle: string) => {
    setEntities(prevEntities => prevEntities.map(entity => (entity.id === idToToggle ? { ...entity, locked: !entity.locked } : entity)))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setEntities(items => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  return (
    <div className="p-6 bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4">Acteurs de la Simulation</h2>
      <div className="flex gap-4 mb-6">
        <Button onClick={addPerson}>+ Ajouter une Personne</Button>
        <Button onClick={() => setSelectModalOpen(true)} variant="secondary">
          + Ajouter une Activité
        </Button>
      </div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={entityIds} strategy={verticalListSortingStrategy}>
          {/* MODIFIÉ : On remplace 'overflow-x-auto' par 'flex-wrap' pour le retour à la ligne */}
          <div className="flex gap-4 flex-wrap">{session.entities.length === 0 ? <p className="text-slate-500">Aucune entité. Commencez par en ajouter une !</p> : session.entities.map(entity => <EntityItem key={entity.id} entity={entity} allEntities={session.entities} relationships={session.relationships} onDelete={deleteEntity} onToggleLock={toggleLock} onSelect={onEditEntity} />)}</div>
        </SortableContext>
      </DndContext>

      <SelectEntityTypeModal isOpen={isSelectModalOpen} onClose={() => setSelectModalOpen(false)} onSelect={handleAddBusiness} />
    </div>
  )
}

export default EntitiesManager
