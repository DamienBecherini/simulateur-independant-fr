// src/ui/components/CellChartDisplay.tsx

import { cn } from "@/lib/utils"
import { ArrowUp, ArrowDown } from "lucide-react"
import { useId } from "react" // Import du hook pour les ID uniques

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
// === 1. Le composant qui contient VOTRE SVG intégral et non modifié ===
// ========================================================================
const FullPatternSVG = ({ uniqueClipId }: { uniqueClipId: string }) => (
  <svg width="100%" height="100%" viewBox="0 0 928 1819" version="1.1" xmlns="http://www.w3.org/2000/svg" style={{ fill: "currentColor", fillRule: "evenodd", clipRule: "evenodd", strokeLinejoin: "round", strokeMiterlimit: 2 }}>
    <g transform="matrix(1,0,0,1,-1627,-380.864)">
      <g transform="matrix(0.426471,0,0,1,1447.03,210.864)">
        {/* On injecte l'ID unique dans le clipPath */}
        <clipPath id={uniqueClipId}>
          <rect x="422" y="170" width="2176" height="1819" />
        </clipPath>
        <g clipPath={`url(#${uniqueClipId})`}>
          <g transform="matrix(2.34483,0,0,1,-3210.14,-210.864)">
            {[147, 14.282, -118.436, -251.154, -383.872, -516.591, -649.309, -782.027, -914.745, -1445.62, -1047.46, -1578.34, -1180.18, -1711.05, -1312.9, -1843.77].map(offset => (
              <g key={offset} transform={`matrix(1,0,0,1,1127,${offset})`}>
                <g transform="matrix(1.37774,-0.666672,0.435574,0.900153,-686.427,2362.19)">
                  <rect x="287" y="349" width="744" height="91" />
                </g>
                <g transform="matrix(-1.37774,-0.666672,-0.435574,0.900153,2458.43,2362.19)">
                  <rect x="287" y="349" width="744" height="91" />
                </g>
              </g>
            ))}
          </g>
        </g>
      </g>
    </g>
  </svg>
)

// ======================================================================================
// === 2. Le composant ChevronBar qui applique la technique de masquage (clipping) ===
// ======================================================================================
const ChevronBar = ({ height, color, direction }: { height: number; color: string; direction: "up" | "down" }) => {
  const MAX_BAR_HEIGHT_PX = 56
  const BAR_WIDTH = 20
  const uniqueClipId = useId() // Génère un ID unique pour le clipPath

  if (height <= 0) {
    return <div style={{ width: `${BAR_WIDTH}px`, height: `${MAX_BAR_HEIGHT_PX}px` }} />
  }

  return (
    // Le conteneur "Masque" : il a la hauteur finale de la barre et cache ce qui dépasse.
    <div
      style={{
        width: `${BAR_WIDTH}px`,
        height: `${height}px`,
        overflow: "hidden",
        position: "relative",
        color: color // La couleur est passée au SVG via `currentColor`
      }}
    >
      {/* Le conteneur "Motif" : il a la hauteur MAXIMALE et est aligné en bas du masque. */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: `${MAX_BAR_HEIGHT_PX}px`,
          transform: direction === "down" ? "rotate(180deg)" : "none"
        }}
      >
        <FullPatternSVG uniqueClipId={uniqueClipId} />
      </div>
    </div>
  )
}

// ======================================================================================
// === 3. Le composant principal, qui reste inchangé dans sa logique d'affichage ===
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
