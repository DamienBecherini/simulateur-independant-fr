// src/ui/components/FlowTypeSelect.tsx

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { flowTypeLabels, isOutgoingFlowType, type FlowType } from "@/lib/flow-constants"
import { ChevronDown, ChevronUp } from "lucide-react"

interface FlowTypeSelectProps {
  value: FlowType
  options: ReadonlyArray<FlowType>
  onChange: (type: FlowType) => void
}

/**
 * Sélecteur de type de flux. Chaque option affiche une icône indiquant
 * s'il s'agit d'un gain (chevron vert) ou d'une sortie d'argent (chevron rouge).
 */
export function FlowTypeSelect({ value, options, onChange }: FlowTypeSelectProps) {
  return (
    <Select value={value} onValueChange={type => onChange(type as FlowType)}>
      <SelectTrigger className="w-60 shrink-0 bg-background" aria-label="Type de flux">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(type => (
          <SelectItem key={type} value={type}>
            <div className="flex min-w-0 items-center gap-2">
              {isOutgoingFlowType(type) ? <ChevronDown className="h-4 w-4 text-red-500 stroke-[3px] flex-shrink-0" /> : <ChevronUp className="h-4 w-4 text-green-500 stroke-[3px] flex-shrink-0" />}
              <span className="truncate">{flowTypeLabels[type]}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
