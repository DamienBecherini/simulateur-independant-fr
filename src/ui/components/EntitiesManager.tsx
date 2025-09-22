// src/ui/components/EntitiesManager.tsx

import { Button } from "@/components/ui/button"
import { useState, useEffect, useMemo } from "react"
import EditEntityModal from "./EditEntityModal"
import { useDebouncedSave } from "../hooks/useDebouncedSave"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { EntityItem } from "./EntityItem"

interface EntitiesManagerProps {
  entities: Entity[]
  setEntities: React.Dispatch<React.SetStateAction<Entity[]>>
}

function EntitiesManager({ entities, setEntities }: EntitiesManagerProps) {
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)

  // --- LOGIQUE DE PERSISTANCE ---

  // Le chargement initial se fait maintenant une seule fois dans le parent
  useEffect(() => {
    const loadState = async () => {
      const savedEntities = await window.api.getState()
      setEntities(savedEntities)
    }
    loadState()
  }, [setEntities]) // On ajoute setEntities aux dépendances

  // 2. SAUVEGARDE AUTOMATIQUE OPTIMISÉE
  useDebouncedSave(entities, 1000, window.api.saveState) // Sauvegarde les 'entities' après 1 sec d'inactivité.

  // On crée une liste d'IDs pour dnd-kit, mémorisée pour la performance
  const entityIds = useMemo(() => entities.map(e => e.id), [entities])

  // --- FIN DE LA LOGIQUE DE PERSISTANCE ---

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

  // Prend en argument l'ID de l'entité à supprimer
  const deleteEntity = (idToDelete: string) => {
    // setEntities va recevoir une nouvelle liste
    // On utilise .filter() pour créer une nouvelle liste qui contient
    // toutes les entités SAUF celle dont l'id correspond à celui à supprimer.
    setEntities(prevEntities => prevEntities.filter(entity => entity.id !== idToDelete))
  }

  const toggleLock = (idToToggle: string) => {
    setEntities(prev => prev.map(entity => (entity.id === idToToggle ? { ...entity, locked: !entity.locked } : entity)))
  }

  // --- 4. AJOUTER LA FONCTION DE MISE À JOUR ---
  const handleUpdateEntity = (updatedEntity: Entity) => {
    setEntities(prevEntities =>
      // On parcourt la liste et on remplace l'ancienne version de l'entité par la nouvelle
      prevEntities.map(entity => (entity.id === updatedEntity.id ? updatedEntity : entity))
    )
    setEditingEntity(null) // On ferme la modale après avoir sauvegardé
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setEntities(items => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)
        // La fonction 'arrayMove' est maintenant correctement utilisée.
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
