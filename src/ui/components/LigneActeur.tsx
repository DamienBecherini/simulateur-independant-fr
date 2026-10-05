// src/ui/components/LigneActeur.tsx

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Lock, Pencil, Trash2, Unlock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Entity } from "@/types"
import { useNomSurPlace } from "../hooks/useChampSurPlace"
import { AvatarDisplay } from "./AvatarDisplay"
import { OptionsDeLaMicro, PastilleDeRelation, PoigneeDeTri } from "./ElementsDActeur"
import type { EntityItemProps } from "./EntityItem"
import { NewRelationshipForm } from "./NewRelationshipForm"
import { cn } from "@/lib/utils"

/** Type de l'acteur en une pastille : « Personne · 1 part », « Micro-entreprise », « SASU ». */
function typeCourt(entity: Entity): string {
  if (entity.type === "person") return `Personne · ${entity.fiscalParts.toLocaleString("fr-FR")} ${entity.fiscalParts > 1 ? "parts" : "part"}`
  if (entity.type === "micro-entreprise") return "Micro-entreprise"
  return entity.legalStatus === "EI" ? "EI au réel" : entity.legalStatus
}

const PASTILLE = "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-gray-800 dark:text-slate-300"

/**
 * Un acteur sur une ligne (affichage « Résumé ») : nom modifiable sur place, type et relations en pastilles, options de
 * la micro-entreprise. Les parts et les autres réglages se modifient dans la fenêtre « Modifier ».
 */
export function LigneActeur({ entity, allEntities, relationships, onUpdate, onDelete, onToggleLock, onEdit, onAddRelationship, onDeleteRelationship }: EntityItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: entity.id })
  const nom = useNomSurPlace(entity, onUpdate)
  const relations = relationships.filter(r => r.fromId === entity.id || r.toId === entity.id)

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} data-impression="bloc" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-white px-2 py-1.5 dark:bg-gray-900">
      <PoigneeDeTri nom={entity.name} {...attributes} {...listeners} className="print:hidden" />
      <AvatarDisplay avatar={entity.avatar} size="sm" />
      <Input aria-label="Nom" className="h-8 w-40 border-transparent bg-transparent px-1 font-semibold shadow-none hover:border-input focus-visible:border-input sm:w-48" {...nom} />
      <span className={PASTILLE}>{typeCourt(entity)}</span>
      {entity.type === "micro-entreprise" ? <OptionsDeLaMicro entity={entity} onUpdate={onUpdate} compactes /> : null}
      {/* Sur téléphone, le nombre de relations seulement : elles se modifient dans la fenêtre « Modifier ». */}
      {relations.length > 0 ? <span className={cn(PASTILLE, "sm:hidden")}>{relations.length > 1 ? `${relations.length} relations` : "1 relation"}</span> : null}
      <div className="contents max-sm:hidden">
        {relations.map(relation => (
          <PastilleDeRelation key={relation.id} relation={relation} entity={entity} allEntities={allEntities} onDelete={onDeleteRelationship} compacte />
        ))}
        <NewRelationshipForm entity={entity} allEntities={allEntities} relationships={relationships} onAdd={onAddRelationship} />
      </div>
      <div className="ml-auto flex items-center print:hidden">
        <Button variant="ghost" size="icon" aria-label="Modifier les autres réglages" title="Parts, statut, couleur, icône…" onClick={() => onEdit(entity)}>
          <Pencil className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        </Button>
        <Button variant="ghost" size="icon" aria-label={entity.locked ? "Déverrouiller" : "Verrouiller"} onClick={() => onToggleLock(entity.id)}>
          {entity.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
        </Button>
        <Button variant="ghost" size="icon" aria-label={`Supprimer « ${entity.name} »`} title="Supprimer" disabled={entity.locked} className="text-rose-700 hover:text-rose-800 dark:text-rose-400" onClick={() => onDelete(entity.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
