// src/ui/components/CellChartDisplay.tsx

import { cn } from "@/lib/utils"
import { useAffichageResume } from "../hooks/useAffichage"
import { ArrowUp, ArrowDown } from "lucide-react"
import type { SegmentDeFlux } from "@/lib/grille-mensuelle"

interface CellChartDisplayProps {
  gains: SegmentDeFlux[]
  expenses: SegmentDeFlux[]
  totalGains: number
  totalExpenses: number
  absoluteMaxValue: number
  flowCount: number
  /** Cellule calculée (total annuel) : vide, elle n'invite pas à la saisie. */
  readOnly?: boolean
}

const MIN_HEIGHT_PX = 2

export function CellChartDisplay({ gains, expenses, totalGains, totalExpenses, absoluteMaxValue, flowCount, readOnly = false }: CellChartDisplayProps) {
  const resume = useAffichageResume()
  if (flowCount === 0) {
    if (readOnly) return <div className="py-3 text-center text-slate-600 dark:text-slate-400">—</div>
    // Sur papier, une case vide n'invite plus à la saisie : elle se lit comme un total annuel vide.
    return (
      <div className="py-3 text-slate-600 transition-colors group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 print:text-center">
        {/* Affichage « Résumé » : l'invitation n'apparaît qu'au survol ou au focus de la case, toujours au toucher. */}
        <span className={cn("print:hidden", resume && "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-visible:opacity-100")}>+ Ajouter</span>
        <span className="hidden print:inline">—</span>
      </div>
    )
  }

  const renderBarGroup = (segments: SegmentDeFlux[], alignment: "left" | "right" = "right") => (
    // On ajoute un alignement pour les barres aussi
    <div className={cn("h-14 w-full flex items-end gap-px print:h-8 print:empty:hidden", alignment === "right" ? "justify-end" : "justify-start")}>
      {segments.map((segment, index) => {
        const percentage = absoluteMaxValue > 0 ? (segment.amount / absoluteMaxValue) * 100 : 0
        const heightStyle = `max(min(${percentage}%, 100%), ${MIN_HEIGHT_PX}px)`
        return (
          <div key={index} className="relative w-5 rounded-t-[2px] print:w-auto print:min-w-[3px] print:max-w-5 print:flex-1" style={{ height: heightStyle, backgroundColor: segment.color }}>
            <div className="absolute bottom-full mb-0.5 w-full text-center text-xs font-bold print:text-[6.5pt] text-slate-600 dark:text-slate-400">{segment.number}</div>
          </div>
        )
      })}
    </div>
  )

  // Sur papier, les deux groupes s'empilent pour que les douze mois tiennent dans la largeur de la feuille.
  return (
    <div className="flex items-end gap-1 pt-4 w-full print:flex-col print:items-stretch print:gap-0 print:pt-0">
      {/* --- GROUPE GAINS (aligné à gauche) --- */}
      <div className="flex flex-col min-w-[68px] flex-1 items-start print:min-w-0 print:pt-3">
        {renderBarGroup(gains, "left")}
        <div className={cn("flex items-center gap-1 p-1 rounded whitespace-nowrap mt-1 text-sm font-mono print:mt-0.5 print:gap-0.5 print:px-0.5 print:py-0 print:font-sans print:text-[8.5pt] print:tabular-nums print:[&>svg]:size-2", totalGains > 0 ? "text-green-800 dark:text-green-400 bg-green-500/10" : "text-slate-600 dark:text-slate-400")}>
          <ArrowUp size={12} /> {totalGains.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
        </div>
      </div>

      {/* --- GROUPE DÉPENSES (aligné à droite) --- ; sur papier, une case sans dépense ne l'affiche pas. */}
      <div className={cn("flex flex-col min-w-[68px] flex-1 items-start print:min-w-0 print:pt-3", totalExpenses === 0 && "print:hidden")}>
        {renderBarGroup(expenses, "left")}
        <div className={cn("flex items-center gap-1 p-1 rounded whitespace-nowrap mt-1 text-sm font-mono print:mt-0.5 print:gap-0.5 print:px-0.5 print:py-0 print:font-sans print:text-[8.5pt] print:tabular-nums print:[&>svg]:size-2", totalExpenses > 0 ? "text-red-800 dark:text-red-400 bg-red-500/10" : "text-slate-600 dark:text-slate-400")}>
          <ArrowDown size={12} /> {totalExpenses.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
        </div>
      </div>
    </div>
  )
}
