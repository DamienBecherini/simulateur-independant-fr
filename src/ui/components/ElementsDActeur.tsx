// src/ui/components/ElementsDActeur.tsx
// Éléments communs à la carte d'un acteur (affichage classique) et à sa ligne (affichage « Résumé ») : poignée de tri,
// options de la micro-entreprise, pastille de relation, boutons « Modifier » et « Verrouiller ».

import type { HTMLAttributes } from "react"
import { ArrowRight, CircleHelp, Lock, Pencil, Unlock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import type { Entity, MicroEntreprise, Relationship } from "@/types"
import { explicationDeLACRE, explicationDuVersementLiberatoire, type ExplicationDUneOption } from "@/lib/aides-de-la-micro"
import { getRelationshipLabel } from "@/lib/graph-logic"
import { reglesDeLAnneeAffichee } from "@/lib/regles-affichees"
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

/**
 * Une relation de l'acteur, vue de son côté (« Président → Conseil SASU »), avec le bouton qui la retire. Sur un
 * téléphone étroit, ou avec une police large, la pastille passe à la ligne plutôt que de dépasser de sa carte.
 */
export function PastilleDeRelation({ relation, entity, allEntities, onDelete, compacte = false }: PastilleDeRelationProps) {
  const isSource = relation.fromId === entity.id
  const otherEntity = allEntities.find(e => e.id === (isSource ? relation.toId : relation.fromId))
  if (!otherEntity) return null
  return (
    <div className={cn("flex min-w-0 max-w-full flex-wrap items-center gap-x-2 text-sm rounded-md bg-slate-100 dark:bg-gray-800", compacte ? "py-0.5 pl-2" : "p-1 pl-2")}>
      {!isSource && <ArrowRight className="h-3 w-3 text-slate-500 dark:text-slate-400 transform rotate-180" />}
      <span className="font-medium text-blue-600 dark:text-blue-400">{getRelationshipLabel(relation.type, isSource)}</span>
      {isSource && <ArrowRight className="h-3 w-3 text-slate-500 dark:text-slate-400" />}
      {/* L'autre acteur et le bouton de retrait restent ensemble quand la pastille passe à la ligne. */}
      <span className="flex min-w-0 items-center gap-2">
        {compacte ? null : <AvatarDisplay avatar={otherEntity.avatar} />}
        <span className="min-w-0 break-words font-semibold">{otherEntity.name}</span>
        <button type="button" aria-label={`Supprimer la relation avec ${otherEntity.name}`} className="print:hidden inline-flex min-h-6 min-w-6 items-center justify-center rounded text-slate-500 pointer-coarse:min-h-11 pointer-coarse:min-w-11 dark:text-slate-400 hover:bg-slate-200 hover:text-destructive dark:hover:bg-gray-700" onClick={() => onDelete(relation.id)}>
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  )
}

/**
 * Le bouton « ? » d'une option : il ouvre une courte explication, lisible au toucher comme au clavier (une info-bulle
 * ne l'est pas), avec la page officielle de ses conditions.
 */
function BoutonDExplication({ explication, nom }: { explication: ExplicationDUneOption; nom: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 pointer-coarse:size-11 text-slate-500 dark:text-slate-400 print:hidden" aria-label={`Qu'est-ce que ${nom} ?`}>
          <CircleHelp className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">{explication.titre}</DialogTitle>
          <DialogDescription>{explication.paragraphes[0]}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          {explication.paragraphes.slice(1).map(paragraphe => (
            <p key={paragraphe}>{paragraphe}</p>
          ))}
          <p>
            <a href={explication.source.url} target="_blank" rel="noreferrer" className="text-blue-700 underline underline-offset-2 hover:no-underline dark:text-blue-300">
              {explication.source.libelle}
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** ACRE et versement libératoire d'une micro-entreprise, à basculer sur place, chacun avec son explication pour l'année affichée. */
export function OptionsDeLaMicro({ entity, onUpdate, annee, compactes = false }: { entity: MicroEntreprise; onUpdate: (entity: Entity) => void; annee: number; compactes?: boolean }) {
  const etiquette = cn("flex items-center whitespace-nowrap text-sm pointer-coarse:min-h-11 text-slate-600 dark:text-slate-400", compactes ? "gap-1.5" : "gap-2")
  const regles = reglesDeLAnneeAffichee(annee)
  return (
    <>
      <span className="flex items-center gap-0.5">
        <label className={etiquette}>
          <Switch checked={entity.beneficieACRE} onCheckedChange={beneficieACRE => onUpdate({ ...entity, beneficieACRE })} />
          ACRE
          {entity.beneficieACRE && <span className="text-xs text-amber-700 dark:text-amber-400">(retraite réduite)</span>}
        </label>
        <BoutonDExplication explication={explicationDeLACRE(regles)} nom="l'ACRE" />
      </span>
      <span className="flex items-center gap-0.5">
        <label className={etiquette}>
          <Switch checked={entity.opteVFL} onCheckedChange={opteVFL => onUpdate({ ...entity, opteVFL })} />
          Versement libératoire
        </label>
        <BoutonDExplication explication={explicationDuVersementLiberatoire(regles)} nom="le versement libératoire" />
      </span>
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
