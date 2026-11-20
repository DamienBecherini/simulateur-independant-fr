// src/ui/components/FlowTypeSelect.tsx

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { libelleDuType, isOutgoingFlowType, type FlowType } from "@/lib/flow-constants"
import { LIGNE_DE_FLUX, type FormeDeLigneDeFlux } from "@/lib/ligne-de-flux"
import { cn } from "@/lib/utils"
import type { Entity } from "@/types"
import { ChevronDown, ChevronUp } from "lucide-react"

interface FlowTypeSelectProps {
  value: FlowType
  options: ReadonlyArray<FlowType>
  onChange: (type: FlowType) => void
  /** Acteur qui porte le flux : certains libellés en dépendent (voir libelleDuType). */
  typeActeur?: Entity["type"]
  /** Forme de la ligne qui porte le sélecteur : elle décide de la largeur à partir de laquelle tout tient sur une ligne. */
  forme: FormeDeLigneDeFlux
}

/**
 * Retour à la ligne d'une ligne de flux, dans une fenêtre de saisie étroite seulement (téléphone, interface agrandie) :
 * le type occupe la première ligne, le libellé et les montants la suivante, pour que chaque champ garde une largeur
 * utilisable. La largeur est celle de la fenêtre de saisie (conteneur de MonthlyFlowsModal), pas celle de l'écran ;
 * le seuil dépend de la forme de la ligne (voir ligne-de-flux.ts).
 */
export function RetourALaLigneSurTelephone({ forme }: { forme: FormeDeLigneDeFlux }) {
  return <div aria-hidden="true" className={cn("basis-full", LIGNE_DE_FLUX[forme].retour)} />
}

/**
 * Sélecteur de type de flux. Chaque option affiche une icône indiquant
 * s'il s'agit d'un gain (chevron vert) ou d'une sortie d'argent (chevron rouge).
 * Un libellé long (« Prestations artisanales ou commerciales (BIC) ») passe sur deux lignes au lieu d'être coupé :
 * tronqué, il cachait justement ce qui distingue les natures d'une micro-entreprise.
 */
export function FlowTypeSelect({ value, options, onChange, typeActeur, forme }: FlowTypeSelectProps) {
  return (
    <Select value={value} onValueChange={type => onChange(type as FlowType)}>
      <SelectTrigger className={cn("min-h-9 min-w-0 flex-1 whitespace-normal bg-background py-1 text-left data-[size=default]:h-auto *:data-[slot=select-value]:line-clamp-2", LIGNE_DE_FLUX[forme].type)} aria-label="Type de flux">
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
