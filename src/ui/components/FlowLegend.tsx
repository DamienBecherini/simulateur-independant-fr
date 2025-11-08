// src/ui/components/FlowLegend.tsx

import { useMemo, useState } from "react"
import type { MonthlyGridData, UserPreferences, FinancialFlow } from "@/types" // 1. Ajout de FinancialFlow aux imports
import { DEFAULT_FLOW_COLORS } from "@/lib/color-constants"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ColorSettingsModal } from "./ColorSettingsModal"
// import { cn } from "@/lib/utils"

const flowTypeLabels: Record<string, string> = {
  are: "ARE",
  salary: "Salaire",
  other_taxable_income: "Autre Revenu",
  ca_services: "CA Services",
  ca_vente: "CA Vente",
  deductible_expense: "Dépense Déductible",
  director_remuneration: "Rémunération Dirigeant",
  dividends_payment: "Dividendes",
  ca_micro_services_bic: "CA Micro (BIC)",
  ca_micro_services_bnc: "CA Micro (BNC)",
  ca_micro_vente: "CA Micro Vente",
  income: "Revenu (Test)",
  expense: "Dépense (Test)"
}

interface FlowLegendProps {
  monthlyData: MonthlyGridData
  preferences: UserPreferences
  onPreferencesChange: (newPreferences: UserPreferences) => void
  flowTypeToNumberMap: Map<string, number>
}

export function FlowLegend({ preferences, onPreferencesChange, flowTypeToNumberMap }: FlowLegendProps) {
  const [isModalOpen, setModalOpen] = useState(false)

  const finalColors = useMemo(
    () => ({
      ...DEFAULT_FLOW_COLORS,
      ...preferences.flowTypeColors
    }),
    [preferences]
  )

  // La logique de calcul des `usedFlowTypes` est maintenant dans App.tsx
  // On récupère simplement les clés de la map.
  const usedFlowTypes = Array.from(flowTypeToNumberMap.keys()) as FinancialFlow["type"][]

  // 2. Nouvelle fonction pour gérer la mise à jour directe d'une couleur
  const handleColorChange = (flowType: FinancialFlow["type"], newColor: string) => {
    const newColors = { ...finalColors, [flowType]: newColor }
    onPreferencesChange({ ...preferences, flowTypeColors: newColors })
  }

  if (usedFlowTypes.length === 0) return null

  return (
    <>
      <div className="p-4 mt-4 bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md">
        {/* Header de la légende */}
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Légende des Flux</h3>
          <Button variant="ghost" size="sm" onClick={() => setModalOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Gérer les couleurs
          </Button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {usedFlowTypes.map(type => (
            <div key={type} className="flex items-center gap-2 group">
              {/* Le conteneur du carré de couleur devient 'relative' */}
              <div className="h-6 w-6 rounded relative border flex items-center justify-center" style={{ backgroundColor: finalColors[type] || "#ccc" }}>
                {/* Le numéro, avec un style pour le contraste */}
                <span className="text-white text-xs font-bold [text-shadow:0_0_2px_rgba(0,0,0,0.7)]">{flowTypeToNumberMap.get(type)}</span>
                {/* On superpose un input de couleur, totalement invisible mais cliquable */}
                <input type="color" value={finalColors[type] || "#ffffff"} onChange={e => handleColorChange(type, e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title={`Changer la couleur pour ${flowTypeLabels[type]}`} />
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors pr-2">{flowTypeLabels[type] || type}</span>
            </div>
          ))}
        </div>
      </div>
      <ColorSettingsModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} preferences={preferences} onSave={onPreferencesChange} />
    </>
  )
}
