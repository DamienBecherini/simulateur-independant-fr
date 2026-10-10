// src/ui/components/FlowTypeSelect.tsx

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { libelleDuType, isOutgoingFlowType, type FlowType } from "@/lib/flow-constants"
import type { Entity } from "@/types"
import { ChevronDown, ChevronUp } from "lucide-react"

interface FlowTypeSelectProps {
  value: FlowType
  options: ReadonlyArray<FlowType>
  onChange: (type: FlowType) => void
  /** Acteur qui porte le flux : certains libellés en dépendent (voir libelleDuType). */
  typeActeur?: Entity["type"]
}

/**
 * Retour à la ligne d'une ligne de flux, sur téléphone seulement : le type occupe la première ligne, le libellé
 * et les montants la suivante, pour que chaque champ garde une largeur utilisable.
 */
export function RetourALaLigneSurTelephone() {
  return <div aria-hidden="true" className="basis-full sm:hidden" />
}

/**
 * Sélecteur de type de flux. Chaque option affiche une icône indiquant
 * s'il s'agit d'un gain (chevron vert) ou d'une sortie d'argent (chevron rouge).
 * Un libellé long (« Prestations artisanales ou commerciales (BIC) ») passe sur deux lignes au lieu d'être coupé :
 * tronqué, il cachait justement ce qui distingue les natures d'une micro-entreprise.
 */
export function FlowTypeSelect({ value, options, onChange, typeActeur }: FlowTypeSelectProps) {
  return (
    <Select value={value} onValueChange={type => onChange(type as FlowType)}>
      <SelectTrigger className="min-h-9 min-w-0 flex-1 whitespace-normal bg-background py-1 text-left data-[size=default]:h-auto sm:w-60 sm:flex-none *:data-[slot=select-value]:line-clamp-2" aria-label="Type de flux">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(type => (
          <SelectItem key={type} value={type}>
            <div className="flex min-w-0 items-center gap-2">
              {isOutgoingFlowType(type) ? <ChevronDown className="h-4 w-4 text-red-500 stroke-[3px] flex-shrink-0" /> : <ChevronUp className="h-4 w-4 text-green-500 stroke-[3px] flex-shrink-0" />}
              <span>{libelleDuType(type, typeActeur)}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
