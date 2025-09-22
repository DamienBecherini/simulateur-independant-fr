// src/ui/components/EntitiesManager.tsx

import { Button } from "@/components/ui/button"
import { useState, useMemo, Dispatch, SetStateAction } from "react"
import EditEntityModal from "./EditEntityModal"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { EntityItem } from "./EntityItem"

// La signature de la prop a été mise à jour pour accepter la signature complète de React
// pour une fonction de mise à jour d'état.
interface EntitiesManagerProps {
  entities: Entity[]
  setEntities: Dispatch<SetStateAction<Entity[]>>
}

function EntitiesManager({ entities, setEntities }: EntitiesManagerProps) {
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)

  const entityIds = useMemo(() => entities.map(e => e.id), [entities])

  const addPerson = () => {
    const newPerson: Person = {
      id: `person-${Date.now()}`,
      type: "person",
      name: "Nouvelle Personne",
      fiscalParts: 1,
      locked: false
    }
    setEntities(prevEntities => [...prevEntities, newPerson])
  }

  const addCompany = () => {
    const newCompany: Company = {
      id: `company-${Date.now()}`,
      type: "company",
      name: "Nouvelle Société",
      legalStatus: "SASU",
      locked: false
    }
    setEntities(prevEntities => [...prevEntities, newCompany])
  }

  const deleteEntity = (idToDelete: string) => {
    setEntities(prevEntities => prevEntities.filter(entity => entity.id !== idToDelete))
  }

  const toggleLock = (idToToggle: string) => {
    setEntities(prevEntities => prevEntities.map(entity => (entity.id === idToToggle ? { ...entity, locked: !entity.locked } : entity)))
  }

  const handleUpdateEntity = (updatedEntity: Entity) => {
    setEntities(prevEntities => prevEntities.map(entity => (entity.id === updatedEntity.id ? updatedEntity : entity)))
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
      <h2 className="text-2xl font-semibold mb-4">Gestion des Entités</h2>

      <div className="flex gap-4 mb-6">
        <Button onClick={addPerson}>+ Ajouter une Personne</Button>
        <Button onClick={addCompany} variant="secondary">
          + Ajouter une Société
        </Button>
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={entityIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">{entities.length === 0 ? <p className="text-slate-500">Aucune entité. Commencez par en ajouter une !</p> : entities.map(entity => <EntityItem key={entity.id} entity={entity} onDelete={deleteEntity} onToggleLock={toggleLock} onSelect={setEditingEntity} />)}</div>
        </SortableContext>
      </DndContext>

      <EditEntityModal isOpen={!!editingEntity} entity={editingEntity} onClose={() => setEditingEntity(null)} onSave={handleUpdateEntity} />
    </div>
  )
}

export default EntitiesManager
