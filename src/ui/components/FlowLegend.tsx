// src/ui/components/FlowLegend.tsx

// 1. CORRECTION : Ajout de 'useState' et 'UserPreferences' aux imports
import { useMemo, useState } from "react"
import type { MonthlyGridData, UserPreferences } from "@/types"

import { DEFAULT_FLOW_COLORS } from "@/lib/color-constants"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ColorSettingsModal } from "./ColorSettingsModal"

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
}

// 2. CORRECTION : Déstructuration de TOUTES les props nécessaires ici
export function FlowLegend({ monthlyData, preferences, onPreferencesChange }: FlowLegendProps) {
  const [isModalOpen, setModalOpen] = useState(false)

  const finalColors = useMemo(
    () => ({
      ...DEFAULT_FLOW_COLORS,
      ...preferences.flowTypeColors
    }),
    // 3. CORRECTION : La dépendance est bien l'objet `preferences` entier.
    [preferences]
  )

  const usedFlowTypes = useMemo(() => {
    const types = new Set<string>()
    monthlyData.forEach(month => {
      month.flows.forEach(flow => types.add(flow.type))
    })
    return Array.from(types)
  }, [monthlyData])

  if (usedFlowTypes.length === 0) return null

  return (
    <>
      <div className="p-4 mt-4 bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold">Légende des Flux</h3>
          <Button variant="ghost" size="sm" onClick={() => setModalOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Personnaliser les couleurs
          </Button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {usedFlowTypes.map(type => (
            <div key={type} className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ backgroundColor: finalColors[type as keyof typeof finalColors] || "#ccc" }} />
              <span className="text-sm text-slate-700 dark:text-slate-300">{flowTypeLabels[type] || type}</span>
            </div>
          ))}
        </div>
      </div>
      <ColorSettingsModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} preferences={preferences} onSave={onPreferencesChange} />
    </>
  )
}
