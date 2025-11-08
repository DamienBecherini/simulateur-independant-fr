// src/ui/components/CellChartDisplay.tsx

import { cn } from "@/lib/utils"
import { ArrowUp, ArrowDown } from "lucide-react"

export interface FlowSegment {
  amount: number
  color: string
}

interface CellChartDisplayProps {
  gains: FlowSegment[]
  expenses: FlowSegment[]
  totalGains: number
  totalExpenses: number
  absoluteMaxValue: number // L'échelle de référence pour la hauteur
  flowCount: number
}

const MIN_HEIGHT_PX = 2 // Hauteur minimale pour qu'une barre soit visible

export function CellChartDisplay({ gains, expenses, totalGains, totalExpenses, absoluteMaxValue, flowCount }: CellChartDisplayProps) {
  if (flowCount === 0) {
    return <div className="text-slate-400 group-hover:text-slate-600 transition-colors py-3">+ Ajouter</div>
  }

  const renderBar = (segments: FlowSegment[]) => {
    if (absoluteMaxValue === 0 || segments.length === 0) {
      return null
    }

    return (
      <div className="h-12 w-full flex items-end gap-px">
        {segments.map((segment, index) => {
          const percentage = (segment.amount / absoluteMaxValue) * 100
          const height = `max(calc(${percentage}%), ${MIN_HEIGHT_PX}px)`

          return (
            <div
              key={index}
              className="w-4 rounded-t-[2px]"
              style={{
                height: height,
                backgroundColor: segment.color
              }}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="flex items-end gap-1 h-12">
        <div className="min-w-[68px]">{renderBar(gains)}</div>
        <div className="min-w-[68px]">{renderBar(expenses)}</div>
      </div>
      <div className="flex justify-between items-center text-xs font-mono mt-1">
        <div className={cn("flex items-center gap-1 p-1 rounded", totalGains > 0 ? "text-green-700 dark:text-green-400 bg-green-500/10" : "text-slate-500")}>
          <ArrowUp size={12} /> {totalGains.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
        </div>
        <div className={cn("flex items-center gap-1 p-1 rounded", totalExpenses > 0 ? "text-red-700 dark:text-red-400 bg-red-500/10" : "text-slate-500")}>
          <ArrowDown size={12} /> {totalExpenses.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
        </div>
      </div>
    </div>
  )
}
