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

// ========================================================================
// === 1. NOUVEAU : Micro-composant pour dessiner UN SEUL chevron en SVG ===
// ========================================================================
const ChevronPatternSVG = ({ width, height, angle, thickness, color, direction }: { width: number; height: number; angle: number; thickness: number; color: string; direction: "up" | "down" }) => {
  // Calculs trigonométriques pour positionner les deux traits
  const angleRad = ((direction === "up" ? 180 - angle : angle) * Math.PI) / 180 / 2
  const lineLength = width * 1.5 // Les traits font 150% de la largeur pour déborder

  const centerX = width / 2
  const centerY = height / 2

  const x1 = centerX - (lineLength / 2) * Math.cos(angleRad)
  const y1 = centerY - (lineLength / 2) * Math.sin(angleRad)
  const x2 = centerX + (lineLength / 2) * Math.cos(angleRad)
  const y2 = centerY + (lineLength / 2) * Math.sin(angleRad)

  const x1_prime = centerX - (lineLength / 2) * Math.cos(-angleRad)
  const y1_prime = centerY - (lineLength / 2) * Math.sin(-angleRad)
  const x2_prime = centerX + (lineLength / 2) * Math.cos(-angleRad)
  const y2_prime = centerY + (lineLength / 2) * Math.sin(-angleRad)

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={thickness} strokeLinecap="round" />
      <line x1={x1_prime} y1={y1_prime} x2={x2_prime} y2={y2_prime} stroke={color} strokeWidth={thickness} strokeLinecap="round" />
    </svg>
  )
}

// ======================================================================================
// === 2. MODIFIÉ : Le composant ChevronBar gère maintenant la logique de masquage ===
// ======================================================================================
const ChevronBar = ({ height, color, direction }: { height: number; color: string; direction: "up" | "down" }) => {
  // ========================================================================
  // === VARIABLES DE RÉGLAGE : Modifiez ces valeurs pour expérimenter ! ===
  // ========================================================================
  const CHEVRON_THICKNESS_PX = 2.5
  const CHEVRON_SPACING_PX = 1.5
  const CHEVRON_ANGLE_DEG = 80 // L'angle du "V" du chevron (plus il est petit, plus il est pointu)
  // ========================================================================

  const BAR_WIDTH = 20
  const MAX_BAR_HEIGHT_PX = 56 // Hauteur de référence pour la pile complète de chevrons

  const CHEVRON_SVG_HEIGHT = BAR_WIDTH / 2 / Math.tan((CHEVRON_ANGLE_DEG * Math.PI) / 180 / 2)
  const CHEVRON_TOTAL_HEIGHT = CHEVRON_SVG_HEIGHT + CHEVRON_SPACING_PX
  const chevronCount = Math.ceil(MAX_BAR_HEIGHT_PX / CHEVRON_TOTAL_HEIGHT)

  if (height <= 0) {
    return <div style={{ width: `${BAR_WIDTH}px`, height: `${MAX_BAR_HEIGHT_PX}px` }} />
  }

  return (
    // Conteneur parent qui agit comme un masque : hauteur calculée et overflow: hidden
    <div
      className="relative"
      style={{
        width: `${BAR_WIDTH}px`,
        height: `${height}px`,
        overflow: "hidden"
      }}
    >
      {/* Conteneur enfant qui contient la pile complète de chevrons. Positionné en bas. */}
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-col"
        style={{
          gap: `${CHEVRON_SPACING_PX}px`
        }}
      >
        {Array.from({ length: chevronCount }).map((_, i) => (
          <ChevronPatternSVG key={i} width={BAR_WIDTH} height={CHEVRON_SVG_HEIGHT} angle={CHEVRON_ANGLE_DEG} thickness={CHEVRON_THICKNESS_PX} color={color} direction={direction} />
        ))}
      </div>
    </div>
  )
}

// ======================================================================================
// === 3. Le composant principal reste identique, il utilise juste le nouveau ChevronBar ===
// ======================================================================================
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
