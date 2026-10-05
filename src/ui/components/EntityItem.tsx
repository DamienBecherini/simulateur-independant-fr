// src/ui/components/EntityItem.tsx

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Entity, Relationship } from "@/types"
import { Lock, Unlock, Pencil } from "lucide-react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { AvatarDisplay } from "./AvatarDisplay"
import { NewRelationshipForm } from "./NewRelationshipForm"
import { useChampSurPlace, useNomSurPlace } from "../hooks/useChampSurPlace"
import { OptionsDeLaMicro, PastilleDeRelation, PoigneeDeTri } from "./ElementsDActeur"

export interface EntityItemProps {
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


export function EntityItem({ entity, allEntities, relationships, onUpdate, onDelete, onToggleLock, onEdit, onAddRelationship, onDeleteRelationship }: EntityItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: entity.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const relevantRelationships = relationships.filter(r => r.fromId === entity.id || r.toId === entity.id)

  // Saisies sur place : la session n'est écrite qu'à la validation, pour ne créer qu'une étape d'historique par modification.
  const nom = useNomSurPlace(entity, onUpdate)
  const parts = useChampSurPlace(entity.type === "person" ? entity.fiscalParts.toLocaleString("fr-FR") : "", saisie => {
    if (entity.type !== "person") return
    const fiscalParts = parseFloat(saisie.replace(",", "."))
    if (fiscalParts > 0 && fiscalParts !== entity.fiscalParts) onUpdate({ ...entity, fiscalParts })
  })

  return (
    <div ref={setNodeRef} style={style} data-impression="bloc" className="p-4 border rounded-lg flex flex-col gap-4 transition-shadow hover:shadow-lg bg-white dark:bg-gray-900 print:gap-2 print:p-3">
      <div className="flex flex-wrap justify-between items-start gap-x-4 gap-y-2">
        <div className="flex-grow flex items-center gap-4 min-w-48">
          <PoigneeDeTri nom={entity.name} {...attributes} {...listeners} className="-ml-2 self-start p-2 print:hidden" />
          <AvatarDisplay avatar={entity.avatar} />
          <div className="min-w-0 flex-grow">
            {/* Le nom se modifie sur place : le champ ne montre sa bordure qu'au survol ou au focus. */}
            <Input
              aria-label="Nom"
              className="h-8 max-w-sm border-transparent bg-transparent px-1 font-bold shadow-none hover:border-input focus-visible:border-input md:text-lg"
              {...nom}
            />
            <p className="px-1 text-sm text-slate-600 dark:text-slate-400">{entitySubtitle(entity)}</p>
          </div>
        </div>

        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {entity.type === "person" && (
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400" title="Hors enfants reliés : leurs parts s'ajoutent automatiquement.">
              Parts propres
              <Input
                className="h-8 w-16 text-right"
                inputMode="decimal"
                {...parts}
                onFocus={e => e.target.select()}
              />
            </label>
          )}
          {entity.type === "micro-entreprise" && <OptionsDeLaMicro entity={entity} onUpdate={onUpdate} />}
          <div className="flex items-center gap-1 print:hidden">
            <Button variant="ghost" size="icon" aria-label="Modifier les autres réglages" title="Statut, couleur, icône…" onClick={() => onEdit(entity)}>
              <Pencil className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </Button>
            <Button variant="ghost" size="icon" aria-label={entity.locked ? "Déverrouiller" : "Verrouiller"} onClick={() => onToggleLock(entity.id)}>
              {entity.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
            </Button>
            <Button variant="destructive" size="sm" disabled={entity.locked} onClick={() => onDelete(entity.id)}>
              Supprimer
            </Button>
          </div>
        </div>
      </div>

      <div className="sm:pl-16 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3 -mb-1">
        {relevantRelationships.map(rel => (
          <PastilleDeRelation key={rel.id} relation={rel} entity={entity} allEntities={allEntities} onDelete={onDeleteRelationship} />
        ))}
        <NewRelationshipForm entity={entity} allEntities={allEntities} relationships={relationships} onAdd={onAddRelationship} />
      </div>
    </div>
  )
}
