import { Button } from "@/components/ui/button"
import { Lock, Unlock } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface EntityItemProps {
  entity: Entity
  onDelete: (id: string) => void
  onToggleLock: (id: string) => void
  onSelect: (entity: Entity) => void
}

export function EntityItem({ entity, onDelete, onToggleLock, onSelect }: EntityItemProps) {
  // Hook de dnd-kit qui rend l'élément déplaçable
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: entity.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div ref={setNodeRef} style={style} className="p-4 border rounded-md flex justify-between items-center transition-shadow hover:shadow-md bg-white dark:bg-gray-900">
      {/* Partie principale cliquable pour l'édition */}
      <div className="flex-grow flex items-center gap-4 cursor-pointer" onClick={() => onSelect(entity)}>
        {/* Poignée pour le drag-and-drop */}
        <div {...attributes} {...listeners} className="cursor-grab touch-none p-2">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-400">
            <path d="M5.5 4.625C5.01421 4.625 4.625 5.01421 4.625 5.5C4.625 5.98579 5.01421 6.375 5.5 6.375C5.98579 6.375 6.375 5.98579 6.375 5.5C6.375 5.01421 5.98579 4.625 5.5 4.625ZM9.5 4.625C9.01421 4.625 8.625 5.01421 8.625 5.5C8.625 5.98579 9.01421 6.375 9.5 6.375C9.98579 6.375 10.375 5.98579 10.375 5.5C10.375 5.01421 9.98579 4.625 9.5 4.625ZM6.375 9.5C6.375 9.01421 5.98579 8.625 5.5 8.625C5.01421 8.625 4.625 9.01421 4.625 9.5C4.625 9.98579 5.01421 10.375 5.5 10.375C5.98579 10.375 6.375 9.98579 6.375 9.5ZM9.5 8.625C9.01421 8.625 8.625 9.01421 8.625 9.5C8.625 9.98579 9.01421 10.375 9.5 10.375C9.98579 10.375 10.375 9.98579 10.375 9.5C10.375 9.01421 9.98579 8.625 9.5 8.625Z" fill="currentColor"></path>
          </svg>
        </div>
        <div>
          <p className="font-bold">{entity.name}</p>
          <p className="text-sm text-slate-400">{entity.type === "person" ? `Personne physique - Parts: ${entity.fiscalParts}` : `Société - Statut: ${entity.legalStatus}`}</p>
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={e => {
            e.stopPropagation()
            onToggleLock(entity.id)
          }}
        >
          {entity.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-slate-500" />}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={entity.locked} // <-- Le bouton est désactivé si l'entité est verrouillée
          onClick={e => {
            e.stopPropagation()
            onDelete(entity.id)
          }}
        >
          Supprimer
        </Button>
      </div>
    </div>
  )
}
