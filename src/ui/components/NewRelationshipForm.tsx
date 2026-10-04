// src/ui/components/NewRelationshipForm.tsx

import { useMemo, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Entity, Relationship } from "@/types"
import { Plus, X } from "lucide-react"
import { getAvailableRelationships, getRelationshipLabel } from "@/lib/graph-logic"
import { createId } from "@/lib/id"

interface NewRelationshipFormProps {
  entity: Entity
  allEntities: Entity[]
  relationships: Relationship[]
  onAdd: (relationship: Relationship) => void
}

/**
 * Ajout d'une relation directement sur la carte d'une entité : on choisit avec qui, puis quel lien.
 * La relation est créée dès que le choix est complet ; s'il n'existe qu'un lien possible, il est retenu d'office.
 */
export function NewRelationshipForm({ entity, allEntities, relationships, onAdd }: NewRelationshipFormProps) {
  const [isOpen, setOpen] = useState(false)
  const [targetId, setTargetId] = useState<string>()

  // Seules les entités avec lesquelles un lien est encore possible sont proposées.
  const candidates = useMemo(() => allEntities.filter(other => getAvailableRelationships(entity, other, relationships).length > 0), [entity, allEntities, relationships])
  const target = candidates.find(candidate => candidate.id === targetId)
  const availableTypes = target ? getAvailableRelationships(entity, target, relationships) : []

  const close = () => {
    setOpen(false)
    setTargetId(undefined)
  }

  const add = (toId: string, type: Relationship["type"]) => {
    onAdd({ id: createId("rel"), fromId: entity.id, toId, type })
    close()
  }

  const handleTargetChange = (id: string) => {
    const other = candidates.find(candidate => candidate.id === id)
    if (!other) return
    const types = getAvailableRelationships(entity, other, relationships)
    if (types.length === 1) add(id, types[0])
    else setTargetId(id)
  }

  if (candidates.length === 0) return null

  if (!isOpen) {
    return (
      <button type="button" className="flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-sm text-slate-500 hover:border-solid hover:text-slate-800 dark:hover:text-slate-200" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Relation
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={targetId} onValueChange={handleTargetChange}>
        <SelectTrigger className="h-8 w-48" aria-label="Avec qui">
          <SelectValue placeholder="Avec…" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map(candidate => (
            <SelectItem key={candidate.id} value={candidate.id}>
              {candidate.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {target && (
        <Select onValueChange={(type: Relationship["type"]) => add(target.id, type)}>
          <SelectTrigger className="h-8 w-44" aria-label="Type de relation">
            <SelectValue placeholder="Lien…" />
          </SelectTrigger>
          <SelectContent>
            {availableTypes.map(type => (
              <SelectItem key={type} value={type}>
                {getRelationshipLabel(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <button type="button" aria-label="Annuler l'ajout de relation" className="rounded p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-gray-700" onClick={close}>
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
