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
  absoluteMaxValue: number // L'échelle de référence, cruciale
  flowCount: number
}

const MIN_HEIGHT_PX = 2 // Hauteur minimale pour qu'une barre soit visible

export function CellChartDisplay({ gains, expenses, totalGains, totalExpenses, absoluteMaxValue, flowCount }: CellChartDisplayProps) {
  if (flowCount === 0) {
    return <div className="text-slate-400 group-hover:text-slate-600 transition-colors py-3">+ Ajouter</div>
  }

  /**
   * Sous-composant pour rendre un groupe de barres (soit les gains, soit les dépenses).
   * C'est ici que la logique de rendu a été stabilisée.
   */
  const renderBarGroup = (segments: FlowSegment[]) => {
    // Le conteneur principal a une hauteur fixe (h-12 => 3rem) et aligne les enfants en bas.
    // C'est la référence de hauteur pour les barres.
    return (
      <div className="h-14 w-full flex items-end gap-px">
        {segments.map((segment, index) => {
          // Calcul simple du pourcentage de la hauteur totale.
          const percentage = absoluteMaxValue > 0 ? (segment.amount / absoluteMaxValue) * 100 : 0

          // La hauteur de la barre est le plus petit entre le pourcentage calculé et 100%,
          // avec une hauteur minimale pour la visibilité.
          const heightStyle = `max(min(${percentage}%, 100%), ${MIN_HEIGHT_PX}px)`

          return (
            // Conteneur pour une seule barre.
            <div
              key={index}
              className="relative w-5 rounded-t-[2px]"
              style={{
                height: heightStyle,
                backgroundColor: segment.color
              }}
            >
              {/* Le code pour afficher le numéro est ici, prêt à être utilisé.
                  La barre fonctionne indépendamment. */}
              <div className="absolute bottom-full mb-0.5 w-full text-center text-[12px] font-bold text-slate-600 dark:text-slate-400">{segment.number}</div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    // On ajoute un pt-4 (padding-top) pour laisser de la place aux numéros au-dessus des barres.
    <div className="flex flex-col h-full justify-between pt-4">
      {/* PARTIE HAUTE : Les graphiques */}
      <div className="flex items-end gap-1 h-12">
        <div className="min-w-[68px]">{renderBarGroup(gains)}</div>
        <div className="min-w-[68px]">{renderBarGroup(expenses)}</div>
      </div>

      {/* PARTIE BASSE : Les totaux */}
      <div className="flex justify-between items-center text-sm font-mono mt-1">
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
