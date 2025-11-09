// src/ui/components/FlowLegend.tsx

import { useMemo, useState } from "react"
import type { /*MonthlyGridData,*/ UserPreferences, FinancialFlow } from "@/types"
import { DEFAULT_FLOW_COLORS } from "@/lib/color-constants"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ColorSettingsModal } from "./ColorSettingsModal"

/**
 * Dictionnaire de libellés pour la légende.
 * ROADMAP 5.5.1: Maintenu à jour pour la cohérence avec les autres composants.
 */
const flowTypeLabels: Record<string, string> = {
  are: "ARE",
  salary: "Salaire",
  other_taxable_income: "Autre Revenu",
  ca_services: "CA Services",
  ca_vente: "CA Vente",
  deductible_expense: "Charge déductible",
  director_remuneration: "Rémunération Dirigeant",
  dividends_payment: "Dividendes",
  ca_micro_services_bic: "CA Micro (BIC)",
  ca_micro_services_bnc: "CA Micro (BNC)",
  ca_micro_vente: "CA Micro Vente",
  income: "Revenu (Test)",
  expense: "Dépense (non déductible)"
}

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

  // Gère la mise à jour d'une couleur directement depuis la légende.
  const handleColorChange = (flowType: FinancialFlow["type"], newColor: string) => {
    const newColors = { ...finalColors, [flowType]: newColor }
    onPreferencesChange({ ...preferences, flowTypeColors: newColors })
  }

  // Si aucun flux n'est présent dans la simulation, la légende ne s'affiche pas.
  if (usedFlowTypes.length === 0) return null

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
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {/* Itère sur les types de flux utilisés pour construire la légende. */}
          {usedFlowTypes.map(type => (
            <div key={type} className="flex items-center gap-2 group">
              {/* Le carré de couleur contient le numéro du flux. */}
              <div className="h-6 w-6 rounded relative border flex items-center justify-center" style={{ backgroundColor: finalColors[type] || "#ccc" }}>
                <span className="text-white text-xs font-bold [text-shadow:0_0_2px_rgba(0,0,0,0.7)]">{flowTypeToNumberMap.get(type)}</span>
                {/* Astuce UX : un input de type "color" est superposé et invisible, permettant un clic direct pour changer la couleur. */}
                <input type="color" value={finalColors[type] || "#ffffff"} onChange={e => handleColorChange(type, e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title={`Changer la couleur pour ${flowTypeLabels[type]}`} />
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors pr-2">{flowTypeLabels[type] || type}</span>
            </div>
          ))}
        </div>
      </div>
      {/* La modale de gestion des couleurs, contrôlée par l'état `isModalOpen`. */}
      <ColorSettingsModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} preferences={preferences} onSave={onPreferencesChange} />
    </>
  )
}
