// src/ui/components/EntityItem.tsx

import { useState, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { Entity, Relationship } from "@/types"
import { Lock, Unlock, ArrowRight, Pencil, X } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { AvatarDisplay } from "./AvatarDisplay"
import { NewRelationshipForm } from "./NewRelationshipForm"
import { getRelationshipLabel } from "@/lib/graph-logic"
import { updatePersonAvatar } from "@/lib/avatar-utils"

interface EntityItemProps {
  entity: Entity
  allEntities: Entity[]
  relationships: Relationship[]
  onUpdate: (entity: Entity) => void
  onDelete: (id: string) => void
  onToggleLock: (id: string) => void
  /** Ouvre la fenêtre des réglages moins fréquents (statut, couleur, icône, capital social). */
  onEdit: (entity: Entity) => void
  onAddRelationship: (relationship: Relationship) => void
  onDeleteRelationship: (relationshipId: string) => void
}

function entitySubtitle(entity: Entity): string {
  if (entity.type === "person") return "Personne physique"
  if (entity.type === "micro-entreprise") return "Activité - Micro-entreprise"
  return `Activité - ${entity.legalStatus === "EI" ? "EI au réel" : entity.legalStatus}`
}

/** Entrée valide la saisie en cours en quittant le champ, Échap l'annule. */
function handleFieldKeyDown(cancel: () => void) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur()
    } else if (event.key === "Escape") {
      cancel()
      event.currentTarget.blur()
    }
  }
}

export function EntityItem({ entity, allEntities, relationships, onUpdate, onDelete, onToggleLock, onEdit, onAddRelationship, onDeleteRelationship }: EntityItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: entity.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const relevantRelationships = relationships.filter(r => r.fromId === entity.id || r.toId === entity.id)

  // Saisies en cours : `null` tant que le champ n'est pas modifié. La session n'est écrite qu'à la validation,
  // pour ne créer qu'une étape d'historique par modification.
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [partsDraft, setPartsDraft] = useState<string | null>(null)

  const commitName = () => {
    if (nameDraft === null) return
    setNameDraft(null)
    const name = nameDraft.trim()
    if (!name || name === entity.name) return
    // Les initiales de l'avatar d'une personne suivent son nom.
    onUpdate(entity.type === "person" ? { ...entity, name, avatar: updatePersonAvatar(entity.avatar, name) } : { ...entity, name })
  }

  const commitParts = () => {
    if (partsDraft === null || entity.type !== "person") return
    setPartsDraft(null)
    const fiscalParts = parseFloat(partsDraft.replace(",", "."))
    if (fiscalParts > 0 && fiscalParts !== entity.fiscalParts) onUpdate({ ...entity, fiscalParts })
  }

  return (
    <div ref={setNodeRef} style={style} className="p-4 border rounded-lg flex flex-col gap-4 transition-shadow hover:shadow-lg bg-white dark:bg-gray-900">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-grow flex items-center gap-4 min-w-0">
          <div {...attributes} {...listeners} className="cursor-grab touch-none p-2 -ml-2 self-start">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="text-slate-400">
              <path d="M5.5 4.625C5.01421 4.625 4.625 5.01421 4.625 5.5C4.625 5.98579 5.01421 6.375 5.5 6.375C5.98579 6.375 6.375 5.98579 6.375 5.5C6.375 5.01421 5.98579 4.625 5.5 4.625ZM9.5 4.625C9.01421 4.625 8.625 5.01421 8.625 5.5C8.625 5.98579 9.01421 6.375 9.5 6.375C9.98579 6.375 10.375 5.98579 10.375 5.5C10.375 5.01421 9.98579 4.625 9.5 4.625ZM6.375 9.5C6.375 9.01421 5.98579 8.625 5.5 8.625C5.01421 8.625 4.625 9.01421 4.625 9.5C4.625 9.98579 5.01421 10.375 5.5 10.375C5.98579 10.375 6.375 9.98579 6.375 9.5ZM9.5 8.625C9.01421 8.625 8.625 9.01421 8.625 9.5C8.625 9.98579 9.01421 10.375 9.5 10.375C9.98579 10.375 10.375 9.98579 10.375 9.5C10.375 9.01421 9.98579 8.625 9.5 8.625Z" fill="currentColor"></path>
            </svg>
          </div>
          <AvatarDisplay avatar={entity.avatar} />
          <div className="min-w-0 flex-grow">
            {/* Le nom se modifie sur place : le champ ne montre sa bordure qu'au survol ou au focus. */}
            <Input
              aria-label="Nom"
              className="h-8 max-w-sm border-transparent bg-transparent px-1 font-bold shadow-none hover:border-input focus-visible:border-input md:text-lg"
              value={nameDraft ?? entity.name}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={handleFieldKeyDown(() => setNameDraft(null))}
            />
            <p className="px-1 text-sm text-slate-400">{entitySubtitle(entity)}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {entity.type === "person" && (
            <label className="flex items-center gap-2 text-sm text-slate-500" title="Hors enfants reliés : leurs parts s'ajoutent automatiquement.">
              Parts propres
              <Input
                className="h-8 w-16 text-right"
                inputMode="decimal"
                value={partsDraft ?? entity.fiscalParts.toLocaleString("fr-FR")}
                onFocus={e => e.target.select()}
                onChange={e => setPartsDraft(e.target.value)}
                onBlur={commitParts}
                onKeyDown={handleFieldKeyDown(() => setPartsDraft(null))}
              />
            </label>
          )}
          {entity.type === "micro-entreprise" && (
            <>
              <label className="flex items-center gap-2 text-sm text-slate-500">
                <Switch checked={entity.beneficieACRE} onCheckedChange={beneficieACRE => onUpdate({ ...entity, beneficieACRE })} />
                ACRE
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-500">
                <Switch checked={entity.opteVFL} onCheckedChange={opteVFL => onUpdate({ ...entity, opteVFL })} />
                Versement libératoire
              </label>
            </>
          )}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Modifier les autres réglages" title="Statut, couleur, icône…" onClick={() => onEdit(entity)}>
              <Pencil className="h-4 w-4 text-slate-500" />
            </Button>
            <Button variant="ghost" size="icon" aria-label={entity.locked ? "Déverrouiller" : "Verrouiller"} onClick={() => onToggleLock(entity.id)}>
              {entity.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-slate-500" />}
            </Button>
            <Button variant="destructive" size="sm" disabled={entity.locked} onClick={() => onDelete(entity.id)}>
              Supprimer
            </Button>
          </div>
        </div>
      </div>

      <div className="pl-16 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3 -mb-1">
        {relevantRelationships.map(rel => {
          const isSource = rel.fromId === entity.id
          const otherEntityId = isSource ? rel.toId : rel.fromId
          const otherEntity = allEntities.find(e => e.id === otherEntityId)
          if (!otherEntity) return null
          return (
            <div key={rel.id} className="flex items-center gap-2 text-sm p-1 pl-2 rounded-md bg-slate-100 dark:bg-gray-800">
              {!isSource && <ArrowRight className="h-3 w-3 text-slate-400 transform rotate-180" />}
              <span className="font-medium text-blue-600 dark:text-blue-400">{getRelationshipLabel(rel.type, isSource)}</span>
              {isSource && <ArrowRight className="h-3 w-3 text-slate-400" />}
              <AvatarDisplay avatar={otherEntity.avatar} />
              <span className="font-semibold">{otherEntity.name}</span>
              <button type="button" aria-label={`Supprimer la relation avec ${otherEntity.name}`} className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-destructive dark:hover:bg-gray-700" onClick={() => onDeleteRelationship(rel.id)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
        <NewRelationshipForm entity={entity} allEntities={allEntities} relationships={relationships} onAdd={onAddRelationship} />
      </div>
    </div>
  )
}
