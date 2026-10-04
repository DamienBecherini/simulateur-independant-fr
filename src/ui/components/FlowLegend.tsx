// src/ui/components/FlowLegend.tsx

import { useMemo, useState } from "react"
import type { UserPreferences, FinancialFlow } from "@/types"
import { DEFAULT_FLOW_COLORS } from "@/lib/color-constants"
import { flowTypeShortLabels, isExpenseFlowType } from "@/lib/flow-constants"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ColorSettingsModal } from "./ColorSettingsModal"

/**
 * Interface pour les props du composant FlowLegend.
 * Ce composant affiche une légende dynamique des flux financiers présents
 * dans la grille annuelle, avec leurs couleurs et numéros correspondants.
 */
interface FlowLegendProps {
  preferences: UserPreferences
  onPreferencesChange: (newPreferences: UserPreferences) => void
  flowTypeToNumberMap: Map<string, number> // Map qui associe un type de flux à un numéro
}

export function FlowLegend({ preferences, onPreferencesChange, flowTypeToNumberMap }: FlowLegendProps) {
  // État pour contrôler l'ouverture de la modale de personnalisation des couleurs.
  const [isModalOpen, setModalOpen] = useState(false)

  // Calcule les couleurs finales en fusionnant les couleurs par défaut avec celles personnalisées par l'utilisateur.
  const finalColors = useMemo(
    () => ({
      ...DEFAULT_FLOW_COLORS,
      ...preferences.flowTypeColors
    }),
    [preferences]
  )

  // Détermine les types de flux actuellement utilisés en extrayant les clés de la map passée en props.
  const usedFlowTypes = Array.from(flowTypeToNumberMap.keys()) as FinancialFlow["type"][]

  // MODIFICATION 2 : On filtre les types de flux en deux listes distinctes : gains et dépenses.
  const gainTypes = useMemo(() => usedFlowTypes.filter(type => !isExpenseFlowType(type)), [usedFlowTypes])
  const expenseTypesFiltered = useMemo(() => usedFlowTypes.filter(isExpenseFlowType), [usedFlowTypes])

  // Gère la mise à jour d'une couleur directement depuis la légende.
  const handleColorChange = (flowType: FinancialFlow["type"], newColor: string) => {
    const newColors = { ...finalColors, [flowType]: newColor }
    onPreferencesChange({ ...preferences, flowTypeColors: newColors })
  }

  // Si aucun flux n'est présent dans la simulation, la légende ne s'affiche pas.
  if (usedFlowTypes.length === 0) return null

  // Fonction de rendu pour un élément de la légende afin d'éviter la répétition du code.
  const renderLegendItem = (type: FinancialFlow["type"]) => (
    <div key={type} className="flex items-center gap-2 group">
      {/* Le carré de couleur contient le numéro du flux. */}
      <div className="h-6 w-6 rounded relative border flex items-center justify-center" style={{ backgroundColor: finalColors[type] || "#ccc" }}>
        <span className="text-white text-xs font-bold [text-shadow:0_0_2px_rgba(0,0,0,0.7)]">{flowTypeToNumberMap.get(type)}</span>
        {/* Astuce UX : un input de type "color" est superposé et invisible, permettant un clic direct pour changer la couleur. */}
        <input type="color" value={finalColors[type] || "#ffffff"} onChange={e => handleColorChange(type, e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title={`Changer la couleur pour ${flowTypeShortLabels[type]}`} />
      </div>
      <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors pr-2">{flowTypeShortLabels[type] || type}</span>
    </div>
  )

  return (
    <>
      <div className="p-4 mt-4 bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Légende des Flux</h3>
          <Button variant="ghost" size="sm" onClick={() => setModalOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Gérer les couleurs
          </Button>
        </div>
        {/* MODIFICATION 3 : La structure d'affichage est maintenant une grille à deux colonnes. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {/* Section pour les Gains */}
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 border-b pb-1">Gains</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">{gainTypes.length > 0 ? gainTypes.map(renderLegendItem) : <p className="text-sm text-slate-600 dark:text-slate-400 italic">Aucun gain ce mois-ci.</p>}</div>
          </div>
          {/* Section pour les Dépenses */}
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 border-b pb-1">Dépenses</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">{expenseTypesFiltered.length > 0 ? expenseTypesFiltered.map(renderLegendItem) : <p className="text-sm text-slate-600 dark:text-slate-400 italic">Aucune dépense ce mois-ci.</p>}</div>
          </div>
        </div>
      </div>
      {/* La modale de gestion des couleurs, qui reste inchangée. */}
      <ColorSettingsModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} preferences={preferences} onSave={onPreferencesChange} />
    </>
  )
}
