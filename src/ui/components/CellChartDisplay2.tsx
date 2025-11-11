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

const ChevronBar = ({ height, color, direction }: { height: number; color: string; direction: "up" | "down" }) => {
  // ========================================================================
  // === VARIABLES DE RÉGLAGE : Modifiez ces valeurs pour expérimenter ! ===
  // ========================================================================

  /** Contrôle l'épaisseur (la hauteur) de chaque chevron, en pixels. */
  const CHEVRON_THICKNESS_PX = 8

  /** Contrôle l'espace vertical entre chaque chevron, en pixels. */
  const CHEVRON_SPACING_PX = 0

  // ========================================================================

  const CHEVRON_PATH = "M702.617,434.438L0.6,829.99L0.5,396.049L702.512,0.5L702.617,0.686L702.721,0.5L1404.73,396.049L1404.63,829.99L702.617,434.438Z"
  const BAR_WIDTH = 20

  // Le reste des calculs utilise vos variables de réglage
  const CHEVRON_TOTAL_HEIGHT = CHEVRON_THICKNESS_PX + CHEVRON_SPACING_PX
  const BORDER_WIDTH = 1

  const clampedHeight = height > 0 ? Math.max(height, BORDER_WIDTH * 2 + CHEVRON_TOTAL_HEIGHT) : 0

  if (clampedHeight === 0) {
    return <div style={{ width: `${BAR_WIDTH}px`, height: "56px" }} />
  }

  const chevronCount = Math.floor((clampedHeight - BORDER_WIDTH * 2) / CHEVRON_TOTAL_HEIGHT)

  return (
    <div
      className="relative"
      style={{
        width: `${BAR_WIDTH}px`,
        height: `${clampedHeight}px`
      }}
    >
      <div className="absolute bottom-0 left-0 right-0 flex flex-col-reverse items-center pb-px">
        {Array.from({ length: chevronCount }).map((_, i) => (
          <svg
            key={i}
            width={BAR_WIDTH}
            height={CHEVRON_THICKNESS_PX} // Utilise la variable d'épaisseur
            viewBox="0 0 1406 831"
            fill={color}
            style={{
              transform: direction === "down" ? "rotate(180deg)" : "none",
              marginBottom: i < chevronCount - 1 ? `${CHEVRON_SPACING_PX}px` : "0" // Utilise la variable d'espacement
            }}
          >
            <path d={CHEVRON_PATH} />
          </svg>
        ))}
      </div>
    </div>
  )
}

// --- Le composant principal reste identique ---
export function CellChartDisplay({ gains, expenses, totalGains, totalExpenses, absoluteMaxValue, flowCount }: CellChartDisplayProps) {
  if (flowCount === 0) {
    return <div className="text-slate-400 group-hover:text-slate-600 transition-colors py-3">+ Ajouter</div>
  }

  const MAX_BAR_HEIGHT_PX = 56

  const renderBarGroup = (segments: FlowSegment[], direction: "up" | "down") => (
    <div className={cn("h-14 w-full flex items-end gap-px justify-start")}>
      {segments.map((segment, index) => {
        const barHeight = absoluteMaxValue > 0 ? (segment.amount / absoluteMaxValue) * MAX_BAR_HEIGHT_PX : 0
        return (
          <div key={index} className="relative">
            <div className="absolute bottom-full mb-0.5 w-full text-center text-[12px] font-bold text-slate-600 dark:text-slate-400">{segment.number}</div>
            <ChevronBar height={barHeight} color={segment.color} direction={direction} />
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="flex items-end gap-1 pt-4 w-full">
      <div className="flex flex-col min-w-[68px] flex-1 items-start">
        {renderBarGroup(gains, "up")}
        <div className={cn("flex w-full items-center gap-1 p-1 rounded whitespace-nowrap mt-1 text-sm font-mono", totalGains > 0 ? "text-green-700 dark:text-green-400 bg-green-500/10" : "text-slate-500")}>
          <ArrowUp size={12} /> {totalGains.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
        </div>
      </div>

      <div className="flex flex-col min-w-[68px] flex-1 items-start">
        {renderBarGroup(expenses, "down")}
        <div className={cn("flex w-full items-center gap-1 p-1 rounded whitespace-nowrap mt-1 text-sm font-mono", totalExpenses > 0 ? "text-red-700 dark:text-red-400 bg-red-500/10" : "text-slate-500")}>
          <ArrowDown size={12} /> {totalExpenses.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
        </div>
      </div>
    </div>
  )
}
