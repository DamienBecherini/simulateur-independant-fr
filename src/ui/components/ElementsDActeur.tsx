// src/ui/components/ElementsDActeur.tsx
// Éléments communs à la carte d'un acteur (affichage classique) et à sa ligne (affichage « Résumé ») : poignée de tri,
// options de la micro-entreprise, pastille de relation, boutons « Modifier » et « Verrouiller ».

import type { HTMLAttributes } from "react"
import { ArrowRight, Lock, Pencil, Unlock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { Entity, MicroEntreprise, Relationship } from "@/types"
import { getRelationshipLabel } from "@/lib/graph-logic"
import { cn } from "@/lib/utils"
import { POIGNEE_DE_TRI } from "../hooks/useTriAccessible"
import { AvatarDisplay } from "./AvatarDisplay"

/** Pastille d'information sur un acteur : son type, le nombre de ses relations. */
export const PASTILLE = "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-gray-800 dark:text-slate-300"

/** Poignée de glisser-déposer d'un acteur, utilisable aussi au clavier (voir useTriAccessible). */
export function PoigneeDeTri({ nom, className, ...proprietes }: { nom: string; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...proprietes} aria-label={`Déplacer « ${nom} »`} className={cn(POIGNEE_DE_TRI, className)}>
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <path d="M5.5 4.625C5.01421 4.625 4.625 5.01421 4.625 5.5C4.625 5.98579 5.01421 6.375 5.5 6.375C5.98579 6.375 6.375 5.98579 6.375 5.5C6.375 5.01421 5.98579 4.625 5.5 4.625ZM9.5 4.625C9.01421 4.625 8.625 5.01421 8.625 5.5C8.625 5.98579 9.01421 6.375 9.5 6.375C9.98579 6.375 10.375 5.98579 10.375 5.5C10.375 5.01421 9.98579 4.625 9.5 4.625ZM6.375 9.5C6.375 9.01421 5.98579 8.625 5.5 8.625C5.01421 8.625 4.625 9.01421 4.625 9.5C4.625 9.98579 5.01421 10.375 5.5 10.375C5.98579 10.375 6.375 9.98579 6.375 9.5ZM9.5 8.625C9.01421 8.625 8.625 9.01421 8.625 9.5C8.625 9.98579 9.01421 10.375 9.5 10.375C9.98579 10.375 10.375 9.98579 10.375 9.5C10.375 9.01421 9.98579 8.625 9.5 8.625Z" fill="currentColor"></path>
      </svg>
    </div>
  )
}

interface PastilleDeRelationProps {
  relation: Relationship
  entity: Entity
  allEntities: Entity[]
  onDelete: (relationshipId: string) => void
  /** Avatar en petit format (ligne de l'affichage « Résumé »). */
  compacte?: boolean
}

/** Une relation de l'acteur, vue de son côté (« Président → Conseil SASU »), avec le bouton qui la retire. */
export function PastilleDeRelation({ relation, entity, allEntities, onDelete, compacte = false }: PastilleDeRelationProps) {
  const isSource = relation.fromId === entity.id
  const otherEntity = allEntities.find(e => e.id === (isSource ? relation.toId : relation.fromId))
  if (!otherEntity) return null
  return (
    <div className={cn("flex items-center gap-2 text-sm rounded-md bg-slate-100 dark:bg-gray-800", compacte ? "py-0.5 pl-2" : "p-1 pl-2")}>
      {!isSource && <ArrowRight className="h-3 w-3 text-slate-500 dark:text-slate-400 transform rotate-180" />}
      <span className="font-medium text-blue-600 dark:text-blue-400">{getRelationshipLabel(relation.type, isSource)}</span>
      {isSource && <ArrowRight className="h-3 w-3 text-slate-500 dark:text-slate-400" />}
      {compacte ? null : <AvatarDisplay avatar={otherEntity.avatar} />}
      <span className="font-semibold">{otherEntity.name}</span>
      <button type="button" aria-label={`Supprimer la relation avec ${otherEntity.name}`} className="print:hidden inline-flex min-h-6 min-w-6 items-center justify-center rounded text-slate-500 pointer-coarse:min-h-11 pointer-coarse:min-w-11 dark:text-slate-400 hover:bg-slate-200 hover:text-destructive dark:hover:bg-gray-700" onClick={() => onDelete(relation.id)}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/** ACRE et versement libératoire d'une micro-entreprise, à basculer sur place. */
export function OptionsDeLaMicro({ entity, onUpdate, compactes = false }: { entity: MicroEntreprise; onUpdate: (entity: Entity) => void; compactes?: boolean }) {
  const etiquette = cn("flex items-center whitespace-nowrap text-sm pointer-coarse:min-h-11 text-slate-600 dark:text-slate-400", compactes ? "gap-1.5" : "gap-2")
  return (
    <>
      <label className={etiquette} title="Aide à la création : cotisations réduites pendant les premiers trimestres, mais droits à la retraite et indemnités journalières réduits d'autant.">
        <Switch checked={entity.beneficieACRE} onCheckedChange={beneficieACRE => onUpdate({ ...entity, beneficieACRE })} />
        ACRE
        {entity.beneficieACRE && <span className="text-xs text-amber-700 dark:text-amber-400">(retraite réduite)</span>}
      </label>
      <label className={etiquette}>
        <Switch checked={entity.opteVFL} onCheckedChange={opteVFL => onUpdate({ ...entity, opteVFL })} />
        Versement libératoire
      </label>
    </>
  )
}

interface BoutonsProps {
  entity: Entity
  onEdit: (entity: Entity) => void
  onToggleLock: (id: string) => void
  /** Info-bulle du bouton « Modifier les autres réglages » : ce qu'on y trouve. */
  titre: string
}

/** Verrouille ou déverrouille l'acteur : un acteur verrouillé ne se supprime pas. */
function BoutonVerrouiller({ entity, onToggleLock }: Pick<BoutonsProps, "entity" | "onToggleLock">) {
  return (
    <Button variant="ghost" size="icon" aria-label={entity.locked ? "Déverrouiller" : "Verrouiller"} onClick={() => onToggleLock(entity.id)}>
      {entity.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
    </Button>
  )
}

/** Ouvre la fenêtre des autres réglages de l'acteur ; verrouille ou déverrouille l'acteur. */
export function BoutonsModifierVerrouiller({ entity, onEdit, onToggleLock, titre }: BoutonsProps) {
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Modifier les autres réglages" title={titre} onClick={() => onEdit(entity)}>
        <Pencil className="h-4 w-4 text-slate-600 dark:text-slate-400" />
      </Button>
      <BoutonVerrouiller entity={entity} onToggleLock={onToggleLock} />
    </>
  )
}
