// src/ui/components/EntityItem.tsx

import { Button } from "@/components/ui/button"
import type { Entity, Relationship } from "@/types"
import { Lock, Unlock, ArrowRight } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { AvatarDisplay } from "./AvatarDisplay"

interface EntityItemProps {
  entity: Entity
  allEntities: Entity[]
  relationships: Relationship[]
  onDelete: (id: string) => void
  onToggleLock: (id: string) => void
  onSelect: (entity: Entity) => void
}

export function EntityItem({ entity, allEntities, relationships, onDelete, onToggleLock, onSelect }: EntityItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: entity.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const relevantRelationships = relationships.filter(r => r.fromId === entity.id || r.toId === entity.id)

  return (
    <div ref={setNodeRef} style={style} className="p-4 border rounded-lg flex flex-col gap-4 transition-shadow hover:shadow-lg bg-white dark:bg-gray-900">
      <div className="flex justify-between items-start">
        <div className="flex-grow flex items-center gap-4 cursor-pointer" onClick={() => onSelect(entity)}>
          <div {...attributes} {...listeners} className="cursor-grab touch-none p-2 -ml-2 self-start">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="text-slate-400">
              {/* CORRECTION : Le chemin du SVG est maintenant complet */}
              <path d="M5.5 4.625C5.01421 4.625 4.625 5.01421 4.625 5.5C4.625 5.98579 5.01421 6.375 5.5 6.375C5.98579 6.375 6.375 5.98579 6.375 5.5C6.375 5.01421 5.98579 4.625 5.5 4.625ZM9.5 4.625C9.01421 4.625 8.625 5.01421 8.625 5.5C8.625 5.98579 9.01421 6.375 9.5 6.375C9.98579 6.375 10.375 5.98579 10.375 5.5C10.375 5.01421 9.98579 4.625 9.5 4.625ZM6.375 9.5C6.375 9.01421 5.98579 8.625 5.5 8.625C5.01421 8.625 4.625 9.01421 4.625 9.5C4.625 9.98579 5.01421 10.375 5.5 10.375C5.98579 10.375 6.375 9.98579 6.375 9.5ZM9.5 8.625C9.01421 8.625 8.625 9.01421 8.625 9.5C8.625 9.98579 9.01421 10.375 9.5 10.375C9.98579 10.375 10.375 9.98579 10.375 9.5C10.375 9.01421 9.98579 8.625 9.5 8.625Z" fill="currentColor"></path>
            </svg>
          </div>
          <AvatarDisplay avatar={entity.avatar} />
          <div>
            <p className="font-bold text-lg">{entity.name}</p>
            <p className="text-sm text-slate-400">{entity.type === "person" ? `Personne physique - Parts: ${entity.fiscalParts}` : `Activité - ${"legalStatus" in entity ? (entity.legalStatus === "EI" ? "EI au réel" : entity.legalStatus) : "Micro"}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={e => (e.stopPropagation(), onToggleLock(entity.id))}>
            {entity.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-slate-500" />}
          </Button>
          <Button variant="destructive" size="sm" disabled={entity.locked} onClick={e => (e.stopPropagation(), onDelete(entity.id))}>
            Supprimer
          </Button>
        </div>
      </div>
      {relevantRelationships.length > 0 && (
        <div className="pl-16 flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 -mb-1">
          {relevantRelationships.map(rel => {
            const isSource = rel.fromId === entity.id
            const otherEntityId = isSource ? rel.toId : rel.fromId
            const otherEntity = allEntities.find(e => e.id === otherEntityId)
            if (!otherEntity) return null
            return (
              <div key={rel.id} className="flex items-center gap-2 text-sm p-1 px-2 rounded-md bg-slate-100 dark:bg-gray-800">
                {!isSource && <ArrowRight className="h-3 w-3 text-slate-400 transform rotate-180" />}
                <span className="font-medium text-blue-600 dark:text-blue-400">{rel.type}</span>
                {isSource && <ArrowRight className="h-3 w-3 text-slate-400" />}
                <AvatarDisplay avatar={otherEntity.avatar} />
                <span className="font-semibold">{otherEntity.name}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
