// src/ui/components/EntitiesManager.tsx

import { createPerson, createCompany, createMicroEntreprise } from "@/lib/entity-factory"
import type { Entity, Relationship, Company, MicroEntreprise, SessionState } from "@/types"
import { Button } from "@/components/ui/button"
import { useState, useMemo } from "react"
import EditEntityModal from "./EditEntityModal"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { EntityItem } from "./EntityItem"
import { SelectEntityTypeModal, BusinessEntityType } from "./SelectEntityTypeModal"
import { sanitizeFlowsAfterRelationshipChange } from "@/lib/business-logic"
import { nombreDeFlux, transformerLesGrilles } from "@/backend/logic/annees"
import { toast } from "sonner"
import { useTriAccessible } from "../hooks/useTriAccessible"

interface EntitiesManagerProps {
  session: SessionState
  setSession: (session: SessionState) => void
}


function EntitiesManager({ session, setSession }: EntitiesManagerProps) {
  const { entities, relationships } = session
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)
  const [isSelectModalOpen, setSelectModalOpen] = useState(false)
  const entityIds = useMemo(() => entities.map(e => e.id), [entities])
  const tri = useTriAccessible(useMemo(() => entities.map(e => ({ id: e.id, nom: e.name })), [entities]))

  /**
   * Applique une modification des entités ou des relations en une seule étape d'historique.
   * Quand les relations changent, les flux qui n'ont plus de bénéficiaire (rémunération sans dirigeant,
   * dividendes sans associé) sont retirés de toutes les années, et l'utilisateur en est averti.
   */
  const applyChange = (changes: Partial<Pick<SessionState, "entities" | "relationships" | "annees">>) => {
    const next = { ...session, ...changes }
    const nettoyee = changes.relationships ? transformerLesGrilles(next, monthlyData => sanitizeFlowsAfterRelationshipChange({ relationships: next.relationships, monthlyData })) : next
    const removedFlows = nombreDeFlux(next.annees) - nombreDeFlux(nettoyee.annees)
    if (removedFlows > 0) {
      toast.info(`${removedFlows} flux ${removedFlows > 1 ? "supprimés" : "supprimé"} : ${removedFlows > 1 ? "ils n'avaient" : "il n'avait"} plus de bénéficiaire. Ctrl+Z pour annuler.`)
    }
    setSession(nettoyee)
  }

  const addEntity = (entity: Entity) => applyChange({ entities: [...entities, entity] })

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
    addEntity(newEntity)
  }

  const deleteEntity = (idToDelete: string) => {
    applyChange({
      entities: entities.filter(e => e.id !== idToDelete),
      relationships: relationships.filter(rel => rel.fromId !== idToDelete && rel.toId !== idToDelete),
      // Ses flux disparaissent de toutes les années.
      annees: transformerLesGrilles(session, grille => grille.map(month => ({ ...month, flows: month.flows.filter(flow => flow.entityId !== idToDelete) }))).annees
    })
  }

  const updateEntity = (updatedEntity: Entity) => {
    applyChange({ entities: entities.map(entity => (entity.id === updatedEntity.id ? updatedEntity : entity)) })
  }

  const toggleLock = (idToToggle: string) => {
    applyChange({ entities: entities.map(entity => (entity.id === idToToggle ? { ...entity, locked: !entity.locked } : entity)) })
  }

  const addRelationship = (relationship: Relationship) => applyChange({ relationships: [...relationships, relationship] })

  const deleteRelationship = (relationshipId: string) => applyChange({ relationships: relationships.filter(rel => rel.id !== relationshipId) })

  const handleSaveFromModal = (updatedEntity: Entity, updatedRelationships: Relationship[]) => {
    applyChange({
      entities: entities.map(entity => (entity.id === updatedEntity.id ? updatedEntity : entity)),
      relationships: updatedRelationships
    })
    setEditingEntity(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = entities.findIndex(item => item.id === active.id)
      const newIndex = entities.findIndex(item => item.id === over.id)
      applyChange({ entities: arrayMove(entities, oldIndex, newIndex) })
    }
  }

  return (
    <div className="p-6 bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4">Acteurs de la Simulation</h2>
      <div className="flex flex-wrap gap-4 mb-6 print:hidden">
        <Button onClick={() => addEntity(createPerson())}>+ Ajouter une Personne</Button>
        <Button onClick={() => setSelectModalOpen(true)} variant="secondary">
          + Ajouter une Activité
        </Button>
      </div>
      <DndContext {...tri} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={entityIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {entities.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-400">Aucune entité. Commencez par en ajouter une !</p>
            ) : (
              entities.map(entity => <EntityItem key={entity.id} entity={entity} allEntities={entities} relationships={relationships} onUpdate={updateEntity} onDelete={deleteEntity} onToggleLock={toggleLock} onEdit={setEditingEntity} onAddRelationship={addRelationship} onDeleteRelationship={deleteRelationship} />)
            )}
          </div>
        </SortableContext>
      </DndContext>

      <EditEntityModal isOpen={!!editingEntity} entity={editingEntity} onClose={() => setEditingEntity(null)} onSave={handleSaveFromModal} allEntities={entities} relationships={relationships} />

      <SelectEntityTypeModal isOpen={isSelectModalOpen} onClose={() => setSelectModalOpen(false)} onSelect={handleAddBusiness} />
    </div>
  )
}

export default EntitiesManager
