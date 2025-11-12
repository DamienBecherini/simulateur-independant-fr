// src/ui/components/CellChartDisplay.tsx

import { cn } from "@/lib/utils"
import { ArrowUp, ArrowDown } from "lucide-react"

export interface FlowSegment {
  amount: number
  color: string
  number: number
}

interface CellChartDisplayProps {
  gains: FlowSegment[]
  expenses: FlowSegment[]
  totalGains: number
  totalExpenses: number
  absoluteMaxValue: number
  flowCount: number
}

const MIN_HEIGHT_PX = 2

export function CellChartDisplay({ gains, expenses, totalGains, totalExpenses, absoluteMaxValue, flowCount }: CellChartDisplayProps) {
  if (flowCount === 0) {
    // MODIFICATION 1 : On ajoute la classe "select-none" pour empêcher la sélection du texte.
    return <div className="text-slate-400 group-hover:text-slate-600 transition-colors py-3 select-none">+ Ajouter</div>
  }

  const renderBarGroup = (segments: FlowSegment[], alignment: "left" | "right" = "right") => (
    <div className={cn("h-14 w-full flex items-end gap-px", alignment === "right" ? "justify-end" : "justify-start")}>
      {segments.map((segment, index) => {
        const percentage = absoluteMaxValue > 0 ? (segment.amount / absoluteMaxValue) * 100 : 0
        const heightStyle = `max(min(${percentage}%, 100%), ${MIN_HEIGHT_PX}px)`
        return (
          <div key={index} className="relative w-5 rounded-t-[2px]" style={{ height: heightStyle, backgroundColor: segment.color }}>
            <div className="absolute bottom-full mb-0.5 w-full text-center text-[12px] font-bold text-slate-600 dark:text-slate-400">{segment.number}</div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="flex items-end gap-1 pt-4 w-full">
      {/* --- GROUPE GAINS (aligné à gauche) --- */}
      <div className="flex flex-col min-w-[68px] flex-1 items-start">
        {renderBarGroup(gains, "left")}
        {/* MODIFICATION 2 : On ajoute la classe "select-none" ici aussi. */}
        <div className={cn("flex items-center gap-1 p-1 rounded whitespace-nowrap mt-1 text-sm font-mono select-none", totalGains > 0 ? "text-green-700 dark:text-green-400 bg-green-500/10" : "text-slate-500")}>
          <ArrowUp size={12} /> {totalGains.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
        </div>
      </div>

      {/* --- GROUPE DÉPENSES (aligné à droite) --- */}
      <div className="flex flex-col min-w-[68px] flex-1 items-start">
        {renderBarGroup(expenses, "left")}
        {/* MODIFICATION 3 : Et enfin, on ajoute la classe "select-none" ici. */}
        <div className={cn("flex items-center gap-1 p-1 rounded whitespace-nowrap mt-1 text-sm font-mono select-none", totalExpenses > 0 ? "text-red-700 dark:text-red-400 bg-red-500/10" : "text-slate-500")}>
          <ArrowDown size={12} /> {totalExpenses.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
        </div>
      </div>
    </div>
  )
}
