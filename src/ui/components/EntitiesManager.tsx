// src/ui/components/EntitiesManager.tsx

import { createPerson, createCompany, createMicroEntreprise } from "@/lib/entity-factory"
import type { Entity, Relationship, Company, MicroEntreprise, SessionState } from "@/types"
import { Button } from "@/components/ui/button"
import { useState, useMemo, Dispatch, SetStateAction } from "react"
import EditEntityModal from "./EditEntityModal"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { EntityItem } from "./EntityItem"
import { SelectEntityTypeModal, BusinessEntityType } from "./SelectEntityTypeModal"
import { sanitizeFlowsAfterRelationshipChange } from "@/lib/business-logic"

interface EntitiesManagerProps {
  sessionName: string // <-- 1. Nouvelle prop ajoutée ici
  entities: Entity[]
  setEntities: Dispatch<SetStateAction<Entity[]>>
  relationships: Relationship[]
  setRelationships: Dispatch<SetStateAction<Relationship[]>>
  monthlyData: SessionState["monthlyData"]
  setMonthlyData: Dispatch<SetStateAction<SessionState["monthlyData"]>>
}

function EntitiesManager({ sessionName, entities, setEntities, relationships, setRelationships, monthlyData, setMonthlyData }: EntitiesManagerProps) {
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)
  const [isSelectModalOpen, setSelectModalOpen] = useState(false)
  const entityIds = useMemo(() => entities.map(e => e.id), [entities])

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
      case "EI":
      case "SASU":
      case "EURL":
        newEntity = createCompany(type)
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

  const handleUpdateEntity = (updatedEntity: Entity, updatedRelationships: Relationship[]) => {
    setEntities(prevEntities => prevEntities.map(entity => (entity.id === updatedEntity.id ? updatedEntity : entity)))
    setRelationships(updatedRelationships)

    // 2. Construire un état de session temporaire complet
    const nextSessionState: SessionState = {
      name: sessionName, // <-- 3. On utilise la nouvelle prop ici
      entities: entities.map(entity => (entity.id === updatedEntity.id ? updatedEntity : entity)),
      relationships: updatedRelationships,
      monthlyData
    }

    const sanitizedMonthlyData = sanitizeFlowsAfterRelationshipChange(nextSessionState)

    setMonthlyData(sanitizedMonthlyData)

    setEditingEntity(null)
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
          <div className="space-y-4">{entities.length === 0 ? <p className="text-slate-500">Aucune entité. Commencez par en ajouter une !</p> : entities.map(entity => <EntityItem key={entity.id} entity={entity} allEntities={entities} relationships={relationships} onDelete={deleteEntity} onToggleLock={toggleLock} onSelect={setEditingEntity} />)}</div>
        </SortableContext>
      </DndContext>

      <EditEntityModal isOpen={!!editingEntity} entity={editingEntity} onClose={() => setEditingEntity(null)} onSave={handleUpdateEntity} allEntities={entities} relationships={relationships} />

      <SelectEntityTypeModal isOpen={isSelectModalOpen} onClose={() => setSelectModalOpen(false)} onSelect={handleAddBusiness} />
    </div>
  )
}

export default EntitiesManager
