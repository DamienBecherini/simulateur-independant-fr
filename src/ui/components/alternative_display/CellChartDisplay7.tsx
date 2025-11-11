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

// --- 1. SOUS-COMPOSANT DÉDIÉ AU DESSIN D'UNE BARRE DE CHEVRONS ---
// Il ne fait qu'une chose : dessiner une barre avec des chevrons à l'intérieur.
const ChevronBar = ({ height, color, direction }: { height: number; color: string; direction: "up" | "down" }) => {
  const SVG_HEIGHT = 4
  const SPACING = 2
  const CHEVRON_TOTAL_HEIGHT = SVG_HEIGHT + SPACING
  const BORDER_WIDTH = 1

  // S'assure que la barre est toujours visible, même pour de très petites valeurs.
  const clampedHeight = height > 0 ? Math.max(height, BORDER_WIDTH * 2 + CHEVRON_TOTAL_HEIGHT) : 0

  if (clampedHeight === 0) {
    return <div className="w-5" style={{ height: "56px" }} />
  }

  const chevronCount = Math.floor((clampedHeight - BORDER_WIDTH * 2) / CHEVRON_TOTAL_HEIGHT)
  const path = direction === "up" ? "M0 4 L4 0 L8 4" : "M0 0 L4 4 L8 0"

  return (
    <div
      className="relative w-5 rounded-t-[2px] border"
      style={{
        height: `${clampedHeight}px`,
        borderColor: color,
        backgroundColor: `${color}20` // Fond légèrement teinté
      }}
    >
      <div className="absolute bottom-0 left-0 right-0 flex flex-col-reverse items-center pb-px">
        {Array.from({ length: chevronCount }).map((_, i) => (
          <svg key={i} width="8" height={SVG_HEIGHT} viewBox="0 0 8 4" fill="none" stroke={color} strokeWidth="1.5" style={{ marginBottom: i < chevronCount - 1 ? `${SPACING}px` : "0" }}>
            <path d={path} />
          </svg>
        ))}
      </div>
    </div>
  )
}

// --- 2. COMPOSANT PRINCIPAL UTILISANT L'ANCIENNE STRUCTURE D'ALIGNEMENT ---
export function CellChartDisplay({ gains, expenses, totalGains, totalExpenses, absoluteMaxValue, flowCount }: CellChartDisplayProps) {
  if (flowCount === 0) {
    return <div className="text-slate-400 group-hover:text-slate-600 transition-colors py-3">+ Ajouter</div>
  }

  // Hauteur maximale en pixels pour les barres, pour un calcul proportionnel.
  const MAX_BAR_HEIGHT_PX = 56 // h-14

  // Fonction pour rendre un groupe de barres (gains ou dépenses).
  const renderBarGroup = (segments: FlowSegment[], direction: "up" | "down") => (
    <div className={cn("h-14 w-full flex items-end gap-px justify-start")}>
      {segments.map((segment, index) => {
        const barHeight = absoluteMaxValue > 0 ? (segment.amount / absoluteMaxValue) * MAX_BAR_HEIGHT_PX : 0
        return (
          // Chaque barre est maintenant dans un conteneur relatif pour positionner le numéro au-dessus.
          <div key={index} className="relative">
            <div className="absolute bottom-full mb-0.5 w-full text-center text-[12px] font-bold text-slate-600 dark:text-slate-400">{segment.number}</div>
            <ChevronBar height={barHeight} color={segment.color} direction={direction} />
          </div>
        )
      })}
    </div>
  )

  return (
    // On utilise la structure flex qui fonctionnait bien.
    <div className="flex items-end gap-1 pt-4 w-full">
      {/* --- GROUPE GAINS (aligné à gauche) --- */}
      <div className="flex flex-col min-w-[68px] flex-1 items-start">
        {renderBarGroup(gains, "up")}
        <div className={cn("flex w-full items-center gap-1 p-1 rounded whitespace-nowrap mt-1 text-sm font-mono", totalGains > 0 ? "text-green-700 dark:text-green-400 bg-green-500/10" : "text-slate-500")}>
          <ArrowUp size={12} /> {totalGains.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
        </div>
      </div>

      {/* --- GROUPE DÉPENSES */}
      <div className="flex flex-col min-w-[68px] flex-1 items-start">
        {renderBarGroup(expenses, "down")}
        <div className={cn("flex w-full items-center gap-1 p-1 rounded whitespace-nowrap mt-1 text-sm font-mono", totalExpenses > 0 ? "text-red-700 dark:text-red-400 bg-red-500/10" : "text-slate-500")}>
          <ArrowDown size={12} /> {totalExpenses.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
        </div>
      </div>
    </div>
  )
}
