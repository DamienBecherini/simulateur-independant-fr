// src/ui/components/PuceActeur.tsx

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Entity } from "@/types"
import { typeCourt } from "@/lib/reglages-des-acteurs"
import { AvatarDisplay } from "./AvatarDisplay"
import { BoutonDActeur } from "./BoutonDActeur"
import { PoigneeDeTri } from "./ElementsDActeur"

/**
 * Un acteur dans la liste courte de l'affichage « Panneaux » : avatar, nom et type. Le choisir ouvre son panneau, où
 * se trouvent ses réglages et ses résultats ; la poignée garde le tri à la souris, au doigt et au clavier.
 */
export function PuceActeur({ entity }: { entity: Entity }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: entity.id })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex max-w-full items-center rounded-lg border bg-white pl-0.5 dark:bg-gray-900">
      <PoigneeDeTri nom={entity.name} {...attributes} {...listeners} />
      <BoutonDActeur id={entity.id} className="flex min-w-0 items-center gap-2 py-1 pr-2 pl-1 text-left">
        <AvatarDisplay avatar={entity.avatar} size="sm" />
        <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{entity.name}</span>
        <span className="text-xs whitespace-nowrap text-slate-600 dark:text-slate-400">{typeCourt(entity)}</span>
      </BoutonDActeur>
    </li>
  )
}
